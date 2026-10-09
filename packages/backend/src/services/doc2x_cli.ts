import { existsSync, mkdirSync, rmSync } from 'fs'
import { dirname, extname, isAbsolute, join, resolve } from 'path'
import { getConfig } from '../config.js'

export interface Doc2xRunOptions {
  cliPath: string
  timeoutSeconds: number
  cwd?: string
}

export interface Doc2xRunResult {
  /** Parsed `--json` stdout. */
  json: any
  /** Absolute output files reported by the CLI (`outputFiles`). */
  outputFiles: string[]
}

export class Doc2xError extends Error {}

function truncate(text: string, max = 500): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

function tryParseJson(text: string): any {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // stderr may carry progress lines before the final JSON object
    const start = trimmed.lastIndexOf('\n{')
    if (start >= 0) {
      try { return JSON.parse(trimmed.slice(start + 1)) } catch {}
    }
    return null
  }
}

/** Map a failed CLI run to a user-facing message (exit 2 = auth, see doc2x exit codes). */
export function describeDoc2xFailure(exitCode: number, stdout: string, stderr: string): string {
  if (exitCode === 2) return 'doc2x 未登录或登录已失效，请在服务器上运行 `doc2x login` 后重试'
  const parsed = tryParseJson(stderr) ?? tryParseJson(stdout)
  const message = parsed?.error
    ? (typeof parsed.error === 'string' ? parsed.error : parsed.error.message || parsed.error.code)
    : null
  return `doc2x 运行失败（退出码 ${exitCode}）：${truncate(message || stderr || stdout || 'unknown error')}`
}

/**
 * Run the doc2x CLI with `--json`. The CLI is a Node script (`#!/usr/bin/env node`), so when
 * `cliPath` is absolute its directory (which holds the matching `node`) is prepended to PATH.
 */
export async function runDoc2x(args: string[], options: Doc2xRunOptions): Promise<Doc2xRunResult> {
  const env: Record<string, string | undefined> = { ...process.env, DOC2X_NO_UPDATE_CHECK: '1' }
  if (isAbsolute(options.cliPath)) env.PATH = `${dirname(options.cliPath)}:${env.PATH ?? ''}`

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn([options.cliPath, '--json', '--no-color', ...args], {
      cwd: options.cwd,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (err: any) {
    if (err?.code === 'ENOENT' || /ENOENT|not found/i.test(String(err?.message))) {
      throw new Doc2xError('未检测到 doc2x CLI，请先安装：npm i -g @noedgeai-org/doc2x-cli@latest')
    }
    throw err
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const timeout = new Promise<void>((resolveTimeout) => {
    timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolveTimeout()
    }, options.timeoutSeconds * 1000)
  })

  try {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout as ReadableStream).text(),
      new Response(proc.stderr as ReadableStream).text(),
      Promise.race([proc.exited, timeout]),
    ])
    const exitCode = await proc.exited
    if (timedOut) throw new Doc2xError(`doc2x 运行超时（${options.timeoutSeconds} 秒）`)
    if (exitCode !== 0) throw new Doc2xError(describeDoc2xFailure(exitCode, stdout, stderr))
    const json = tryParseJson(stdout)
    if (!json) throw new Doc2xError(`doc2x 输出无法解析：${truncate(stdout)}`)
    const outputFiles: string[] = Array.isArray(json.outputFiles) ? json.outputFiles : []
    return { json, outputFiles }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Pick the reported output with the given extension, falling back to `<dir>/<name>.<ext>`. */
export function findOutputFile(result: Doc2xRunResult, ext: string, fallback: string): string | null {
  const hit = result.outputFiles.find((f) => extname(f).toLowerCase() === `.${ext}`)
  if (hit && existsSync(hit)) return hit
  return existsSync(fallback) ? fallback : null
}

export function doc2xOptions(): Doc2xRunOptions {
  const config = getConfig().doc2x
  return { cliPath: config.cli_path, timeoutSeconds: config.timeout }
}

/** Absolute artifact directory `<output_dir>/<paperId>/<kind>`, created on demand. */
export function doc2xPaperDir(paperId: number, kind?: 'parse' | 'translate'): string {
  const base = resolve(process.cwd(), getConfig().doc2x.output_dir, String(paperId))
  const dir = kind ? join(base, kind) : base
  if (kind) mkdirSync(dir, { recursive: true })
  return dir
}

/** Best-effort removal of a paper's doc2x artifacts (called on paper delete). */
export function removeDoc2xArtifacts(paperId: number): void {
  try {
    rmSync(doc2xPaperDir(paperId), { recursive: true, force: true })
  } catch (err) {
    console.warn(`Failed to remove doc2x artifacts for paper ${paperId}:`, err)
  }
}

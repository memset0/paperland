import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join, resolve } from 'path'
import { getConfig } from '../config.js'
import { doc2xOptions, runDoc2x } from './doc2x_cli.js'

/**
 * Preserved-layout translation of an EXISTING doc2x parse via the gateway the doc2x CLI itself
 * uses (`doc2x translate` uploads + re-parses, costing page quota again). Undocumented endpoints
 * (verified with CLI 0.2.0): reusing the parse charges translation points only. Callers must
 * fall back to the CLI when this fails.
 */

const POLL_START_MS = 2000
const POLL_MAX_MS = 10000

interface TokenFile { accessToken: string; expiresAt: number }

function tokenPath(): string {
  const configured = getConfig().doc2x.token_file
  return configured.startsWith('~/') ? join(homedir(), configured.slice(2)) : resolve(configured)
}

function readToken(): TokenFile | null {
  try {
    const parsed = JSON.parse(readFileSync(tokenPath(), 'utf8'))
    return parsed?.accessToken ? parsed : null
  } catch {
    return null
  }
}

/** A valid access token; an expired one is refreshed by letting the CLI run a cheap command. */
export async function getAccessToken(): Promise<string> {
  let token = readToken()
  if (!token || Date.now() >= token.expiresAt - 60_000) {
    await runDoc2x(['account', 'status'], doc2xOptions())
    token = readToken()
  }
  if (!token || Date.now() >= token.expiresAt) throw new Error('doc2x 登录已失效，请在服务器上运行 `doc2x login`')
  return token.accessToken
}

async function gateway(path: string, body: unknown, token: string): Promise<any> {
  const res = await fetch(`${getConfig().doc2x.gateway_url.replace(/\/$/, '')}/gateway.v1.TaskService/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json: any = await res.json().catch(() => null)
  if (!res.ok || json?.code !== 'success') {
    throw new Error(`doc2x 网关 ${path} 失败：${json?.msg ?? json?.code ?? `HTTP ${res.status}`}`)
  }
  return json.data
}

// Same enum values the CLI sends (LANGUAGE_MAP / PDF font strategy / translate type).
const LANGUAGE_IDS: Record<string, number> = { zh: 1, en: 2, ja: 3, fr: 4, ru: 5, pt: 6, es: 7, de: 8, ko: 9, ar: 10, 'pt-BR': 12 }
const FONT_STRATEGY_IDS: Record<string, number> = { 'global-consistent': 1, 'page-optimal': 2 }
const TRANSLATE_TYPE_PDF = 2
const TRANSLATE_VERSION_V3 = 3
const STATUS_SUCCESS = 2
const STATUS_FAILED = 3

async function pollUntilDone(outputId: string, token: string, deadline: number): Promise<void> {
  let interval = POLL_START_MS
  while (true) {
    if (Date.now() > deadline) throw new Error('doc2x 翻译超时')
    await Bun.sleep(interval)
    interval = Math.min(interval * 1.5, POLL_MAX_MS)
    const status = await gateway('GetTaskStatus', { output_id: outputId }, token)
    if (status?.status === STATUS_FAILED) throw new Error('doc2x 翻译任务失败')
    if (status?.status === STATUS_SUCCESS) return
  }
}

/** Translate `parseId` and save the side-by-side PDF to `outPath`; returns the translate id. */
export async function translateFromParse(parseId: string, outPath: string): Promise<{ translateId: string }> {
  const config = getConfig().doc2x
  const language = LANGUAGE_IDS[config.translate.target_language]
  if (!language) throw new Error(`不支持的目标语言：${config.translate.target_language}`)
  const token = await getAccessToken()
  const deadline = Date.now() + config.timeout * 1000

  const created = await gateway('CreateTranslateTask', {
    parse_id: parseId,
    translate_lang: language,
    translate_model: Number(config.translate.model),
    translate_term_id: null,
    font_color_extraction: false,
    translate_type: TRANSLATE_TYPE_PDF,
    ignore_translate_types: config.translate.ignore_types,
    contextual_translation: false,
    translate_version: TRANSLATE_VERSION_V3,
    font_strategy: FONT_STRATEGY_IDS[config.translate.pdf_font_strategy],
  }, token)
  const translateId = created?.output_id
  if (!translateId) throw new Error('doc2x 网关未返回翻译任务 id')
  await pollUntilDone(translateId, token, deadline)

  const exported = await gateway('CreateExternalPDFMergeTask', { translate_id: translateId, reverse_order: false, optimize: false }, token)
  const url = exported?.result
  if (!url) throw new Error('doc2x 对照 PDF 导出失败')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载 doc2x 对照 PDF 失败：HTTP ${res.status}`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, new Uint8Array(await res.arrayBuffer()))
  return { translateId }
}

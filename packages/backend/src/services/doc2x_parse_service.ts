import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { getConfig } from '../config.js'
import type { PaperBoundServiceDef } from './base_service.js'
import { doc2xOptions, doc2xPaperDir, findOutputFile, runDoc2x } from './doc2x_cli.js'

export interface Doc2xParseResult {
  markdown: string
  /** doc2x parse task id (`op_…`) — persisted as `metadata.doc2x_parse_id`. */
  parseId: string | null
}

/** `doc2x parse` via the CLI (costs page quota); also returns the parse task id. */
export async function doc2xParseToMarkdown(paperId: number, pdfPath: string): Promise<Doc2xParseResult> {
  const config = getConfig().doc2x
  const outDir = doc2xPaperDir(paperId, 'parse')
  const result = await runDoc2x([
    'parse', resolve(process.cwd(), pdfPath),
    '--to', 'md',
    '--formula-mode', config.parse.formula_mode,
    '--out', outDir,
    '--name', 'paper',
    '--overwrite',
  ], doc2xOptions())
  const mdPath = findOutputFile(result, 'md', join(outDir, 'paper.md'))
  if (!mdPath) throw new Error('doc2x 解析完成但未找到 Markdown 输出文件')
  const markdown = readFileSync(mdPath, 'utf-8')
  if (!markdown.trim()) throw new Error('doc2x 解析结果为空')
  return { markdown, parseId: result.json?.receipt?.taskIds?.parseId ?? null }
}

function parseJsonField(value: unknown): Record<string, any> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, any>
  try { return JSON.parse(String(value)) } catch { return {} }
}

/**
 * Automatic scheduling gate: doc2x enabled, PDF present (so the dependency graph never
 * starts it ahead of the PDF download), and either a new paper (created at/after
 * `doc2x.auto_since`) or an explicit user request.
 */
export function isDoc2xParseEligible(paper: any): boolean {
  const config = getConfig().doc2x
  if (!config.enabled || !paper?.pdf_path) return false
  if (parseJsonField(paper.metadata).doc2x_parse_requested) return true
  const since = config.auto_since ? Date.parse(config.auto_since) : NaN
  if (Number.isNaN(since)) return true
  const created = Date.parse(paper.created_at)
  return !Number.isNaN(created) && created >= since
}

export const doc2xParseService: PaperBoundServiceDef = {
  name: 'doc2x_parse',
  type: 'paper_bound',
  depends_on: ['pdf_path'],
  produces: ['contents.doc2x_parsed'],
  requires_listed: true,
  eligible: isDoc2xParseEligible,

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    if (!getConfig().doc2x.enabled) throw new Error('doc2x 未启用（config.yml doc2x.enabled）')
    if (!paper.pdf_path) throw new Error('No pdf_path on paper')
    const { markdown, parseId } = await doc2xParseToMarkdown(paperId, paper.pdf_path)
    // The parse id is persisted so a later translation can reuse this parse (no page quota).
    return { 'contents.doc2x_parsed': markdown, ...(parseId ? { doc2x_parse_id: parseId } : {}) }
  },
}

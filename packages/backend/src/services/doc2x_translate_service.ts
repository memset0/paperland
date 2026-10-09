import { readFileSync, writeFileSync } from 'fs'
import { join, relative, resolve } from 'path'
import { PDFDocument } from 'pdf-lib'
import { getConfig } from '../config.js'
import type { PaperBoundServiceDef } from './base_service.js'
import { doc2xOptions, doc2xPaperDir, findOutputFile, runDoc2x } from './doc2x_cli.js'
import { translateFromParse } from './doc2x_gateway.js'

export interface Doc2xTranslation {
  bilingual_pdf_path: string
  translated_pdf_path: string
  /** doc2x task ids of this run (internal parse + translation). */
  parse_id: string | null
  translate_id: string | null
  model: string
  target_language: string
  translated_at: string
}

function parseJsonField(value: unknown): Record<string, any> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, any>
  try { return JSON.parse(String(value)) } catch { return {} }
}

/**
 * Only explicitly requested translations are scheduled, and only once the doc2x parse
 * exists (so the dependency graph never starts it ahead of the parse).
 */
export function isDoc2xTranslateEligible(paper: any): boolean {
  if (!getConfig().doc2x.enabled || !paper?.pdf_path) return false
  if (!parseJsonField(paper.metadata).doc2x_translate_requested) return false
  return !!parseJsonField(paper.contents).doc2x_parsed
}

/**
 * Derive a translation-only PDF from doc2x's side-by-side bilingual PDF (original left,
 * translation right) by keeping the right half of every page. Page count is unchanged.
 */
export async function cropRightHalf(bilingualPdf: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bilingualPdf)
  for (const page of doc.getPages()) {
    const box = page.getMediaBox()
    const half = box.width / 2
    const right = { x: box.x + half, y: box.y, width: half, height: box.height }
    // Set both boxes: some viewers render the MediaBox even when a CropBox is present.
    page.setMediaBox(right.x, right.y, right.width, right.height)
    page.setCropBox(right.x, right.y, right.width, right.height)
  }
  return doc.save()
}

/** `doc2x translate` via the CLI: uploads and re-parses the PDF (page quota + points). */
async function translateWithCli(pdfPath: string, outDir: string): Promise<{ bilingual: string; parseId: string | null; translateId: string | null }> {
  const config = getConfig().doc2x
  const args = [
    'translate', resolve(process.cwd(), pdfPath),
    '--translate-type', 'pdf',
    '--target-language', config.translate.target_language,
    '--target-model', config.translate.model,
    '--pdf-font-strategy', config.translate.pdf_font_strategy,
  ]
  if (config.translate.ignore_types.length > 0) {
    args.push('--ignore-translate-types', ...config.translate.ignore_types)
  }
  args.push('--out', outDir, '--name', 'bilingual', '--overwrite')

  const result = await runDoc2x(args, doc2xOptions())
  const bilingual = findOutputFile(result, 'pdf', join(outDir, 'bilingual.pdf'))
  if (!bilingual) throw new Error('doc2x 翻译完成但未找到 PDF 输出文件')
  const taskIds = result.json?.receipt?.taskIds ?? {}
  return { bilingual, parseId: taskIds.parseId ?? null, translateId: taskIds.translateId ?? null }
}

/**
 * Translate the paper. With a stored `doc2x_parse_id` the existing parse is reused through the
 * gateway (translation points only); without one, or if the gateway fails, `doc2x translate`
 * re-parses the PDF via the CLI.
 */
export async function doc2xTranslatePdf(paperId: number, pdfPath: string, parseId: string | null): Promise<Doc2xTranslation> {
  const config = getConfig().doc2x
  const outDir = doc2xPaperDir(paperId, 'translate')
  let run: { bilingual: string; parseId: string | null; translateId: string | null } | null = null
  if (parseId) {
    try {
      const bilingual = join(outDir, 'bilingual.pdf')
      const { translateId } = await translateFromParse(parseId, bilingual)
      run = { bilingual, parseId, translateId }
    } catch (err: any) {
      console.warn(`doc2x translate reusing parse ${parseId} failed for paper ${paperId}, falling back to CLI: ${err?.message}`)
    }
  }
  if (!run) run = await translateWithCli(pdfPath, outDir)

  const translated = join(outDir, 'translated.pdf')
  writeFileSync(translated, await cropRightHalf(new Uint8Array(readFileSync(run.bilingual))))

  return {
    bilingual_pdf_path: relative(process.cwd(), run.bilingual),
    translated_pdf_path: relative(process.cwd(), translated),
    parse_id: run.parseId,
    translate_id: run.translateId,
    model: config.translate.model,
    target_language: config.translate.target_language,
    translated_at: new Date().toISOString(),
  }
}

export const doc2xTranslateService: PaperBoundServiceDef = {
  name: 'doc2x_translate',
  type: 'paper_bound',
  depends_on: ['contents.doc2x_parsed'],
  produces: ['doc2x_translation'],
  requires_listed: true,
  eligible: isDoc2xTranslateEligible,

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    if (!getConfig().doc2x.enabled) throw new Error('doc2x 未启用（config.yml doc2x.enabled）')
    if (!paper.pdf_path) throw new Error('No pdf_path on paper')
    const parseId = parseJsonField(paper.metadata).doc2x_parse_id ?? null
    return { doc2x_translation: await doc2xTranslatePdf(paperId, paper.pdf_path, parseId) }
  },
}

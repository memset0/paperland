import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { getConfig } from '../config.js'

// Shared PDF storage for every way a paper gets a PDF (arXiv / S2 open-access / user PDF URL
// downloads and user uploads). Files are content-hashed (`data/pdfs/<prefix>_<sha8>.pdf`):
// `/api/files` caches PDFs for 24h, so a stored name is never reused for different bytes, and a
// re-fetched PDF can be compared with the current one before anything on the paper changes.

const DEFAULT_TIMEOUT_SEC = 60
const DEFAULT_MAX_SIZE_MB = 100
// Some repositories reject requests without a browser-like User-Agent.
const USER_AGENT = 'Mozilla/5.0 (compatible; Paperland/1.0; +https://www.semanticscholar.org)'

export type PdfSourceService = 'arxiv_pdf_service' | 'url_pdf_service' | 's2_pdf_service'

export interface DownloadLimits {
  timeoutMs: number
  maxBytes: number
}

/** `services.<name>.download_timeout` / `max_file_size_mb`, with 60 s / 100 MB defaults. */
export function downloadLimits(serviceName: string): DownloadLimits {
  const svc = getConfig().services[serviceName]
  return {
    timeoutMs: (svc?.download_timeout ?? DEFAULT_TIMEOUT_SEC) * 1000,
    maxBytes: (svc?.max_file_size_mb ?? DEFAULT_MAX_SIZE_MB) * 1024 * 1024,
  }
}

/** True when the buffer starts with the `%PDF` signature. */
export function isPdf(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
}

/**
 * Download and validate a PDF. Throws (without writing anything) on a bad URL, non-2xx status,
 * timeout, oversize body, or a non-PDF body such as an HTML landing page. `label` prefixes the
 * error messages (e.g. "Open-access PDF").
 */
export async function downloadPdf(url: string, limits: DownloadLimits, label = 'PDF'): Promise<Uint8Array> {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error(`Invalid ${label} URL: ${url}`) }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported ${label} URL scheme: ${parsed.protocol}`)
  }

  const { timeoutMs, maxBytes } = limits
  let response: Response
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,*/*;q=0.8' },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: any) {
    if (err?.name === 'TimeoutError') throw new Error(`${label} download timed out after ${timeoutMs / 1000}s`)
    throw new Error(`${label} download failed: ${err?.message || err}`)
  }
  if (!response.ok) throw new Error(`${label} download failed: HTTP ${response.status}`)

  const tooLarge = () => new Error(`${label} exceeds max_file_size_mb (${maxBytes / 1024 / 1024} MB)`)
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge()

  const buf = new Uint8Array(await response.arrayBuffer())
  if (buf.length > maxBytes) throw tooLarge()
  if (!isPdf(buf)) {
    const type = response.headers.get('content-type') || 'unknown content-type'
    throw new Error(`${label} URL did not return a PDF (${type})`)
  }
  return buf
}

export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** Store `buf` as `data/pdfs/<prefix>_<sha8>.pdf` (idempotent for identical bytes); returns the relative path. */
export function writePdfFile(prefix: string, buf: Uint8Array): string {
  const filename = `${prefix}_${sha256(buf).slice(0, 8)}.pdf`
  const pdfDir = resolve(process.cwd(), 'data/pdfs')
  mkdirSync(pdfDir, { recursive: true })
  writeFileSync(resolve(pdfDir, filename), buf)
  return `data/pdfs/${filename}`
}

/** sha256 of a stored PDF (path relative to cwd), or null when the file is missing. */
export function fileSha256(relPath: string): string | null {
  const abs = resolve(process.cwd(), relPath)
  if (!existsSync(abs)) return null
  return sha256(readFileSync(abs))
}

export function removePdfFile(relPath: string): void {
  try { rmSync(resolve(process.cwd(), relPath), { force: true }) } catch {}
}

/**
 * Compare a newly stored PDF with the paper's current one. `unchanged` when the paths are equal
 * or the contents are byte-identical (the new duplicate file is then removed), else `changed`.
 */
export function comparePdf(currentPath: string, newPath: string): 'unchanged' | 'changed' {
  if (currentPath === newPath) return 'unchanged'
  const current = fileSha256(currentPath)
  if (current !== null && current === fileSha256(newPath)) {
    removePdfFile(newPath)
    return 'unchanged'
  }
  return 'changed'
}

function readJson(value: unknown): Record<string, any> {
  if (!value) return {}
  if (typeof value !== 'string') return value as Record<string, any>
  try { return JSON.parse(value) } catch { return {} }
}

/** Where a re-fetch downloads the paper's PDF from: arXiv → user PDF URL → S2 open-access link. */
export function pdfSourceService(paper: { arxiv_id: string | null; metadata: unknown }): PdfSourceService | null {
  if (paper.arxiv_id) return 'arxiv_pdf_service'
  const meta = readJson(paper.metadata)
  if (meta.pdf_url) return 'url_pdf_service'
  if (meta.open_access_pdf_url) return 's2_pdf_service'
  return null
}

/**
 * Drop the data derived from the previous PDF (in place): parsed text, doc2x parse id and
 * translation record. A paper that had doc2x output gets it re-requested for the new PDF, and
 * `derived_reset_at` lets the runner re-chain services whose earlier `done` runs used the old file.
 * The caller removes the doc2x output files (`removeDoc2xArtifacts`) after saving.
 */
export function invalidatePdfDerived(metadata: Record<string, any>, contents: Record<string, any>, now = new Date().toISOString()): void {
  const hadDoc2xParse = !!contents.doc2x_parsed || !!metadata.doc2x_parse_id
  const hadDoc2xTranslation = !!metadata.doc2x_translation
  delete contents.pdf_parsed
  delete contents.doc2x_parsed
  delete metadata.doc2x_parse_id
  delete metadata.doc2x_translation
  if (hadDoc2xParse) metadata.doc2x_parse_requested = true
  if (hadDoc2xTranslation) metadata.doc2x_translate_requested = true
  metadata.derived_reset_at = now
}

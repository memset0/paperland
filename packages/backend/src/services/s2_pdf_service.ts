import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { PaperBoundServiceDef } from './base_service.js'
import { getConfig } from '../config.js'

const SERVICE_NAME = 's2_pdf_service'
const DEFAULT_TIMEOUT_SEC = 60
const DEFAULT_MAX_SIZE_MB = 100
// Some repositories reject requests without a browser-like User-Agent.
const USER_AGENT = 'Mozilla/5.0 (compatible; Paperland/1.0; +https://www.semanticscholar.org)'

function getLimits(): { timeoutMs: number; maxBytes: number } {
  const svc = getConfig().services[SERVICE_NAME]
  return {
    timeoutMs: (svc?.download_timeout ?? DEFAULT_TIMEOUT_SEC) * 1000,
    maxBytes: (svc?.max_file_size_mb ?? DEFAULT_MAX_SIZE_MB) * 1024 * 1024,
  }
}

function readMetadata(paper: any): Record<string, any> {
  if (!paper?.metadata) return {}
  if (typeof paper.metadata !== 'string') return paper.metadata
  try { return JSON.parse(paper.metadata) } catch { return {} }
}

/** True when the buffer starts with the `%PDF` signature. */
function isPdf(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
}

/**
 * Download and validate an open-access PDF. Throws (without writing anything) on a
 * non-2xx status, timeout, oversize body, or a non-PDF body such as an HTML landing page.
 */
async function downloadOpenAccessPdf(url: string): Promise<Uint8Array> {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error(`Invalid open-access PDF URL: ${url}`) }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported open-access PDF URL scheme: ${parsed.protocol}`)
  }

  const { timeoutMs, maxBytes } = getLimits()
  let response: Response
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,*/*;q=0.8' },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: any) {
    if (err?.name === 'TimeoutError') throw new Error(`Open-access PDF download timed out after ${timeoutMs / 1000}s`)
    throw new Error(`Open-access PDF download failed: ${err?.message || err}`)
  }
  if (!response.ok) throw new Error(`Open-access PDF download failed: HTTP ${response.status}`)

  const tooLarge = () => new Error(`Open-access PDF exceeds max_file_size_mb (${maxBytes / 1024 / 1024} MB)`)
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge()

  const buf = new Uint8Array(await response.arrayBuffer())
  if (buf.length > maxBytes) throw tooLarge()
  if (!isPdf(buf)) {
    const type = response.headers.get('content-type') || 'unknown content-type'
    throw new Error(`Open-access URL did not return a PDF (${type})`)
  }
  return buf
}

/**
 * Downloads a paper's open-access PDF from the `open_access_pdf_url` that
 * semantic_scholar_service stores in metadata. Only for papers WITHOUT an arxiv_id
 * (arXiv papers use arxiv_pdf_service). `open_access_pdf_url` is in no service's
 * `produces`, so this service is chained by the runner's live-key re-trigger once
 * S2 writes the URL; closed-access papers never get the key and simply stay blocked.
 */
export const s2PdfService: PaperBoundServiceDef = {
  name: SERVICE_NAME,
  type: 'paper_bound',
  depends_on: ['open_access_pdf_url'],
  produces: ['pdf_path'],
  requires_listed: true, // PDF download deferred until the paper is added to the library
  eligible: (paper: any) => !paper.arxiv_id && !paper.pdf_path,

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    if (paper.arxiv_id) throw new Error('Paper has an arxiv_id; its PDF comes from arxiv_pdf_service')
    const url = readMetadata(paper).open_access_pdf_url
    if (!url) throw new Error('No open_access_pdf_url on paper')

    const buf = await downloadOpenAccessPdf(url)

    const pdfDir = resolve(process.cwd(), 'data/pdfs')
    mkdirSync(pdfDir, { recursive: true })
    const filename = paper.corpus_id ? `s2_${paper.corpus_id}.pdf` : `s2_paper_${paperId}.pdf`
    writeFileSync(resolve(pdfDir, filename), buf)
    return { pdf_path: `data/pdfs/${filename}` }
  },
}

// Exported for unit testing (mocked fetch).
export const __test__ = { downloadOpenAccessPdf, isPdf, getLimits }

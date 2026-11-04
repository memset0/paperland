import type { PaperBoundServiceDef } from './base_service.js'
import { downloadLimits, downloadPdf, isPdf, writePdfFile } from './pdf_store.js'

const SERVICE_NAME = 's2_pdf_service'

function getLimits() {
  return downloadLimits(SERVICE_NAME)
}

function readMetadata(paper: any): Record<string, any> {
  if (!paper?.metadata) return {}
  if (typeof paper.metadata !== 'string') return paper.metadata
  try { return JSON.parse(paper.metadata) } catch { return {} }
}

/**
 * Download and validate an open-access PDF. Throws (without writing anything) on a
 * non-2xx status, timeout, oversize body, or a non-PDF body such as an HTML landing page.
 */
function downloadOpenAccessPdf(url: string): Promise<Uint8Array> {
  return downloadPdf(url, getLimits(), 'Open-access PDF')
}

/**
 * Downloads a paper's open-access PDF from the `open_access_pdf_url` that
 * semantic_scholar_service stores in metadata. Only for papers WITHOUT an arxiv_id
 * (arXiv papers use arxiv_pdf_service) and without a user-supplied `pdf_url`
 * (url_pdf_service wins). `open_access_pdf_url` is in no service's `produces`, so this
 * service is chained by the runner's live-key re-trigger once S2 writes the URL;
 * closed-access papers never get the key and simply stay blocked.
 */
export const s2PdfService: PaperBoundServiceDef = {
  name: SERVICE_NAME,
  type: 'paper_bound',
  depends_on: ['open_access_pdf_url'],
  produces: ['pdf_path'],
  requires_listed: true, // PDF download deferred until the paper is added to the library
  eligible: (paper: any) => !paper.arxiv_id && !paper.pdf_path && !readMetadata(paper).pdf_url,

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    if (paper.arxiv_id) throw new Error('Paper has an arxiv_id; its PDF comes from arxiv_pdf_service')
    const url = readMetadata(paper).open_access_pdf_url
    if (!url) throw new Error('No open_access_pdf_url on paper')

    const buf = await downloadOpenAccessPdf(url)
    const prefix = paper.corpus_id ? `s2_${paper.corpus_id}` : `s2_paper_${paperId}`
    return { pdf_path: writePdfFile(prefix, buf), pdf_fetched_at: new Date().toISOString() }
  },
}

// Exported for unit testing (mocked fetch).
export const __test__ = { downloadOpenAccessPdf, isPdf, getLimits }

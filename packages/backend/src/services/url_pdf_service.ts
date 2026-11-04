import type { PaperBoundServiceDef } from './base_service.js'
import { downloadLimits, downloadPdf, writePdfFile } from './pdf_store.js'

const SERVICE_NAME = 'url_pdf_service'

function readMetadata(paper: any): Record<string, any> {
  if (!paper?.metadata) return {}
  if (typeof paper.metadata !== 'string') return paper.metadata
  try { return JSON.parse(paper.metadata) } catch { return {} }
}

/**
 * Downloads a paper's PDF from the user-supplied `metadata.pdf_url` — papers that are not on
 * arXiv, e.g. a project page's tech report. Same validation as the open-access download.
 * Takes precedence over `s2_pdf_service` (which skips papers with a `pdf_url`).
 */
export const urlPdfService: PaperBoundServiceDef = {
  name: SERVICE_NAME,
  type: 'paper_bound',
  depends_on: ['pdf_url'],
  produces: ['pdf_path'],
  requires_listed: true,
  eligible: (paper: any) => !paper.arxiv_id && !paper.pdf_path && !!readMetadata(paper).pdf_url,

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    const url = readMetadata(paper).pdf_url
    if (!url) throw new Error('No pdf_url on paper')
    const buf = await downloadPdf(url, downloadLimits(SERVICE_NAME), 'PDF')
    return { pdf_path: writePdfFile(`url_${paperId}`, buf), pdf_fetched_at: new Date().toISOString() }
  },
}

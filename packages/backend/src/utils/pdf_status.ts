/**
 * Derived PDF availability for the paper viewer: is a PDF available, still being fetched
 * by a service, or must the user upload one (and why)?
 */

export type PdfStatus = 'available' | 'fetching' | 'upload_required'
export type PdfUnavailableReason = 'closed_access' | 'download_failed' | 'not_found'

export interface PdfStatusInfo {
  pdf_status: PdfStatus
  pdf_unavailable_reason: PdfUnavailableReason | null
}

interface PaperLike {
  arxiv_id: string | null
  pdf_path: string | null
  metadata: string | Record<string, any> | null
}

interface ExecutionLike {
  service_name: string
  status: string
  created_at: string
  id?: number
}

const PDF_SERVICES = ['arxiv_pdf_service', 's2_pdf_service']
const ACTIVE = new Set(['pending', 'running'])

/** Latest execution status per service (by created_at, then id). */
function latestStatuses(executions: ExecutionLike[]): Map<string, string> {
  const sorted = [...executions].sort((a, b) =>
    a.created_at === b.created_at ? (a.id ?? 0) - (b.id ?? 0) : a.created_at < b.created_at ? -1 : 1)
  const latest = new Map<string, string>()
  for (const e of sorted) latest.set(e.service_name, e.status)
  return latest
}

export function derivePdfStatus(paper: PaperLike, executions: ExecutionLike[]): PdfStatusInfo {
  if (paper.pdf_path) return { pdf_status: 'available', pdf_unavailable_reason: null }

  const latest = latestStatuses(executions)
  const active = (name: string) => ACTIVE.has(latest.get(name) ?? '')
  // S2 enrichment may still discover an arxiv_id or an open-access PDF for non-arXiv papers.
  if (PDF_SERVICES.some(active) || (!paper.arxiv_id && active('semantic_scholar_service'))) {
    return { pdf_status: 'fetching', pdf_unavailable_reason: null }
  }

  if (PDF_SERVICES.some((name) => latest.get(name) === 'failed')) {
    return { pdf_status: 'upload_required', pdf_unavailable_reason: 'download_failed' }
  }

  let meta: Record<string, any> = {}
  if (typeof paper.metadata === 'string') {
    try { meta = JSON.parse(paper.metadata) } catch {}
  } else if (paper.metadata) {
    meta = paper.metadata
  }
  if (meta.open_access_pdf_status && !meta.open_access_pdf_url) {
    return { pdf_status: 'upload_required', pdf_unavailable_reason: 'closed_access' }
  }
  return { pdf_status: 'upload_required', pdf_unavailable_reason: 'not_found' }
}

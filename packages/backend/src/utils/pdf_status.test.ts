import { describe, it, expect } from 'bun:test'
import { derivePdfStatus } from './pdf_status.js'

const paper = (over: Record<string, any> = {}) => ({ arxiv_id: null, pdf_path: null, metadata: null, ...over })
const exec = (service_name: string, status: string, created_at = '2026-01-01T00:00:00Z', id = 1) =>
  ({ service_name, status, created_at, id })

describe('derivePdfStatus', () => {
  it('available when pdf_path is set', () => {
    expect(derivePdfStatus(paper({ pdf_path: 'data/pdfs/x.pdf' }), [exec('s2_pdf_service', 'failed')]))
      .toEqual({ pdf_status: 'available', pdf_unavailable_reason: null })
  })

  it('fetching while a PDF service runs', () => {
    expect(derivePdfStatus(paper(), [exec('s2_pdf_service', 'running')]).pdf_status).toBe('fetching')
    expect(derivePdfStatus(paper({ arxiv_id: '1' }), [exec('arxiv_pdf_service', 'pending')]).pdf_status).toBe('fetching')
  })

  it('fetching while S2 enrichment runs for a non-arXiv paper only', () => {
    expect(derivePdfStatus(paper(), [exec('semantic_scholar_service', 'running')]).pdf_status).toBe('fetching')
    expect(derivePdfStatus(paper({ arxiv_id: '1' }), [exec('semantic_scholar_service', 'running')]).pdf_status).toBe('upload_required')
  })

  it('download_failed when the latest PDF execution failed', () => {
    expect(derivePdfStatus(paper(), [exec('s2_pdf_service', 'failed')]))
      .toEqual({ pdf_status: 'upload_required', pdf_unavailable_reason: 'download_failed' })
  })

  it('uses the latest execution per service', () => {
    const execs = [exec('s2_pdf_service', 'failed', '2026-01-01T00:00:00Z', 1), exec('s2_pdf_service', 'running', '2026-01-02T00:00:00Z', 2)]
    expect(derivePdfStatus(paper(), execs).pdf_status).toBe('fetching')
  })

  it('closed_access when S2 reports a status but no open-access url', () => {
    const p = paper({ metadata: JSON.stringify({ open_access_pdf_status: 'CLOSED' }) })
    expect(derivePdfStatus(p, [exec('semantic_scholar_service', 'done'), exec('s2_pdf_service', 'blocked')]))
      .toEqual({ pdf_status: 'upload_required', pdf_unavailable_reason: 'closed_access' })
  })

  it('not_found otherwise', () => {
    expect(derivePdfStatus(paper(), []))
      .toEqual({ pdf_status: 'upload_required', pdf_unavailable_reason: 'not_found' })
  })
})

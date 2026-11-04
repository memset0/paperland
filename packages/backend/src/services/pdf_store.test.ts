import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadConfig } from '../config.js'
import { comparePdf, downloadLimits, downloadPdf, invalidatePdfDerived, pdfSourceService, writePdfFile } from './pdf_store.js'
import { urlPdfService } from './url_pdf_service.js'

// All network calls are mocked; files go to a temp cwd (never packages/backend/data).
const origCwd = process.cwd()
let workDir = ''
beforeAll(() => {
  loadConfig()
  workDir = mkdtempSync(join(tmpdir(), 'pdfstore-'))
  process.chdir(workDir)
})
afterAll(() => {
  process.chdir(origCwd)
  rmSync(workDir, { recursive: true, force: true })
})
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  rmSync(join(workDir, 'data'), { recursive: true, force: true })
})

const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.7\n${text}`)
function mockFetch(status: number, body: BodyInit, headers: Record<string, string> = {}) {
  const calls: string[] = []
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url))
    return new Response(body, { status, headers })
  }) as typeof fetch
  return calls
}
const limits = { timeoutMs: 1000, maxBytes: 1024 * 1024 }

describe('downloadPdf', () => {
  it('returns the bytes of a PDF', async () => {
    mockFetch(200, pdf('a'))
    expect((await downloadPdf('https://x.org/a.pdf', limits)).length).toBeGreaterThan(4)
  })
  it('rejects an HTML page', async () => {
    mockFetch(200, '<html></html>', { 'content-type': 'text/html' })
    await expect(downloadPdf('https://x.org/a', limits)).rejects.toThrow('did not return a PDF')
  })
  it('reports the HTTP status', async () => {
    mockFetch(403, 'no')
    await expect(downloadPdf('https://x.org/a.pdf', limits)).rejects.toThrow('HTTP 403')
  })
  it('rejects oversize bodies', async () => {
    mockFetch(200, pdf('x'.repeat(100)))
    await expect(downloadPdf('https://x.org/a.pdf', { timeoutMs: 1000, maxBytes: 10 })).rejects.toThrow('max_file_size_mb')
  })
  it('uses 60 s / 100 MB defaults for an unconfigured service', () => {
    expect(downloadLimits('no_such_service')).toEqual({ timeoutMs: 60_000, maxBytes: 100 * 1024 * 1024 })
  })
})

describe('writePdfFile / comparePdf', () => {
  it('names files by content hash and detects identical content', () => {
    const a = writePdfFile('p_1', pdf('same'))
    expect(a).toMatch(/^data\/pdfs\/p_1_[0-9a-f]{8}\.pdf$/)
    expect(writePdfFile('p_1', pdf('same'))).toBe(a)
    const b = writePdfFile('other', pdf('same'))
    expect(comparePdf(a, b)).toBe('unchanged')
    expect(existsSync(join(workDir, b))).toBe(false) // duplicate removed
    const c = writePdfFile('p_1', pdf('new version'))
    expect(c).not.toBe(a)
    expect(comparePdf(a, c)).toBe('changed')
    expect(existsSync(join(workDir, a))).toBe(true) // old file kept
  })
})

describe('pdfSourceService', () => {
  it('prefers arXiv, then the user PDF URL, then the open-access link', () => {
    expect(pdfSourceService({ arxiv_id: '1', metadata: JSON.stringify({ pdf_url: 'u' }) })).toBe('arxiv_pdf_service')
    expect(pdfSourceService({ arxiv_id: null, metadata: JSON.stringify({ pdf_url: 'u', open_access_pdf_url: 'o' }) })).toBe('url_pdf_service')
    expect(pdfSourceService({ arxiv_id: null, metadata: JSON.stringify({ open_access_pdf_url: 'o' }) })).toBe('s2_pdf_service')
    expect(pdfSourceService({ arxiv_id: null, metadata: null })).toBeNull()
  })
})

describe('invalidatePdfDerived', () => {
  it('drops derived data, keeps user input, and re-requests doc2x', () => {
    const meta: Record<string, any> = { doc2x_parse_id: 'op_1', doc2x_translation: { x: 1 }, citation_count: 3 }
    const contents: Record<string, any> = { pdf_parsed: 'a', doc2x_parsed: 'b', user_input: 'mine' }
    invalidatePdfDerived(meta, contents, '2026-10-15T00:00:00.000Z')
    expect(contents).toEqual({ user_input: 'mine' })
    expect(meta).toEqual({
      citation_count: 3, doc2x_parse_requested: true, doc2x_translate_requested: true, derived_reset_at: '2026-10-15T00:00:00.000Z',
    })
  })
  it('does not request doc2x for papers that never had it', () => {
    const meta: Record<string, any> = {}
    invalidatePdfDerived(meta, { pdf_parsed: 'a' })
    expect(meta.doc2x_parse_requested).toBeUndefined()
    expect(meta.doc2x_translate_requested).toBeUndefined()
  })
})

describe('urlPdfService', () => {
  it('declares pdf_url → pdf_path and is listed-only', () => {
    expect(urlPdfService.depends_on).toEqual(['pdf_url'])
    expect(urlPdfService.produces).toEqual(['pdf_path'])
    expect(urlPdfService.requires_listed).toBe(true)
    expect(urlPdfService.eligible!({ arxiv_id: null, pdf_path: null, metadata: '{"pdf_url":"https://x.org/a.pdf"}' })).toBe(true)
    expect(urlPdfService.eligible!({ arxiv_id: '1', pdf_path: null, metadata: '{"pdf_url":"https://x.org/a.pdf"}' })).toBe(false)
    expect(urlPdfService.eligible!({ arxiv_id: null, pdf_path: null, metadata: null })).toBe(false)
  })
  it('downloads the PDF URL into a hashed file', async () => {
    const calls = mockFetch(200, pdf('tech report'))
    const r = await urlPdfService.execute(9, { arxiv_id: null, metadata: '{"pdf_url":"https://x.org/tech_report.pdf"}' })
    expect(calls).toEqual(['https://x.org/tech_report.pdf'])
    expect(r.pdf_path).toMatch(/^data\/pdfs\/url_9_[0-9a-f]{8}\.pdf$/)
    expect(existsSync(join(workDir, r.pdf_path))).toBe(true)
  })
})

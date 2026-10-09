import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadConfig } from '../config.js'
import { __test__, s2PdfService } from './s2_pdf_service.js'

// All network calls are mocked — this test never hits a real PDF host.
// The service writes to `<cwd>/data/pdfs`, so run inside a temp dir (never packages/backend/data).
const origCwd = process.cwd()
let workDir = ''
beforeAll(() => {
  loadConfig()
  workDir = mkdtempSync(join(tmpdir(), 's2pdf-'))
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

const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n...fake pdf...')

function mockFetch(status: number, body: BodyInit, headers: Record<string, string> = {}) {
  const calls: string[] = []
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url))
    return new Response(body, { status, headers })
  }) as typeof fetch
  return calls
}

const corpusPaper = (meta: Record<string, any>) => ({
  arxiv_id: null,
  corpus_id: '123',
  pdf_path: null,
  metadata: JSON.stringify(meta),
})

describe('s2PdfService declaration', () => {
  it('depends on open_access_pdf_url, produces pdf_path, and is listed-only', () => {
    expect(s2PdfService.depends_on).toEqual(['open_access_pdf_url'])
    expect(s2PdfService.produces).toEqual(['pdf_path'])
    expect(s2PdfService.requires_listed).toBe(true)
  })

  it('is only eligible for papers without arxiv_id and without pdf_path', () => {
    expect(s2PdfService.eligible!({ arxiv_id: null, pdf_path: null })).toBe(true)
    expect(s2PdfService.eligible!({ arxiv_id: '1706.03762', pdf_path: null })).toBe(false)
    expect(s2PdfService.eligible!({ arxiv_id: null, pdf_path: 'data/pdfs/x.pdf' })).toBe(false)
  })
})

describe('s2PdfService.execute', () => {
  it('downloads a valid PDF and returns pdf_path', async () => {
    const calls = mockFetch(200, PDF_BYTES, { 'content-type': 'application/pdf' })
    const r = await s2PdfService.execute(7, corpusPaper({ open_access_pdf_url: 'https://example.org/p.pdf' }))
    expect(calls).toEqual(['https://example.org/p.pdf'])
    expect(r).toEqual({ pdf_path: 'data/pdfs/s2_123.pdf' })
    expect(readFileSync(join(workDir, 'data/pdfs/s2_123.pdf')).subarray(0, 4).toString()).toBe('%PDF')
  })

  it('fails on an HTML landing page and writes no file', async () => {
    mockFetch(200, '<!doctype html><html>landing</html>', { 'content-type': 'text/html' })
    await expect(s2PdfService.execute(7, corpusPaper({ open_access_pdf_url: 'https://example.org/landing' })))
      .rejects.toThrow('did not return a PDF')
    expect(existsSync(join(workDir, 'data/pdfs')) ? readdirSync(join(workDir, 'data/pdfs')) : []).toEqual([])
  })

  it('fails with the status code when the host blocks the request', async () => {
    mockFetch(403, 'Forbidden')
    await expect(s2PdfService.execute(7, corpusPaper({ open_access_pdf_url: 'https://example.org/p.pdf' })))
      .rejects.toThrow('HTTP 403')
  })

  it('fails when the declared size exceeds max_file_size_mb', async () => {
    const { maxBytes } = __test__.getLimits()
    mockFetch(200, PDF_BYTES, { 'content-length': String(maxBytes + 1) })
    await expect(s2PdfService.execute(7, corpusPaper({ open_access_pdf_url: 'https://example.org/p.pdf' })))
      .rejects.toThrow('max_file_size_mb')
  })

  it('rejects non-http(s) URLs without fetching', async () => {
    const calls = mockFetch(200, PDF_BYTES)
    await expect(s2PdfService.execute(7, corpusPaper({ open_access_pdf_url: 'file:///etc/passwd' })))
      .rejects.toThrow('scheme')
    expect(calls).toEqual([])
  })

  it('refuses papers that have an arxiv_id', async () => {
    const calls = mockFetch(200, PDF_BYTES)
    await expect(s2PdfService.execute(7, { ...corpusPaper({ open_access_pdf_url: 'https://example.org/p.pdf' }), arxiv_id: '1' }))
      .rejects.toThrow('arxiv_pdf_service')
    expect(calls).toEqual([])
  })
})

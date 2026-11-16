import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import Fastify, { type FastifyInstance } from 'fastify'
import { topicFixture } from '../testing/topic_fixture'
import { schema } from '../db/index'
import { loadConfig } from '../config'
import { mcpRoutes } from '../api/mcp'
import { createPersonalToken } from './api_tokens'
import { readPdfPage, readPdfText, setPdfPageDataRootForTesting } from './pdf_pages'
import { callAgentTool } from './agent_tools'
import { getConfig } from '../config'
import { AgentRichResult } from './agent_result'

let f: ReturnType<typeof topicFixture>, app: FastifyInstance, marker: string, token: string
beforeEach(async () => {
  f = topicFixture(); marker = join(f.root, 'rasterized')
  const data = join(f.root, 'data'); mkdirSync(data)
  const pdf = join(data, 'fixture.pdf'); writeFileSync(pdf, '%PDF fixture handled by local test doubles')
  f.db.update(schema.papers).set({ pdf_path: pdf }).where(eq(schema.papers.id, 10)).run()
  const commands: Record<string, string> = {
    pdfinfo: 'process.stdout.write("Pages: 2\\n")',
    pdftotext: `if (process.argv.includes("-f")) process.stdout.write("Physical page " + process.argv[process.argv.indexOf("-f")+1] + " text\\f"); else { require("node:fs").appendFileSync(${JSON.stringify(join('__ROOT__', 'whole-runs'))}.replace("__ROOT__", process.env.PDF_FAKE_ROOT), "x"); process.stdout.write("Rough page one\\fRough page two\\f") }`,
    pdftoppm: `require("node:fs").writeFileSync(${JSON.stringify(marker)},"yes");process.stdout.write(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=","base64"))`,
  }
  let extra = '\npdf_pages:\n'
  for (const [name, script] of Object.entries(commands)) {
    const file = join(f.root, name); writeFileSync(file, `#!${process.execPath}\n${script}\n`); chmodSync(file, 0o700)
    extra += `  ${name}_path: '${file}'\n`
  }
  const config = join(f.root, 'config.yml'); writeFileSync(config, readFileSync(config, 'utf8') + extra); loadConfig(config)
  setPdfPageDataRootForTesting(data)
  process.env.PDF_FAKE_ROOT = f.root
  token = createPersonalToken(1).token
  app = Fastify(); await app.register(mcpRoutes)
})
afterEach(async () => { setPdfPageDataRootForTesting(); await app.close(); f.close() })

describe('physical PDF page MCP (offline fake local executables)', () => {
  test('reads selected-page text and native reference without rasterizing', async () => {
    const result: any = await readPdfPage({ paper_id: 10, page: 2, max_chars: 8 })
    expect(result).toMatchObject({ paper_id: 10, page: 2, page_count: 2, text: 'Physical', next_offset: 8 })
    expect(result.markdown).toBe('[PDF page 2](paperland://paper/10?pdf=2)')
    expect(existsSync(marker)).toBe(false)
  })
  test('returns a real MCP image block and complete region citation only on explicit request', async () => {
    const response = await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${token}` }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_pdf_page', arguments: { paper_id: 10, page: 2, image: true, region: { x: 0.1, y: 0.2, width: 0.3, height: 0.15 } } } } })
    const result = response.json().result
    expect(result.isError).toBe(false)
    expect(result.content[1]).toMatchObject({ type: 'image', mimeType: 'image/png' })
    expect(JSON.parse(result.content[0].text).markdown).toBe('[PDF region 2](paperland://paper/10?pdf=2&rx=0.1&ry=0.2&rw=0.3&rh=0.15)')
    expect(existsSync(marker)).toBe(true)
  })
  test('rejects bad pages, coordinates, missing PDFs and path escapes without rasterizing', async () => {
    await expect(readPdfPage({ paper_id: 10, page: 0 })).rejects.toThrow()
    await expect(readPdfPage({ paper_id: 10, page: 3 })).rejects.toThrow('between 1 and 2')
    await expect(readPdfPage({ paper_id: 10, page: 1, region: { x: 0.9, y: 0, width: 0.5, height: 1 } })).rejects.toThrow()
    await expect(readPdfPage({ paper_id: 999, page: 1 })).rejects.toThrow('no local PDF')
    f.db.update(schema.papers).set({ pdf_path: join(f.root, 'config.yml') }).where(eq(schema.papers.id, 10)).run()
    await expect(readPdfPage({ paper_id: 10, page: 1 })).rejects.toThrow('unavailable')
    expect(existsSync(marker)).toBe(false)
  })
})

describe('read_paper fallback and readiness (offline fake local executables)', () => {
  const read = async (args: Record<string, unknown>) => {
    const res = await callAgentTool('read_paper', args, { viewer: { id: 1, role: 'user' } })
    expect(res.isError).toBe(false)
    return JSON.parse(res.text)
  }
  const runs = () => existsSync(join(f.root, 'whole-runs')) ? readFileSync(join(f.root, 'whole-runs'), 'utf8').length : 0
  const setContents = (contents: Record<string, string> | null) =>
    f.db.update(schema.papers).set({ contents: contents ? JSON.stringify(contents) : null }).where(eq(schema.papers.id, 10)).run()
  const doc2x = (enabled: boolean) => { getConfig().doc2x.enabled = enabled; getConfig().doc2x.auto_since = undefined as any }

  test('readPdfText extracts the whole PDF once per version and reports missing PDFs', async () => {
    expect(await readPdfText(10)).toBe('Rough page one\n\nRough page two')
    await readPdfText(10)
    expect(runs()).toBe(1)
    await expect(readPdfText(999)).rejects.toThrow('no local PDF')
  })

  test('rough on-the-fly text while nothing is stored, with doc2x pending and a re-check note', async () => {
    doc2x(true)
    const page = await read({ paper_id: 10, max_chars: 5 })
    expect(page).toMatchObject({ source: 'pdf_text', precision: 'rough', precise_pending: true, text: 'Rough', next_offset: 5 })
    expect(page.note).toContain('precise version is being parsed')
    expect(page.note).toContain('next question')
    await read({ paper_id: 10, offset: 5 })
    expect(runs()).toBe(1)
  })

  test('stored rough text is labeled; a failed doc2x run is no longer pending; precise text has no note', async () => {
    doc2x(true)
    setContents({ pdf_parsed: 'unpdf text' })
    expect(await read({ paper_id: 10 })).toMatchObject({ source: 'pdf_parsed', precision: 'rough', precise_pending: true, text: 'unpdf text' })
    f.db.insert(schema.serviceExecutions).values({ paper_id: 10, service_name: 'doc2x_parse', status: 'failed', created_at: f.now }).run()
    const failed = await read({ paper_id: 10 })
    expect(failed.precise_pending).toBe(false)
    expect(failed.note).not.toContain('precise version')
    setContents({ pdf_parsed: 'unpdf text', doc2x_parsed: '# Precise' })
    const precise = await read({ paper_id: 10 })
    expect(precise).toMatchObject({ source: 'doc2x_parsed', precision: 'precise', precise_pending: false })
    expect(precise.note).toBeUndefined()
    expect(runs()).toBe(0)
  })

  test('without text or PDF the result is a non-error not_ready with arXiv links and get_paper reports readiness', async () => {
    doc2x(false)
    f.db.update(schema.papers).set({ pdf_path: null, arxiv_id: '1706.03762', abstract: 'An abstract' }).where(eq(schema.papers.id, 10)).run()
    const res = await read({ paper_id: 10 })
    expect(res).toMatchObject({ status: 'not_ready', text: null, abstract: 'An abstract', arxiv_html: 'https://arxiv.org/html/1706.03762', arxiv_abs: 'https://arxiv.org/abs/1706.03762', precise_pending: false })
    expect(res.pdf_status).toBeDefined()
    expect(res.note).toContain('next question')
    const meta = JSON.parse((await callAgentTool('get_paper', { paper_id: 10 }, { viewer: { id: 1, role: 'user' } })).text)
    expect(meta).toMatchObject({ full_text: null, precise_pending: false })
    expect(meta.pdf_status).toBeDefined()
  })
})

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
import { readPdfPage, setPdfPageDataRootForTesting } from './pdf_pages'
import { AgentRichResult } from './agent_result'

let f: ReturnType<typeof topicFixture>, app: FastifyInstance, marker: string, token: string
beforeEach(async () => {
  f = topicFixture(); marker = join(f.root, 'rasterized')
  const data = join(f.root, 'data'); mkdirSync(data)
  const pdf = join(data, 'fixture.pdf'); writeFileSync(pdf, '%PDF fixture handled by local test doubles')
  f.db.update(schema.papers).set({ pdf_path: pdf }).where(eq(schema.papers.id, 10)).run()
  const commands: Record<string, string> = {
    pdfinfo: 'process.stdout.write("Pages: 2\\n")',
    pdftotext: 'process.stdout.write("Physical page " + process.argv[process.argv.indexOf("-f")+1] + " text\\f")',
    pdftoppm: `require("node:fs").writeFileSync(${JSON.stringify(marker)},"yes");process.stdout.write(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=","base64"))`,
  }
  let extra = '\npdf_pages:\n'
  for (const [name, script] of Object.entries(commands)) {
    const file = join(f.root, name); writeFileSync(file, `#!${process.execPath}\n${script}\n`); chmodSync(file, 0o700)
    extra += `  ${name}_path: '${file}'\n`
  }
  const config = join(f.root, 'config.yml'); writeFileSync(config, readFileSync(config, 'utf8') + extra); loadConfig(config)
  setPdfPageDataRootForTesting(data)
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

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { doc2xRoutes } from './doc2x.js'

let dir = ''
let sqlite: Database
let app: FastifyInstance
let authenticated = true
let runs: string[] = []

function writeConfig(enabled: boolean) {
  const file = join(dir, `config-${enabled}.yml`)
  writeFileSync(file, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: true }
models:
  default: m
  available:
    - { name: m, type: openai_api, endpoint: https://example.test/v1 }
content_priority: [user_input, doc2x_parsed, pdf_parsed]
qa:
  - { name: summary, prompt: Summary }
translation: { prompt: 'Translate {TEXT}' }
doc2x: { enabled: ${enabled} }
`, 'utf8')
  loadConfig(file)
}

function insertPaper(id: number, fields: { contents?: object; metadata?: object; pdf_path?: string | null } = {}) {
  sqlite.query(`INSERT INTO papers (id, title, authors, contents, pdf_path, metadata, created_at, updated_at)
    VALUES (?, 'P', '[]', ?, ?, ?, '2026-01-01', '2026-01-01')`).run(
    id, JSON.stringify(fields.contents ?? { pdf_parsed: 'text' }),
    fields.pdf_path === undefined ? 'data/pdfs/p.pdf' : fields.pdf_path, JSON.stringify(fields.metadata ?? {}),
  )
}

function insertExec(paperId: number, service: string, status: string, finishedAt: string | null = null, error: string | null = null) {
  sqlite.query(`INSERT INTO service_executions (service_name, paper_id, status, progress, created_at, finished_at, error)
    VALUES (?, ?, ?, 0, '2026-01-01T00:00:00Z', ?, ?)`).run(service, paperId, status, finishedAt, error)
}

const get = async (id: number) => (await app.inject({ method: 'GET', url: `/api/papers/${id}/doc2x` })).json()
const post = (id: number, action: 'parse' | 'translate') => app.inject({ method: 'POST', url: `/api/papers/${id}/doc2x/${action}` })

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'paperland-doc2x-api-test-'))
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = authenticated ? { id: 1, username: 'admin', role: 'admin' } as any : null
  })
  await app.register(doc2xRoutes, { runService: (name: string, paperId: number) => { runs.push(`${name}:${paperId}`) } })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  writeConfig(true)
  authenticated = true
  runs = []
  sqlite?.close()
  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE service_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
      status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
      finished_at TEXT, result TEXT, error TEXT
    );
    CREATE TABLE papers (
      id INTEGER PRIMARY KEY, arxiv_id TEXT, corpus_id TEXT, s2_paper_id TEXT, title TEXT NOT NULL, authors TEXT NOT NULL,
      abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT, tags_json TEXT,
      listed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `)
  setDatabaseForTesting(drizzle(sqlite, { schema }))
})

describe('GET /api/papers/:id/doc2x', () => {
  test('mechanical-only paper needs QA confirmation', async () => {
    insertPaper(1)
    const s = await get(1)
    expect(s).toMatchObject({ enabled: true, has_pdf: true, qa_source: 'pdf_parsed', qa_needs_confirm: true })
    expect(s.parse.status).toBe('none')
    expect(s.translate.status).toBe('idle')
  })

  test('doc2x text or user input removes the confirmation', async () => {
    insertPaper(1, { contents: { pdf_parsed: 't', doc2x_parsed: 'md' } })
    insertPaper(2, { contents: { user_input: 'u' } })
    expect(await get(1)).toMatchObject({
      qa_source: 'doc2x_parsed', qa_needs_confirm: false, parse: { status: 'done' },
      text_sources: { pdf_parsed: true, doc2x_parsed: true },
    })
    expect((await get(2)).qa_needs_confirm).toBe(false)
  })

  test('disabled doc2x never asks for confirmation', async () => {
    writeConfig(false)
    insertPaper(1)
    expect((await get(1)).qa_needs_confirm).toBe(false)
  })

  test('404 for unknown paper', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/papers/99/doc2x' })).statusCode).toBe(404)
  })
})

describe('POST /api/papers/:id/doc2x/parse', () => {
  test('starts a parse and rejects duplicates while running', async () => {
    insertPaper(1)
    const res = await post(1, 'parse')
    expect(res.statusCode).toBe(202)
    expect(runs).toEqual(['doc2x_parse:1'])
    insertExec(1, 'doc2x_parse', 'running')
    expect((await post(1, 'parse')).statusCode).toBe(409)
  })

  test('retries after failure; 422 without PDF; 401 when anonymous', async () => {
    insertPaper(1)
    insertExec(1, 'doc2x_parse', 'failed', '2026-01-02T00:00:00Z', 'boom')
    expect((await get(1)).parse).toMatchObject({ status: 'failed', error: 'boom' })
    expect((await post(1, 'parse')).statusCode).toBe(202)
    insertPaper(2, { pdf_path: null })
    expect((await post(2, 'parse')).statusCode).toBe(422)
    authenticated = false
    expect((await post(1, 'parse')).statusCode).toBe(401)
  })
})

describe('POST /api/papers/:id/doc2x/translate', () => {
  test('queues behind a running parse and rejects a second request', async () => {
    insertPaper(1)
    insertExec(1, 'doc2x_parse', 'running')
    const res = await post(1, 'translate')
    expect(res.statusCode).toBe(202)
    expect(res.json().translate.status).toBe('queued')
    expect(runs).toEqual([]) // waits for the dependency graph
    expect((await post(1, 'translate')).statusCode).toBe(409)
  })

  test('old paper without parse starts the parse first', async () => {
    insertPaper(1)
    expect((await post(1, 'translate')).statusCode).toBe(202)
    expect(runs).toEqual(['doc2x_parse:1'])
  })

  test('parsed paper starts translation immediately; done blocks re-requests', async () => {
    insertPaper(1, { contents: { doc2x_parsed: 'md' } })
    expect((await post(1, 'translate')).statusCode).toBe(202)
    expect(runs).toEqual(['doc2x_translate:1'])
    insertPaper(2, { contents: { doc2x_parsed: 'md' }, metadata: { doc2x_translation: { bilingual_pdf_path: 'b.pdf', translated_pdf_path: 't.pdf' } } })
    const s = await get(2)
    expect(s.translate).toMatchObject({ status: 'done', bilingual_pdf_path: 'b.pdf', translated_pdf_path: 't.pdf' })
    expect((await post(2, 'translate')).statusCode).toBe(409)
  })

  test('failed translation can be retried and shows queued until the new run starts', async () => {
    insertPaper(1, { contents: { doc2x_parsed: 'md' }, metadata: { doc2x_translate_requested: '2026-01-01T00:00:00Z' } })
    insertExec(1, 'doc2x_translate', 'failed', '2026-01-02T00:00:00Z', 'quota')
    expect((await get(1)).translate).toMatchObject({ status: 'failed', error: 'quota' })
    const res = await post(1, 'translate')
    expect(res.statusCode).toBe(202)
    expect(res.json().translate.status).toBe('queued')
    expect(runs).toEqual(['doc2x_translate:1'])
  })

  test('request stuck behind a failed parse can be re-submitted', async () => {
    insertPaper(1, { metadata: { doc2x_translate_requested: '2026-01-01T00:00:00Z' } })
    insertExec(1, 'doc2x_parse', 'failed', '2026-01-02T00:00:00Z', 'boom')
    expect((await get(1)).translate.status).toBe('queued')
    expect((await post(1, 'translate')).statusCode).toBe(202)
    expect(runs).toEqual(['doc2x_parse:1'])
  })
})

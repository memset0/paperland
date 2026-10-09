import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { tmpdir } from 'os'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { serviceRunner } from '../services/service_runner.js'
import { qaRoutes } from './qa.js'

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
const CITE_KNOWN = 'aaaa000000000000000000000000000000000000'
const CITE_UNKNOWN = 'ffff000000000000000000000000000000000000'
let fixtureDir = ''
let sqlite: Database
let app: FastifyInstance
// Finished answers warm the S2 metadata cache in the background; S2 is always mocked here.
const realFetch = globalThis.fetch
let s2Mode: 'ok' | 'down' = 'ok'
let s2Batches: string[][] = []

async function waitFor(predicate: () => boolean, timeoutMs = 3000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for QA results')
    await Bun.sleep(5)
  }
}

const doneCount = (entryId: number) =>
  (sqlite.query(`SELECT count(*) c FROM qa_results WHERE qa_entry_id = ${entryId} AND status = 'done'`).get() as any).c

beforeAll(() => { fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-qa-contextual-')) })
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }))

beforeEach(async () => {
  const configPath = join(fixtureDir, `config-${Math.random().toString(16).slice(2)}.yml`)
  writeFileSync(configPath, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: false }
services:
  qa: { max_concurrency: 4, rate_limit_interval: 0 }
models:
  default: vision-qa
  available:
    - name: vision-qa
      type: codex
      shell: "printf 'answer [Known](#cite:${CITE_KNOWN}) [Ghost](#cite:${CITE_UNKNOWN})'"
      timeout: 5
      vision: true
    - name: text-qa
      type: codex
      shell: "printf 'text answer'"
      timeout: 5
content_priority: [user_input, pdf_parsed]
qa:
  - { name: summary, prompt: Summary }
translation: { prompt: 'Translate {TEXT}' }
image_host: { dir: ${fixtureDir} }
`, 'utf8')
  loadConfig(configPath)
  serviceRunner.initialize()
  s2Mode = 'ok'
  s2Batches = []
  globalThis.fetch = (async (_url: unknown, init: any) => {
    if (s2Mode === 'down') return new Response('unavailable', { status: 403 })
    const ids: string[] = JSON.parse(init.body).ids
    s2Batches.push(ids)
    return new Response(JSON.stringify(ids.map((id) => ({ paperId: id, externalIds: {}, title: `Title ${id.slice(0, 4)}` }))))
  }) as typeof fetch

  sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  setDatabaseForTesting(db)
  sqlite.exec(`
    INSERT INTO users (id, username, password_hash, role, created_at) VALUES
      (1, 'alice', 'x', 'user', 'now'), (2, 'bob', 'x', 'user', 'now');
    INSERT INTO papers (id, title, authors, contents, created_at, updated_at) VALUES
      (42, 'Paper', '[]', '{"user_input":"FULL PAPER TEXT"}', 'now', 'now'),
      (43, 'Empty', '[]', '{}', 'now', 'now');
    INSERT INTO paper_citations (paper_id, direction, s2_paper_id, title, authors, created_at)
      VALUES (42, 'reference', '${CITE_KNOWN}', 'Known Ref', '["A"]', 'now');
    INSERT INTO images (hash, ext, mime, size, path, created_at) VALUES ('abc123', 'png', 'image/png', 3, 'shot.png', 'now');
  `)
  writeFileSync(join(fixtureDir, 'shot.png'), Buffer.from([1, 2, 3]))

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 1)
    request.user = id === 2 ? { id: 2, username: 'bob', role: 'user' } : { id: 1, username: 'alice', role: 'user' }
  })
  await app.register(qaRoutes)
})

afterEach(async () => {
  globalThis.fetch = realFetch
  await app.close()
  sqlite.close()
})

async function ask(payload: Record<string, unknown>, user = '1', paper = 42) {
  return app.inject({ method: 'POST', url: `/api/papers/${paper}/qa/free`, payload, headers: { 'x-test-user': user } })
}

async function askAndWait(payload: Record<string, unknown>, user = '1') {
  const response = await ask(payload, user)
  expect(response.statusCode).toBe(200)
  const body = response.json()
  await waitFor(() => doneCount(body.entry_id) === body.runs.length)
  return body
}

describe('contextual free Q&A creation', () => {
  test('a plain question still works and stores no inputs', async () => {
    const body = await askAndWait({ question: 'Plain?' })
    const entry = sqlite.query(`SELECT instruction, inputs, parent_entry_id FROM qa_entries WHERE id = ${body.entry_id}`).get()
    expect(entry).toEqual({ instruction: null, inputs: null, parent_entry_id: null })
  })

  test('passages and screenshots get labels, image URLs come from the image host', async () => {
    const body = await askAndWait({
      question: '@Quote1 vs @Image1',
      models: ['vision-qa'],
      inputs: [
        { kind: 'text_selection', label: 'Quote1', text: 'Passage', pdf: [{ page: 3, ts: 1, te: 8 }] },
        { kind: 'image', label: 'Image1', image_hash: 'abc123', url: 'https://evil.example/x.png', pdf: { page: 4, rx: 0, ry: 0, rw: 0.5, rh: 0.5 } },
      ],
    })
    expect(body.inputs).toEqual([
      { kind: 'text_selection', label: 'Quote1', text: 'Passage', pdf: [{ page: 3, ts: 1, te: 8 }] },
      { kind: 'image', label: 'Image1', image_hash: 'abc123', url: '/image/shot.png', pdf: { page: 4, rx: 0, ry: 0, rw: 0.5, rh: 0.5 } },
    ])
  })

  test('rejects images outside the image host and non-vision models for images', async () => {
    const external = await ask({ question: 'q', inputs: [{ kind: 'image', image_hash: 'zzzzzz', pdf: null }] })
    expect(external.statusCode).toBe(400)
    const unknown = await ask({ question: 'q', inputs: [{ kind: 'image', image_hash: 'abcdef', pdf: null }] })
    expect(unknown.json().error.code).toBe('IMAGE_NOT_IN_HOST')
    const textOnly = await ask({ question: 'q', models: ['text-qa'], inputs: [{ kind: 'image', image_hash: 'abc123', pdf: null }] })
    expect(textOnly.json().error.code).toBe('MODEL_NOT_VISION')
    expect((sqlite.query('SELECT count(*) c FROM qa_entries').get() as any).c).toBe(0)
  })

  test('a direct ask uses the configured question and the default model only', async () => {
    const body = await askAndWait({
      direct_ask: true, question: 'ignored', models: ['text-qa'],
      inputs: [{ kind: 'text_selection', text: 'Passage', pdf: [{ page: 2, ts: 0, te: 7 }] }],
    })
    expect(body.question).toBe('@Quote1 Explain this in detail in an easy-to-understand way, using bullet points.')
    expect(body.models).toEqual(['vision-qa'])
    expect((await ask({ direct_ask: true, inputs: [] })).statusCode).toBe(400)
  })

  test('papers without full text cannot be asked', async () => {
    expect((await ask({ question: 'q' }, '1', 43)).statusCode).toBe(409)
    const preset = await app.inject({ method: 'POST', url: '/api/papers/43/qa/template', headers: { 'x-test-user': '1' } })
    expect(preset.statusCode).toBe(409)
  })

  test('multi-model submissions create the first-listed model last', async () => {
    const body = await askAndWait({ question: 'Order?', models: ['vision-qa', 'text-qa'] })
    const [first, second] = body.runs
    expect(first.model_name).toBe('vision-qa')
    expect(first.result_id).toBeGreaterThan(second.result_id)
  })
})

describe('follow-ups', () => {
  test('continue a finished answer, inherit chain labels, and record the parent entry', async () => {
    const root = await askAndWait({
      question: '@Image1?', inputs: [{ kind: 'image', label: 'Image1', image_hash: 'abc123', pdf: null }],
    })
    const child = await askAndWait({
      question: 'And @Image2 vs @Image1?',
      inputs: [{ kind: 'history', result_id: root.runs[0].result_id }, { kind: 'image', label: 'Image1', image_hash: 'abc123', pdf: null }],
    })
    expect(child.inputs.map((input: any) => input.label ?? input.kind)).toEqual(['history', 'Image2'])
    expect(child.question).toBe('And @Image2 vs @Image1?')
    expect((sqlite.query(`SELECT parent_entry_id p FROM qa_entries WHERE id = ${child.entry_id}`).get() as any).p).toBe(root.entry_id)

    const view = (await app.inject({ method: 'GET', url: `/api/qa/results/${child.runs[0].result_id}/model-input` })).json().data
    expect(view.paper).toEqual({ source: 'user_input', length: 'FULL PAPER TEXT'.length })
    expect(JSON.stringify(view)).not.toContain('FULL PAPER TEXT')
    expect(view.history).toContain('[User] @Image1?')
    expect(view.inputs.map((input: any) => input.label)).toEqual(['Image1', 'Image2'])
    expect(view.system_prompt_name).toBe('paper-qa')
  })

  test('cannot continue an unfinished, hidden, or deleted answer', async () => {
    const root = await askAndWait({ question: 'Root' })
    const resultId = root.runs[0].result_id
    sqlite.exec(`UPDATE qa_results SET status = 'streaming' WHERE id = ${resultId}`)
    expect((await ask({ question: 'f', inputs: [{ kind: 'history', result_id: resultId }] })).statusCode).toBe(409)
    sqlite.exec(`UPDATE qa_results SET status = 'done' WHERE id = ${resultId}`)

    sqlite.exec("INSERT INTO user_sharing_settings (user_id, data_type, shared, updated_at) VALUES (1, 'qa', 0, 'now')")
    expect((await ask({ question: 'f', inputs: [{ kind: 'history', result_id: resultId }] }, '2')).statusCode).toBe(404)
    sqlite.exec("DELETE FROM user_sharing_settings")

    const shared = await askAndWait({ question: 'Bob follows', inputs: [{ kind: 'history', result_id: resultId }] }, '2')
    expect((sqlite.query(`SELECT user_id u FROM qa_entries WHERE id = ${shared.entry_id}`).get() as any).u).toBe(2)

    await app.inject({ method: 'DELETE', url: `/api/qa/results/${resultId}` })
    expect((await ask({ question: 'f', inputs: [{ kind: 'history', result_id: resultId }] })).statusCode).toBe(404)
  })

  test('a deleted or unshared parent still feeds the follow-up history', async () => {
    const root = await askAndWait({ question: 'Root question' })
    const child = await askAndWait({ question: 'Bob asks', inputs: [{ kind: 'history', result_id: root.runs[0].result_id }] }, '2')
    await app.inject({ method: 'DELETE', url: `/api/qa/results/${root.runs[0].result_id}` })
    sqlite.exec("INSERT INTO user_sharing_settings (user_id, data_type, shared, updated_at) VALUES (1, 'qa', 0, 'now')")

    const view = (await app.inject({ method: 'GET', url: `/api/qa/results/${child.runs[0].result_id}/model-input`, headers: { 'x-test-user': '2' } })).json().data
    expect(view.history).toContain('[User] Root question')

    const retry = await app.inject({ method: 'POST', url: `/api/qa/${child.entry_id}/regenerate`, payload: {}, headers: { 'x-test-user': '2' } })
    expect(retry.statusCode).toBe(200)

    const tree = (await app.inject({ method: 'GET', url: `/api/qa/entries/${child.entry_id}/tree`, headers: { 'x-test-user': '2' } })).json().data
    expect(tree).toMatchObject({ entry_id: root.entry_id, state: 'hidden', entry: null })
    expect(tree.children[0]).toMatchObject({ entry_id: child.entry_id, state: 'visible', parent_result_id: root.runs[0].result_id })
  })
})

describe('soft delete, links, and citations', () => {
  test('a deleted result disappears from reads but its row remains', async () => {
    const body = await askAndWait({ question: 'Delete me', models: ['vision-qa', 'text-qa'] })
    const [kept, removed] = body.runs.map((run: any) => run.result_id)
    expect((await app.inject({ method: 'DELETE', url: `/api/qa/results/${removed}` })).statusCode).toBe(200)

    const list = (await app.inject({ method: 'GET', url: '/api/papers/42/qa' })).json()
    expect(list.free[0].results.map((result: any) => result.id)).toEqual([kept])
    expect((await app.inject({ method: 'GET', url: `/api/qa/results/${removed}/stream` })).statusCode).toBe(404)
    expect((sqlite.query(`SELECT deleted_at IS NOT NULL d FROM qa_results WHERE id = ${removed}`).get() as any).d).toBe(1)

    const located = (await app.inject({ method: 'GET', url: `/api/qa/entries/${body.entry_id}/locate?result=${removed}` })).json()
    expect(located.state).toBe('deleted')
  })

  test('QA links resolve by entry id, regardless of the link paper id', async () => {
    const body = await askAndWait({ question: 'Locate' })
    const located = (await app.inject({ method: 'GET', url: `/api/qa/entries/${body.entry_id}/locate` })).json()
    expect(located).toMatchObject({ state: 'visible', entry_id: body.entry_id, paper_id: 42 })
    sqlite.exec("INSERT INTO user_sharing_settings (user_id, data_type, shared, updated_at) VALUES (1, 'qa', 0, 'now')")
    const hidden = (await app.inject({ method: 'GET', url: `/api/qa/entries/${body.entry_id}/locate`, headers: { 'x-test-user': '2' } })).json()
    expect(hidden).toEqual({ state: 'hidden' })
  })

  test('a relabelled new input retargets its own tokens', async () => {
    const body = await askAndWait({ question: 'See @Quote9', inputs: [{ kind: 'text_selection', label: 'Bad label', text: 't', pdf: [{ page: 1, ts: 0, te: 1 }] }] })
    expect(body.inputs[0].label).toBe('Quote1')
  })

  test('a finished answer warms the S2 cache for all of its #cite ids', async () => {
    await askAndWait({ question: 'Cite', models: ['vision-qa'] })
    const cached = () => sqlite.query("SELECT s2_paper_id FROM s2_papers WHERE status = 'ok' ORDER BY s2_paper_id").all()
    await waitFor(() => cached().length === 2)
    expect(cached()).toEqual([{ s2_paper_id: CITE_KNOWN }, { s2_paper_id: CITE_UNKNOWN }])
    expect(s2Batches).toEqual([[CITE_KNOWN, CITE_UNKNOWN]])
  })

  test('a failing S2 warm-up does not affect the finished answer', async () => {
    s2Mode = 'down'
    const body = await askAndWait({ question: 'Cite', models: ['vision-qa'] })
    await Bun.sleep(50)
    expect(doneCount(body.entry_id)).toBe(1)
    expect((sqlite.query('SELECT count(*) c FROM s2_papers').get() as any).c).toBe(0)
  })

  test('list entries carry contextual fields and follow-up counts', async () => {
    const root = await askAndWait({ question: 'Root' })
    await askAndWait({ question: 'Child', inputs: [{ kind: 'history', result_id: root.runs[0].result_id }] })
    const feed = (await app.inject({ method: 'GET', url: '/api/qa/free' })).json().data
    const rootEntry = feed.find((entry: any) => entry.entry_id === root.entry_id)
    expect(rootEntry).toMatchObject({ instruction: null, inputs: [], parent_entry_id: null, followup_count: 1 })
  })

})

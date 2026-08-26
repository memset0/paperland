import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { qaRoutes } from './qa.js'
import { highlightsRoutes } from './highlights.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { markdownContentHash } from '../services/content_hash.js'
import { runQA } from './qa.js'

let sqlite: Database
let app: FastifyInstance

beforeEach(async () => {
  sqlite = new Database(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE papers (id INTEGER PRIMARY KEY, title TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE qa_entries (
      id INTEGER PRIMARY KEY, paper_id INTEGER NOT NULL, user_id INTEGER, type TEXT NOT NULL,
      template_name TEXT, prompt TEXT, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE qa_results (
      id INTEGER PRIMARY KEY, qa_entry_id INTEGER NOT NULL, prompt TEXT NOT NULL, answer TEXT NOT NULL,
      model_name TEXT NOT NULL, completed_at TEXT NOT NULL, execution_id INTEGER, content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'done', error TEXT, requested_by_user_id INTEGER,
      streaming_capable INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '',
      started_at TEXT, first_chunk_at TEXT, finished_at TEXT, updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE qa_user_preferences (
      user_id INTEGER NOT NULL, qa_entry_id INTEGER NOT NULL, background_color TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, qa_entry_id)
    );
    CREATE TABLE service_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
      status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
      finished_at TEXT, result TEXT, error TEXT
    );
    CREATE TABLE highlights (
      id INTEGER PRIMARY KEY, user_id INTEGER, pathname TEXT NOT NULL, content_hash TEXT NOT NULL,
      qa_result_id INTEGER, start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL,
      text TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, paper_id INTEGER NOT NULL, body TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0, is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );

    INSERT INTO users VALUES (1,'alice','user'),(2,'bob','user'),(3,'admin','admin');
    INSERT INTO papers VALUES (42,'Test Paper','2026-08-24T00:00:00Z');
    INSERT INTO qa_entries VALUES
      (10,42,1,'free',NULL,'Alice question','done',NULL,'2026-08-24T00:03:00Z'),
      (20,42,2,'free',NULL,'Bob question','done',NULL,'2026-08-24T00:02:00Z'),
      (30,42,NULL,'template','summary','Preset question','done',NULL,'2026-08-24T00:01:00Z');
  `)
  const hashA = markdownContentHash('Alice answer')
  const hashB = markdownContentHash('Bob answer')
  const insertResult = sqlite.query(`
    INSERT INTO qa_results (id,qa_entry_id,prompt,answer,model_name,completed_at,execution_id,content_hash,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `)
  insertResult.run(101, 10, 'Alice question', 'Alice answer', 'model-a', '2026-08-24T00:04:00Z', 1001, hashA, '2026-08-24T00:04:00Z', '2026-08-24T00:04:00Z')
  insertResult.run(102, 20, 'Bob question', 'Bob answer', 'model-b', '2026-08-24T00:05:00Z', 1002, hashB, '2026-08-24T00:05:00Z', '2026-08-24T00:05:00Z')
  insertResult.run(103, 30, 'Preset question', 'Preset answer', 'model-a', '2026-08-24T00:06:00Z', 1003, markdownContentHash('Preset answer'), '2026-08-24T00:06:00Z', '2026-08-24T00:06:00Z')
  sqlite.query('INSERT INTO highlights VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(1, 1, '/papers/42', hashB, 102, 0, 3, 'Bob', 'yellow', '2026-08-24T00:07:00Z')
  sqlite.query('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?)').run(
    1, 1, 42,
    `[one](paperland://paper/42?h=${hashB}) [two](paperland://paper/42?h=${hashB}&s=0&e=3)`,
    0, 0, '2026-08-24T00:00:00Z', '2026-08-24T00:00:00Z',
  )

  setDatabaseForTesting(drizzle(sqlite, { schema }))
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    if (id === 1) request.user = { id: 1, username: 'alice', role: 'user' }
    else if (id === 2) request.user = { id: 2, username: 'bob', role: 'user' }
    else if (id === 3) request.user = { id: 3, username: 'admin', role: 'admin' }
    else request.user = null
  })
  await app.register(qaRoutes)
  await app.register(highlightsRoutes)
})

afterEach(async () => {
  await app.close()
  sqlite.close()
})

describe('QA multi-user scope and viewer state', () => {
  test('paper QA defaults to mine and allows non-admin all scope', async () => {
    const mine = await app.inject({ method: 'GET', url: '/api/papers/42/qa', headers: { 'x-test-user': '1' } })
    expect(mine.json().free.map((entry: any) => entry.entry_id)).toEqual([10])

    const all = await app.inject({ method: 'GET', url: '/api/papers/42/qa?scope=all', headers: { 'x-test-user': '1' } })
    const bob = all.json().free.find((entry: any) => entry.entry_id === 20)
    expect(bob.username).toBe('bob')
    expect(bob.can_manage).toBe(false)
    expect(bob.highlight_count).toBe(1)
    expect(bob.note_anchor_count).toBe(2)
  })

  test('anonymous paper QA sees preset only', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/papers/42/qa?scope=all' })
    expect(response.statusCode).toBe(200)
    expect(response.json().free).toEqual([])
    expect(Object.keys(response.json().template)).toEqual(['summary'])
  })

  test('feed all scope paginates all users for a non-admin', async () => {
    const response = await app.inject({
      method: 'GET', url: '/api/qa/free?scope=all&page=1&page_size=1', headers: { 'x-test-user': '1' },
    })
    expect(response.json().pagination).toMatchObject({ total: 2, total_pages: 2 })
    expect(response.json().data[0]).toMatchObject({ entry_id: 10, username: 'alice', can_manage: true })
  })

  test('background preferences are private and clearable', async () => {
    const set = await app.inject({
      method: 'PUT', url: '/api/qa/20/preferences', headers: { 'x-test-user': '1' },
      payload: { background_color: 'blue' },
    })
    expect(set.statusCode).toBe(200)
    const alice = await app.inject({ method: 'GET', url: '/api/papers/42/qa?scope=all', headers: { 'x-test-user': '1' } })
    expect(alice.json().free.find((entry: any) => entry.entry_id === 20).background_color).toBe('blue')
    const bob = await app.inject({ method: 'GET', url: '/api/papers/42/qa?scope=all', headers: { 'x-test-user': '2' } })
    expect(bob.json().free.find((entry: any) => entry.entry_id === 20).background_color).toBeNull()

    for (const backgroundColor of ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']) {
      const supported = await app.inject({
        method: 'PUT', url: '/api/qa/20/preferences', headers: { 'x-test-user': '1' },
        payload: { background_color: backgroundColor },
      })
      expect(supported.statusCode).toBe(200)
      expect(supported.json().background_color).toBe(backgroundColor)
    }

    const invalid = await app.inject({
      method: 'PUT', url: '/api/qa/20/preferences', headers: { 'x-test-user': '1' },
      payload: { background_color: 'teal' },
    })
    expect(invalid.statusCode).toBe(422)
    const afterInvalid = await app.inject({ method: 'GET', url: '/api/papers/42/qa?scope=all', headers: { 'x-test-user': '1' } })
    expect(afterInvalid.json().free.find((entry: any) => entry.entry_id === 20).background_color).toBe('red')
    const clear = await app.inject({
      method: 'PUT', url: '/api/qa/20/preferences', headers: { 'x-test-user': '1' },
      payload: { background_color: null },
    })
    expect(clear.statusCode).toBe(200)
  })

  test('non-owner mutation is hidden by backend while admin succeeds', async () => {
    const denied = await app.inject({
      method: 'DELETE', url: '/api/qa/results/102', headers: { 'x-test-user': '1' },
    })
    expect(denied.statusCode).toBe(404)
    const allowed = await app.inject({
      method: 'DELETE', url: '/api/qa/results/102', headers: { 'x-test-user': '3' },
    })
    expect(allowed.statusCode).toBe(200)
    expect(sqlite.query('SELECT qa_result_id FROM highlights WHERE id=1').get()).toEqual({ qa_result_id: null })
  })

  test('QA highlight attribution validates result paper and hash', async () => {
    const hash = markdownContentHash('Alice answer')
    const valid = await app.inject({
      method: 'POST', url: '/api/highlights', headers: { 'x-test-user': '1' },
      payload: {
        pathname: '/papers/42', content_hash: hash, qa_result_id: 101,
        start_offset: 0, end_offset: 5, text: 'Alice', color: 'yellow',
      },
    })
    expect(valid.statusCode).toBe(201)
    expect(valid.json().data.qa_result_id).toBe(101)

    const invalid = await app.inject({
      method: 'POST', url: '/api/highlights', headers: { 'x-test-user': '1' },
      payload: {
        pathname: '/papers/42', content_hash: 'wrong', qa_result_id: 101,
        start_offset: 0, end_offset: 5, text: 'Alice', color: 'yellow',
      },
    })
    expect(invalid.statusCode).toBe(400)
  })

  test('terminal Result stream returns one start and one authoritative terminal event', async () => {
    const response = await app.inject({
      method: 'GET', url: '/api/qa/results/101/stream', headers: { 'x-test-user': '2' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
    expect(response.body.match(/event: start/g)).toHaveLength(1)
    expect(response.body.match(/event: done/g)).toHaveLength(1)
    expect(response.body).toContain('"answer":"Alice answer"')
  })

  test('anonymous Result stream is rejected before SSE headers', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/qa/results/101/stream' })
    expect(anonymous.statusCode).toBe(401)
  })

  test('live Result stream emits persisted deltas before one authoritative done', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const ask = async (_paperId: number, _prompt: string, modelName: string, options: any) => {
      await gate
      await options.onChunk('one ')
      await options.onChunk('two')
      return { answer: 'one two final', model_name: modelName }
    }
    const run = await runQA(10, 42, 'Alice question', 'stream-model', {
      requestedByUserId: 1,
      askFn: ask,
      capabilitiesFn: () => ({ streaming: true }),
      batchMs: 5,
    })
    const responsePromise = app.inject({
      method: 'GET', url: `/api/qa/results/${run.result_id}/stream`, headers: { 'x-test-user': '1' },
    })
    await Bun.sleep(10)
    release()
    const response = await responsePromise
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('event: delta')
    expect(response.body.indexOf('event: delta')).toBeLessThan(response.body.indexOf('event: done'))
    expect(response.body.match(/event: done/g)).toHaveLength(1)
    expect(response.body).toContain('"answer":"one two final"')
  })

  test('only the free-entry owner or admin can cancel the exact active Result', async () => {
    let started!: () => void
    const startedPromise = new Promise<void>((resolve) => { started = resolve })
    const ask = async (_paperId: number, _prompt: string, _modelName: string, options: any): Promise<any> => {
      started()
      await new Promise<void>((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('cancelled')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    }
    const run = await runQA(10, 42, 'Alice question', 'cancel-model', {
      requestedByUserId: 1,
      askFn: ask,
      capabilitiesFn: () => ({ streaming: true }),
    })
    await startedPromise

    const ownerRead = await app.inject({ method: 'GET', url: '/api/papers/42/qa?scope=all', headers: { 'x-test-user': '1' } })
    const ownerResult = ownerRead.json().free.find((entry: any) => entry.entry_id === 10).results.find((result: any) => result.id === run.result_id)
    expect(ownerResult).toMatchObject({ status: 'awaiting_output', streaming_capable: true, can_cancel: true })
    expect(ownerResult.thinking_duration_ms).toBeGreaterThanOrEqual(0)
    const otherRead = await app.inject({ method: 'GET', url: '/api/papers/42/qa?scope=all', headers: { 'x-test-user': '2' } })
    const otherResult = otherRead.json().free.find((entry: any) => entry.entry_id === 10).results.find((result: any) => result.id === run.result_id)
    expect(otherResult.can_cancel).toBe(false)

    const denied = await app.inject({
      method: 'POST', url: `/api/qa/results/${run.result_id}/cancel`, headers: { 'x-test-user': '2' },
    })
    expect(denied.statusCode).toBe(404)
    const allowed = await app.inject({
      method: 'POST', url: `/api/qa/results/${run.result_id}/cancel`, headers: { 'x-test-user': '1' },
    })
    expect(allowed.statusCode).toBe(200)
    for (let i = 0; i < 100; i++) {
      if ((sqlite.query('SELECT status FROM qa_results WHERE id=?').get(run.result_id) as any)?.status === 'cancelled') break
      await Bun.sleep(5)
    }
    expect(sqlite.query('SELECT status FROM qa_results WHERE id=?').get(run.result_id)).toEqual({ status: 'cancelled' })
    const secondCancel = await app.inject({
      method: 'POST', url: `/api/qa/results/${run.result_id}/cancel`, headers: { 'x-test-user': '1' },
    })
    expect(secondCancel.statusCode).toBe(409)
  })

  test('preset cancellation is limited to its initiator or admin and leaves sibling runs active', async () => {
    const waitingAsk = async (_paperId: number, _prompt: string, _modelName: string, options: any): Promise<any> => {
      await new Promise<void>((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('cancelled')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    }
    let releaseSibling!: () => void
    const siblingGate = new Promise<void>((resolve) => { releaseSibling = resolve })
    const siblingAsk = async (_paperId: number, _prompt: string, modelName: string) => {
      await siblingGate
      return { answer: 'sibling done', model_name: modelName }
    }

    const owned = await runQA(30, 42, 'Preset question', 'owned-preset', {
      requestedByUserId: 1, askFn: waitingAsk, capabilitiesFn: () => ({ streaming: true }),
    })
    const sibling = await runQA(30, 42, 'Preset question', 'sibling-preset', {
      requestedByUserId: 1, askFn: siblingAsk, capabilitiesFn: () => ({ streaming: false }),
    })
    const denied = await app.inject({
      method: 'POST', url: `/api/qa/results/${owned.result_id}/cancel`, headers: { 'x-test-user': '2' },
    })
    expect(denied.statusCode).toBe(404)
    const initiator = await app.inject({
      method: 'POST', url: `/api/qa/results/${owned.result_id}/cancel`, headers: { 'x-test-user': '1' },
    })
    expect(initiator.statusCode).toBe(200)
    releaseSibling()
    for (let i = 0; i < 100; i++) {
      const statuses = sqlite.query('SELECT status FROM qa_results WHERE id IN (?,?) ORDER BY id').all(owned.result_id, sibling.result_id) as any[]
      if (statuses.some((row) => row.status === 'cancelled') && statuses.some((row) => row.status === 'done')) break
      await Bun.sleep(5)
    }
    expect(sqlite.query('SELECT status FROM qa_results WHERE id=?').get(owned.result_id)).toEqual({ status: 'cancelled' })
    expect(sqlite.query('SELECT status FROM qa_results WHERE id=?').get(sibling.result_id)).toEqual({ status: 'done' })

    const adminRun = await runQA(30, 42, 'Preset question', 'admin-stop', {
      requestedByUserId: 1, askFn: waitingAsk, capabilitiesFn: () => ({ streaming: true }),
    })
    const admin = await app.inject({
      method: 'POST', url: `/api/qa/results/${adminRun.result_id}/cancel`, headers: { 'x-test-user': '3' },
    })
    expect(admin.statusCode).toBe(200)
  })
})

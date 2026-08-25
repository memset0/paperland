import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { translationRoutes } from './translation.js'

let fixtureDir = ''
let sqlite: Database
let app: FastifyInstance
let authenticated = true
let originalFetch: typeof fetch
let previousKey: string | undefined
let fetchCalls = 0

function response(frames: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function events(body: string): Array<{ event: string; data: any }> {
  return body.split(/\r?\n\r?\n/).flatMap((frame) => {
    const event = frame.split(/\r?\n/).find((line) => line.startsWith('event: '))?.slice(7)
    const data = frame.split(/\r?\n/).find((line) => line.startsWith('data: '))?.slice(6)
    return event && data ? [{ event, data: JSON.parse(data) }] : []
  })
}

beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-translation-route-test-'))
  const configPath = join(fixtureDir, 'config.yml')
  writeFileSync(configPath, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: true }
services:
  translation_service: { max_concurrency: 1, rate_limit_interval: 0 }
models:
  default: stream-openai
  available:
    - name: stream-openai
      type: openai_api
      endpoint: https://example.test/v1
      api_key_env: PAPERLAND_TRANSLATION_ROUTE_KEY
      stream: true
content_priority: [user_input]
system_prompt: '{PROMPT} {PAPER}'
qa:
  - { name: summary, prompt: Summary }
translation:
  model: stream-openai
  prompt: 'Translate: {TEXT}'
`, 'utf8')
  loadConfig(configPath)

  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_hash TEXT NOT NULL,
      source_text TEXT NOT NULL,
      source_lang TEXT NOT NULL DEFAULT 'en',
      target_lang TEXT NOT NULL DEFAULT 'zh',
      translated_text TEXT NOT NULL,
      model_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_hash, target_lang)
    );
    CREATE INDEX translations_source_hash_idx ON translations(source_hash);
  `)
  setDatabaseForTesting(drizzle(sqlite, { schema }))

  originalFetch = globalThis.fetch
  previousKey = process.env.PAPERLAND_TRANSLATION_ROUTE_KEY
  process.env.PAPERLAND_TRANSLATION_ROUTE_KEY = 'test-key'
  globalThis.fetch = (async () => {
    fetchCalls++
    return response([
      'data: {"choices":[{"delta":{"content":"路由"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"译文"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
  }) as typeof fetch

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = authenticated ? { id: 1, username: 'admin', role: 'admin' } : null
  })
  await app.register(translationRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  sqlite.close()
  globalThis.fetch = originalFetch
  if (previousKey === undefined) delete process.env.PAPERLAND_TRANSLATION_ROUTE_KEY
  else process.env.PAPERLAND_TRANSLATION_ROUTE_KEY = previousKey
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('translation routes', () => {
  test('rejects anonymous streaming requests before provider invocation', async () => {
    authenticated = false
    const before = fetchCalls
    const res = await app.inject({ method: 'POST', url: '/api/translate/stream', payload: { text: 'private' } })
    expect(res.statusCode).toBe(401)
    expect(fetchCalls).toBe(before)
    authenticated = true
  })

  test('streams start, ordered deltas, and authoritative done, then reuses cache', async () => {
    const first = await app.inject({ method: 'POST', url: '/api/translate/stream', payload: { text: 'route source' } })
    expect(first.statusCode).toBe(200)
    expect(first.headers['content-type']).toContain('text/event-stream')
    const firstEvents = events(first.body)
    expect(firstEvents.map((item) => item.event)).toEqual(['start', 'delta', 'delta', 'done'])
    expect(firstEvents[0].data).toMatchObject({ cached: false, streaming: true, model_name: 'stream-openai' })
    expect(firstEvents[1].data.delta + firstEvents[2].data.delta).toBe('路由译文')
    expect(firstEvents[3].data).toMatchObject({ translated_text: '路由译文', cached: false })

    const before = fetchCalls
    const cached = await app.inject({ method: 'POST', url: '/api/translate/stream', payload: { text: ' route source ' } })
    expect(events(cached.body).map((item) => item.event)).toEqual(['start', 'done'])
    expect(events(cached.body)[0].data).toMatchObject({ cached: true, streaming: false })
    expect(events(cached.body)[1].data).toMatchObject({ translated_text: '路由译文', cached: true })
    expect(fetchCalls).toBe(before)

    const json = await app.inject({ method: 'POST', url: '/api/translate', payload: { text: 'route source' } })
    expect(json.statusCode).toBe(200)
    expect(json.json()).toMatchObject({ translated_text: '路由译文', cached: true })
  })

  test('emits one error terminal event after partial output and does not cache it', async () => {
    globalThis.fetch = (async () => {
      fetchCalls++
      return response([
        'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
        'data: invalid-json\n\n',
      ])
    }) as typeof fetch

    const failed = await app.inject({ method: 'POST', url: '/api/translate/stream', payload: { text: 'failing source' } })
    const failedEvents = events(failed.body)
    expect(failedEvents.map((item) => item.event)).toEqual(['start', 'delta', 'error'])
    expect(failedEvents.at(-1)?.data.error.code).toBe('TRANSLATION_FAILED')

    const peek = await app.inject({ method: 'POST', url: '/api/translate', payload: { text: 'failing source', cache_only: true } })
    expect(peek.json()).toMatchObject({ cached: false, translated_text: null })
  })
})

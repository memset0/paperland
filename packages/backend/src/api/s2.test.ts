import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import { loadConfig, getConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { s2Routes } from './s2.js'

// S2 is mocked (globalThis.fetch); no real Semantic Scholar request is made.

const PA = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'
const realFetch = globalThis.fetch
let app: FastifyInstance
let loggedIn = true
let fetchCalls = 0

beforeAll(async () => {
  loadConfig()
  const svc = getConfig().services.semantic_scholar_service
  if (svc) svc.rate_limit_interval = 0
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = loggedIn ? ({ id: 1, username: 'alice', role: 'user' } as any) : null
  })
  await app.register(s2Routes)
  await app.ready()
})

afterAll(async () => { await app.close() })

afterEach(() => {
  globalThis.fetch = realFetch
  loggedIn = true
  fetchCalls = 0
})

function mockS2() {
  globalThis.fetch = (async (_url: unknown, init: any) => {
    fetchCalls++
    const ids: string[] = JSON.parse(init.body).ids
    return new Response(JSON.stringify(ids.map((id) => (id === PA ? { paperId: PA, externalIds: { CorpusId: 1 }, title: 'Attention' } : null))))
  }) as typeof fetch
}

const post = (ids: unknown) => app.inject({ method: 'POST', url: '/api/s2/papers/resolve', payload: { ids } })

describe('POST /api/s2/papers/resolve', () => {
  it('returns one result per id in request order', async () => {
    mockS2()
    const res = await post([PA, 'bad', PA])
    expect(res.statusCode).toBe(200)
    const { results } = res.json()
    expect(results.map((r: any) => [r.id, r.status])).toEqual([[PA, 'resolved'], ['bad', 'invalid'], [PA, 'resolved']])
    expect(results[0].paper.title).toBe('Attention')
    expect(fetchCalls).toBe(1) // duplicate id resolved once
  })

  it('rejects malformed bodies and too many ids with 400', async () => {
    expect((await post('nope')).statusCode).toBe(400)
    expect((await post([1, 2])).statusCode).toBe(400)
    const max = getConfig().s2_cache.max_ids_per_request
    expect((await post(Array.from({ length: max + 1 }, (_, i) => String(i)))).statusCode).toBe(400)
  })

  it('does not fetch for anonymous callers', async () => {
    mockS2()
    loggedIn = false
    const { results } = (await post(['12345'])).json()
    expect(results[0].status).toBe('unavailable')
    expect(fetchCalls).toBe(0)
  })

  it('serves anonymous callers from the cache once populated', async () => {
    mockS2()
    await post([PA]) // logged in → cached
    loggedIn = false
    const { results } = (await post([PA])).json()
    expect(results[0]).toMatchObject({ status: 'resolved', source: 'cache' })
  })
})

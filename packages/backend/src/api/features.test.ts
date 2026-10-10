import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { featuresRoutes } from './features.js'
import { FEATURES } from '../features.js'

let fixtureDir = ''
let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance
const now = new Date().toISOString()
const alice = { id: 1, username: 'alice', role: 'user' }
const bob = { id: 2, username: 'bob', role: 'user' }
const as = (u: { id: number }) => ({ 'x-test-user': String(u.id) })

const BASE_CONFIG = `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: false }
models:
  default: m
  available:
    - name: m
      type: openai_api
      endpoint: https://example.test/v1
      api_key_env: PAPERLAND_FEATURES_TEST_KEY
qa:
  - name: summary
    prompt: Summarize it.
translation:
  prompt: 'Translate: {TEXT}'
`

function writeConfig(extra = ''): string {
  const configPath = join(fixtureDir, `config-${Math.random().toString(36).slice(2)}.yml`)
  writeFileSync(configPath, BASE_CONFIG + extra, 'utf8')
  return configPath
}

beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-features-test-'))
  loadConfig(writeConfig())
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    request.user = ([alice, bob].find((u) => u.id === id) as any) ?? null
  })
  await app.register(featuresRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(fixtureDir, { recursive: true, force: true })
})

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  for (const u of [alice, bob]) {
    db.insert(schema.users).values({ id: u.id, username: u.username, password_hash: 'x', role: u.role, created_at: now }).run()
  }
})

afterEach(() => sqlite.close())

const list = async (u: { id: number }) => (await app.inject({ url: '/api/features', headers: as(u) })).json().data
const markSeen = (u: { id: number }, keys: unknown) =>
  app.inject({ method: 'POST', url: '/api/features/seen', headers: as(u), payload: { keys } })

describe('feature registry', () => {
  it('has unique keys, valid dates and the registered features', () => {
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(FEATURES.length)
    for (const f of FEATURES) expect(f.released_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(FEATURES.map((f) => f.key).sort()).toEqual(
      ['copy-latex', 'custom-qa', 'deep-research', 'highlight-model-output', 'notes', 'qa-conversation-view', 'usage-dashboard'],
    )
    expect(FEATURES.find((f) => f.key === 'deep-research')).toMatchObject({ title: 'Deep Research paper lists', released_at: '2026-10-09' })
  })
})

describe('features API', () => {
  it('requires login', async () => {
    expect((await app.inject({ url: '/api/features' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/api/features/seen', payload: { keys: ['notes'] } })).statusCode).toBe(401)
  })

  it('lists features newest first with image urls', async () => {
    const data = await list(alice)
    const dates = data.features.map((f: any) => f.released_at)
    expect(dates).toEqual([...dates].sort().reverse())
    // Same-day entries keep registry order.
    expect(data.features.slice(0, 2).map((f: any) => f.key)).toEqual(['qa-conversation-view', 'usage-dashboard'])
    expect(data.features.find((f: any) => f.key === 'notes')).toMatchObject({ image_url: '/features/notes.svg', seen: false })
  })

  it('tracks seen per user, idempotently keeping the first seen_at', async () => {
    expect((await markSeen(alice, ['notes'])).json()).toEqual({ success: true })
    const first = db.select().from(schema.featureViews).all()
    expect(first).toHaveLength(1)
    expect((await markSeen(alice, ['notes', 'notes'])).statusCode).toBe(200)
    const after = db.select().from(schema.featureViews).all()
    expect(after).toHaveLength(1)
    expect(after[0].seen_at).toBe(first[0].seen_at)

    expect((await list(alice)).features.find((f: any) => f.key === 'notes').seen).toBe(true)
    expect((await list(bob)).features.find((f: any) => f.key === 'notes').seen).toBe(false)
  })

  it('rejects unknown keys without recording anything', async () => {
    const res = await markSeen(alice, ['notes', 'nope'])
    expect(res.statusCode).toBe(400)
    expect((await markSeen(alice, [])).statusCode).toBe(400)
    expect((await markSeen(alice, 'notes')).statusCode).toBe(400)
    expect(db.select().from(schema.featureViews).all()).toHaveLength(0)
  })

  it('deletes seen records with the user', async () => {
    await markSeen(bob, ['custom-qa'])
    db.delete(schema.users).where(eq(schema.users.id, bob.id)).run()
    expect(db.select().from(schema.featureViews).all()).toHaveLength(0)
  })
})

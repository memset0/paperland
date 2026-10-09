import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { authRoutes } from './auth.js'
import { paperRoutes } from './papers.js'

/**
 * Arxiv quick-open (browser extension): the per-user CSRF token endpoints and
 * `POST /api/papers/open-arxiv`. In-memory DB; no services are registered with the
 * service runner, so creating a paper triggers no external fetches.
 */

let db: ReturnType<typeof drizzle>
let app: FastifyInstance
let userA: number
let userB: number
let currentUserId: number | null = null

beforeAll(async () => {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)

  const now = new Date().toISOString()
  userA = db.insert(schema.users).values({ username: 'alice', password_hash: 'x', role: 'user', created_at: now }).returning().get().id
  userB = db.insert(schema.users).values({ username: 'bob', password_hash: 'x', role: 'user', created_at: now }).returning().get().id

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = currentUserId == null ? null : ({ id: currentUserId, username: `u${currentUserId}`, role: 'user' } as any)
  })
  await app.register(authRoutes)
  await app.register(paperRoutes)
  await app.ready()
})

const getToken = () => app.inject({ method: 'GET', url: '/api/auth/open-token' })
const openArxiv = (payload: unknown) => app.inject({ method: 'POST', url: '/api/papers/open-arxiv', payload: payload as any })
const paperCount = () => db.select().from(schema.papers).all().length

describe('quick-open token', () => {
  it('generates on first fetch and is stable afterwards', async () => {
    currentUserId = userA
    const first = (await getToken()).json().token
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect((await getToken()).json().token).toBe(first)
  })

  it('regenerate returns a new token and invalidates the old one', async () => {
    currentUserId = userA
    const old = (await getToken()).json().token
    const res = await app.inject({ method: 'POST', url: '/api/auth/open-token/regenerate', payload: {} })
    expect(res.statusCode).toBe(200)
    const fresh = res.json().token
    expect(fresh).not.toBe(old)
    expect((await openArxiv({ arxiv_id: '2401.00001', token: old })).statusCode).toBe(403)
  })

  it('rejects anonymous callers', async () => {
    currentUserId = null
    expect((await getToken()).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/api/auth/open-token/regenerate' })).statusCode).toBe(401)
  })
})

describe('POST /api/papers/open-arxiv', () => {
  it('creates a missing paper with the normalized id', async () => {
    currentUserId = userA
    const token = (await getToken()).json().token
    const res = await openArxiv({ arxiv_id: 'arXiv:2401.12345v2', token })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(true)
    expect(body.arxiv_id).toBe('2401.12345')
    const row = db.select().from(schema.papers).where(eq(schema.papers.id, body.paper_id)).get()!
    expect(row.arxiv_id).toBe('2401.12345')
    expect(row.listed).toBe(1)
  })

  it('returns the existing paper without creating another', async () => {
    currentUserId = userA
    const token = (await getToken()).json().token
    const before = paperCount()
    const res = await openArxiv({ arxiv_id: '2401.12345', token })
    expect(res.json().created).toBe(false)
    expect(paperCount()).toBe(before)
  })

  it("rejects a missing or another user's token with 403 and creates nothing", async () => {
    currentUserId = userB
    const bobToken = (await getToken()).json().token
    currentUserId = userA
    const before = paperCount()
    expect((await openArxiv({ arxiv_id: '2402.00002' })).statusCode).toBe(403)
    const res = await openArxiv({ arxiv_id: '2402.00002', token: bobToken })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('INVALID_OPEN_TOKEN')
    expect(paperCount()).toBe(before)
  })

  it('rejects an invalid arxiv id with 422', async () => {
    currentUserId = userA
    const token = (await getToken()).json().token
    expect((await openArxiv({ arxiv_id: 'not-an-id', token })).statusCode).toBe(422)
  })

  it('rejects anonymous callers with 401', async () => {
    currentUserId = null
    const before = paperCount()
    expect((await openArxiv({ arxiv_id: '2403.00003', token: 'x' })).statusCode).toBe(401)
    expect(paperCount()).toBe(before)
  })
})

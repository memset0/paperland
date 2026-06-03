import { describe, it, expect, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { referenceLinksRoutes } from './reference_links.js'
import { setDatabaseForTesting } from '../db/index.js'

/**
 * Route-level tests for per-user paper reference links. In-memory SQLite + drizzle
 * behind a real Fastify instance (driven via app.inject); an onRequest hook injects
 * the "current user" so requireUser + owner checks are exercised. No network / external
 * service is touched.
 */

type TestUser = { id: number; username: string; role: 'admin' | 'user' } | null

let app: FastifyInstance
let db: ReturnType<typeof drizzle>
let currentUser: TestUser = null

function makeUser(username: string): { id: number } {
  const now = new Date().toISOString()
  return db.insert(schema.users).values({ username, password_hash: 'x', role: 'user', created_at: now }).returning().get()
}

function makePaper(): number {
  const now = new Date().toISOString()
  return db.insert(schema.papers).values({ title: 'T', authors: '[]', created_at: now, updated_at: now }).returning().get().id
}

beforeEach(async () => {
  const sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  currentUser = null

  app = Fastify()
  app.addHook('onRequest', async (request) => { ;(request as any).user = currentUser })
  await app.register(referenceLinksRoutes)
  await app.ready()
})

describe('POST /api/papers/:id/reference-links', () => {
  it('creates a link with title, url, and description', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }

    const res = await app.inject({
      method: 'POST', url: `/api/papers/${paper}/reference-links`,
      payload: { title: 'A blog', url: 'https://example.com/post', description: 'nice read' },
    })
    expect(res.statusCode).toBe(201)
    const link = res.json().data
    expect(link).toMatchObject({ title: 'A blog', url: 'https://example.com/post', description: 'nice read', user_id: u.id, paper_id: paper })
    expect(typeof link.id).toBe('number')
  })

  it('stores a null description when omitted or blank', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }

    const omitted = await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url: 'https://a.io' } })
    expect(omitted.json().data.description).toBeNull()
    const blank = await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url: 'https://b.io', description: '   ' } })
    expect(blank.json().data.description).toBeNull()
  })

  it('creates a link with only a url (null title)', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }

    const res = await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { url: 'https://a.io', description: 'A (a.io)' } })
    expect(res.statusCode).toBe(201)
    const link = res.json().data
    expect(link.title).toBeNull()
    expect(link).toMatchObject({ url: 'https://a.io', description: 'A (a.io)' })
  })

  it('accepts a blank/whitespace title (stored as null) and rejects only a missing url', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }

    const blankTitle = await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: '   ', url: 'https://a.io' } })
    expect(blankTitle.statusCode).toBe(201)
    expect(blankTitle.json().data.title).toBeNull()
    const noUrl = await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T' } })
    expect(noUrl.statusCode).toBe(400)
  })

  it('rejects a non-http(s) url with 400', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }

    for (const url of ['javascript:alert(1)', 'not a url', 'ftp://files.example.com']) {
      const res = await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url } })
      expect(res.statusCode).toBe(400)
    }
  })

  it('rejects an unauthenticated create with 401', async () => {
    const paper = makePaper()
    currentUser = null
    const res = await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url: 'https://a.io' } })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/papers/:id/reference-links', () => {
  it('returns the owner-scoped list ordered oldest-first, isolated per user and paper', async () => {
    const alice = makeUser('alice'); const bob = makeUser('bob')
    const paper1 = makePaper(); const paper2 = makePaper()
    currentUser = { id: alice.id, username: 'alice', role: 'user' }
    await app.inject({ method: 'POST', url: `/api/papers/${paper1}/reference-links`, payload: { title: 'first', url: 'https://1.io' } })
    await app.inject({ method: 'POST', url: `/api/papers/${paper1}/reference-links`, payload: { title: 'second', url: 'https://2.io' } })
    await app.inject({ method: 'POST', url: `/api/papers/${paper2}/reference-links`, payload: { title: 'other-paper', url: 'https://3.io' } })
    // Bob's link on paper1 must not leak into Alice's list.
    currentUser = { id: bob.id, username: 'bob', role: 'user' }
    await app.inject({ method: 'POST', url: `/api/papers/${paper1}/reference-links`, payload: { title: 'bob-link', url: 'https://b.io' } })

    currentUser = { id: alice.id, username: 'alice', role: 'user' }
    const res = await app.inject({ method: 'GET', url: `/api/papers/${paper1}/reference-links` })
    const titles = res.json().data.map((l: any) => l.title)
    expect(titles).toEqual(['first', 'second'])
  })

  it('returns an empty list for an anonymous request (no error)', async () => {
    const paper = makePaper()
    currentUser = null
    const res = await app.inject({ method: 'GET', url: `/api/papers/${paper}/reference-links` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })
})

describe('PATCH /api/reference-links/:id', () => {
  it('updates only the provided field and refreshes updated_at', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }
    const created = (await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'old', url: 'https://a.io', description: 'd' } })).json().data

    const res = await app.inject({ method: 'PATCH', url: `/api/reference-links/${created.id}`, payload: { title: 'new' } })
    expect(res.statusCode).toBe(200)
    const updated = res.json().data
    expect(updated.title).toBe('new')
    expect(updated.url).toBe('https://a.io')      // untouched
    expect(updated.description).toBe('d')          // untouched
    expect(updated.updated_at >= created.updated_at).toBe(true)
  })

  it('rejects an invalid url on update with 400', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }
    const created = (await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url: 'https://a.io' } })).json().data
    const res = await app.inject({ method: 'PATCH', url: `/api/reference-links/${created.id}`, payload: { url: 'javascript:void(0)' } })
    expect(res.statusCode).toBe(400)
  })

  it("returns 404 when patching another user's link", async () => {
    const alice = makeUser('alice'); const bob = makeUser('bob'); const paper = makePaper()
    currentUser = { id: alice.id, username: 'alice', role: 'user' }
    const created = (await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url: 'https://a.io' } })).json().data
    currentUser = { id: bob.id, username: 'bob', role: 'user' }
    const res = await app.inject({ method: 'PATCH', url: `/api/reference-links/${created.id}`, payload: { title: 'hijack' } })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/reference-links/preview', () => {
  // Only the pre-crawl guards (auth + url validation) are exercised here — they short-circuit
  // before any network fetch, so no external request is made and no config is required.
  it('rejects an unauthenticated preview with 401', async () => {
    currentUser = null
    const res = await app.inject({ method: 'GET', url: `/api/reference-links/preview?url=${encodeURIComponent('https://example.com')}` })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a missing or non-http(s) url with 400 (no crawl attempted)', async () => {
    const u = makeUser('alice')
    currentUser = { id: u.id, username: 'alice', role: 'user' }

    const missing = await app.inject({ method: 'GET', url: '/api/reference-links/preview' })
    expect(missing.statusCode).toBe(400)
    for (const url of ['javascript:alert(1)', 'not a url', 'ftp://files.example.com']) {
      const res = await app.inject({ method: 'GET', url: `/api/reference-links/preview?url=${encodeURIComponent(url)}` })
      expect(res.statusCode).toBe(400)
    }
  })
})

describe('DELETE /api/reference-links/:id', () => {
  it('deletes an owned link', async () => {
    const u = makeUser('alice'); const paper = makePaper()
    currentUser = { id: u.id, username: 'alice', role: 'user' }
    const created = (await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url: 'https://a.io' } })).json().data

    const del = await app.inject({ method: 'DELETE', url: `/api/reference-links/${created.id}` })
    expect(del.statusCode).toBe(200)
    expect(del.json().success).toBe(true)
    const list = await app.inject({ method: 'GET', url: `/api/papers/${paper}/reference-links` })
    expect(list.json().data).toEqual([])
  })

  it("returns 404 when deleting another user's link", async () => {
    const alice = makeUser('alice'); const bob = makeUser('bob'); const paper = makePaper()
    currentUser = { id: alice.id, username: 'alice', role: 'user' }
    const created = (await app.inject({ method: 'POST', url: `/api/papers/${paper}/reference-links`, payload: { title: 'T', url: 'https://a.io' } })).json().data
    currentUser = { id: bob.id, username: 'bob', role: 'user' }
    const res = await app.inject({ method: 'DELETE', url: `/api/reference-links/${created.id}` })
    expect(res.statusCode).toBe(404)
  })
})

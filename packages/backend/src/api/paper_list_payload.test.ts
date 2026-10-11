import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { dirname, resolve } from 'path'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { toSessionUser } from '../auth/session_auth.js'
import { paperRoutes } from './papers.js'

/** Paper list payload: no full text, slim metadata, SQL pagination. */

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance

const get = (url: string) => app.inject({ method: 'GET', url, headers: { 'x-test-user': '1' } }).then(r => r.json())
function addPaper(i: number, extra: Partial<typeof schema.papers.$inferInsert> = {}) {
  const ts = `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`
  return db.insert(schema.papers).values({ title: `P${i}`, authors: '["A"]', created_at: ts, updated_at: ts, ...extra }).returning().get().id
}

beforeEach(async () => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  setDatabaseForTesting(db)
  db.insert(schema.users).values({ username: 'alice', password_hash: 'x', role: 'user', created_at: 'now' }).run()
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const row = db.select().from(schema.users).where(eq(schema.users.id, Number(request.headers['x-test-user']))).get()
    request.user = row ? toSessionUser(row) : null
  })
  await app.register(paperRoutes)
})

afterEach(async () => { await app.close(); sqlite.close() })

describe('paper list payload', () => {
  test('list items omit contents and carry slim metadata; detail is full', async () => {
    const meta = { citation_count: 10, reference_count: 3, s2_url: 'https://s2/x', references: [{ id: 1 }], venue: 'V' }
    const full = addPaper(1, { contents: JSON.stringify({ pdf_parsed: 'long text' }), metadata: JSON.stringify(meta) })
    const legacy = addPaper(2, { metadata: JSON.stringify({ references: Array.from({ length: 40 }, (_, i) => i) }) })
    const bare = addPaper(3)

    const items = new Map((await get('/api/papers?scope=all')).data.map((p: any) => [p.id, p]))
    const a: any = items.get(full)
    expect('contents' in a).toBe(false)
    expect(a.metadata).toEqual({ citation_count: 10, reference_count: 3, s2_url: 'https://s2/x' })
    expect(a.authors).toEqual(['A'])
    expect(a.listed).toBe(true)
    expect((items.get(legacy) as any).metadata).toEqual({ reference_count: 40 })
    expect((items.get(bare) as any).metadata).toBeNull()

    const detail = await get(`/api/papers/${full}`)
    expect(detail.contents).toEqual({ pdf_parsed: 'long text' })
    expect(detail.metadata.references).toHaveLength(1)
  })

  test('paginates in SQL with correct total, order and filters', async () => {
    const ids = Array.from({ length: 45 }, (_, i) => addPaper(i + 1))
    const p3 = await get('/api/papers?scope=all&page=3&page_size=20&sort_by=created_at&sort_order=desc')
    expect(p3.pagination).toEqual({ page: 3, page_size: 20, total: 45, total_pages: 3 })
    expect(p3.data.map((p: any) => p.id)).toEqual(ids.slice(0, 5).reverse())
    const asc = await get('/api/papers?scope=all&page=1&page_size=2&sort_by=created_at&sort_order=asc')
    expect(asc.data.map((p: any) => p.id)).toEqual(ids.slice(0, 2))

    const search = await get('/api/papers?scope=all&search=P4')
    expect(search.pagination.total).toBe(7) // P4, P40..P45
    const mine = await get('/api/papers')
    expect(mine.pagination.total).toBe(0)
    expect(mine.data).toEqual([])
  })

  test('sort_by=added_at orders the library by when the caller added each paper', async () => {
    const [p1, p2, p3] = [addPaper(1), addPaper(2), addPaper(3)]
    const add = (paper_id: number, at: string) =>
      db.insert(schema.userPapers).values({ user_id: 1, paper_id, in_library: 1, created_at: at, updated_at: at }).run()
    add(p1, '2026-02-02T00:00:00.000Z')
    add(p2, '2026-02-01T00:00:00.000Z')
    add(p3, '2026-02-03T00:00:00.000Z')

    const mine = await get('/api/papers?sort_by=added_at&page_size=6')
    expect(mine.data.map((p: any) => p.id)).toEqual([p3, p1, p2])
    expect(mine.data[0].added_at).toBe('2026-02-03T00:00:00.000Z')
    const asc = await get('/api/papers?sort_by=added_at&sort_order=asc')
    expect(asc.data.map((p: any) => p.id)).toEqual([p2, p1, p3])

    // Outside Mine there is no single "added" time: fall back to created_at; non-library → null.
    const p4 = addPaper(4)
    const all = await get('/api/papers?scope=all&sort_by=added_at')
    expect(all.data.map((p: any) => p.id)).toEqual([p4, p3, p2, p1])
    expect(all.data[0].added_at).toBeNull()
    const anon = await app.inject({ method: 'GET', url: '/api/papers?sort_by=added_at' }).then(r => r.json())
    expect(anon.data.map((p: any) => p.id)).toEqual([p4, p3, p2, p1])
    expect(anon.data.every((p: any) => p.added_at === null)).toBe(true)
  })
})

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { toSessionUser } from '../auth/session_auth.js'
import { serviceRunner } from '../services/service_runner.js'
import { seedStarterPaper } from '../services/user_library.js'
import { paperRoutes } from './papers.js'
import { userRoutes } from './users.js'
import { externalPaperRoutes } from '../external-api/papers.js'

/** Personal paper library: mine/all scope, binding on add, add/remove API, starter paper, backfill.
 *  The service runner is stubbed, so no external fetch is made. */

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
const realTrigger = serviceRunner.triggerForPaper
serviceRunner.triggerForPaper = (async () => {}) as any
afterAll(() => { serviceRunner.triggerForPaper = realTrigger })

let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance

function req(userId: number | null, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as any, headers: userId ? { 'x-test-user': String(userId) } : {} })
}
const ids = (res: any) => res.json().data.map((p: any) => p.id).sort()
const now = () => new Date().toISOString()
function addPaper(arxiv_id: string | null, title = 'P') {
  return db.insert(schema.papers).values({ arxiv_id, title, authors: '[]', created_at: now(), updated_at: now() }).returning().get().id
}

beforeEach(async () => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  setDatabaseForTesting(db)
  for (const [username, role] of [['alice', 'user'], ['bob', 'user'], ['root', 'admin']]) {
    db.insert(schema.users).values({ username, password_hash: 'x', role, created_at: now() }).run()
  }
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    const row = id ? db.select().from(schema.users).where(eq(schema.users.id, id)).get() : undefined
    request.user = row ? toSessionUser(row) : null
  })
  await app.register(paperRoutes)
  await app.register(userRoutes)
  await app.register(externalPaperRoutes)
})

afterEach(async () => {
  await app.close()
  sqlite.close()
})

describe('personal paper library', () => {
  test('adding binds the paper to the adder only; mine vs all', async () => {
    const res = await req(2, 'POST', '/api/papers', { title: 'Bob paper' })
    expect(res.json()).toMatchObject({ created: true, in_library: true })
    const bobPaper = res.json().id

    expect(ids(await req(2, 'GET', '/api/papers'))).toEqual([bobPaper])
    expect(ids(await req(1, 'GET', '/api/papers'))).toEqual([])
    const all = (await req(1, 'GET', '/api/papers?scope=all')).json().data
    expect(all.map((p: any) => [p.id, p.in_library])).toEqual([[bobPaper, false]])
    // Anonymous: no library, always the site-wide list
    expect(ids(await req(null, 'GET', '/api/papers'))).toEqual([bobPaper])
  })

  test('adding an existing paper binds it without duplicating', async () => {
    const first = (await req(2, 'POST', '/api/papers', { arxiv_id: '2401.00001' })).json()
    const again = (await req(1, 'POST', '/api/papers', { arxiv_id: '2401.00001' })).json()
    expect(again).toMatchObject({ id: first.id, created: false, in_library: true })
    expect(ids(await req(1, 'GET', '/api/papers'))).toEqual([first.id])
    expect((sqlite.query('SELECT COUNT(*) c FROM papers').get() as any).c).toBe(1)
  })

  test('add/remove API is idempotent, keeps the paper, 404s and requires login', async () => {
    const p = addPaper(null)
    for (let i = 0; i < 2; i++) {
      const res = await req(1, 'PUT', `/api/papers/${p}/library`)
      expect(res.json()).toEqual({ paper_id: p, in_library: true })
    }
    expect((await req(1, 'GET', `/api/papers/${p}`)).json().in_library).toBe(true)
    expect(ids(await req(1, 'GET', '/api/papers'))).toEqual([p])

    for (let i = 0; i < 2; i++) {
      expect((await req(1, 'DELETE', `/api/papers/${p}/library`)).json()).toEqual({ paper_id: p, in_library: false })
    }
    expect(ids(await req(1, 'GET', '/api/papers'))).toEqual([])
    expect((await req(1, 'GET', `/api/papers/${p}`)).json().in_library).toBe(false)
    expect((await req(1, 'PUT', '/api/papers/999/library')).statusCode).toBe(404)
    expect((await req(null, 'PUT', `/api/papers/${p}/library`)).statusCode).toBe(401)
  })

  test('deleting a paper removes its library rows', async () => {
    const p = addPaper(null)
    await req(1, 'PUT', `/api/papers/${p}/library`)
    expect((await req(1, 'DELETE', `/api/papers/${p}`)).statusCode).toBe(200)
    expect((sqlite.query('SELECT COUNT(*) c FROM user_papers').get() as any).c).toBe(0)
  })

  test('external API create binds to the token user', async () => {
    const res = await req(1, 'POST', '/external-api/v1/papers', { arxiv_id: '2401.00002' })
    expect(ids(await req(1, 'GET', '/api/papers'))).toEqual([res.json().id])
    expect(ids(await req(2, 'GET', '/api/papers'))).toEqual([])
  })

  test('new users get the starter paper', async () => {
    const starter = addPaper('1706.03762', 'Attention Is All You Need')
    addPaper('2401.00003')
    const created = (await req(3, 'POST', '/api/users', { username: 'carol', password: 'pw' })).json().data
    expect(ids(await req(created.id, 'GET', '/api/papers'))).toEqual([starter])
  })

  test('seeding an empty database ingests the starter paper for every user', async () => {
    const id = await seedStarterPaper()
    expect(id).not.toBeNull()
    for (const u of [1, 2, 3]) expect(ids(await req(u, 'GET', '/api/papers'))).toEqual([id])
    expect(await seedStarterPaper()).toBeNull() // not empty any more
  })

  test('migration backfill: starter paper + interacted papers only', () => {
    const starter = addPaper('1706.03762')
    const [tagged, noted, asked, highlighted, linked, untouched] = [1, 2, 3, 4, 5, 6].map(() => addPaper(null))
    const tag = db.insert(schema.tags).values({ user_id: 1, name: 't' }).returning().get().id
    db.insert(schema.paperTags).values({ paper_id: tagged, tag_id: tag }).run()
    db.insert(schema.notes).values({ user_id: 1, paper_id: noted, body: 'x', created_at: now(), updated_at: now() }).run()
    db.insert(schema.qaEntries).values({ paper_id: asked, user_id: 1, type: 'free', prompt: 'q' }).run()
    sqlite.run(`INSERT INTO highlights (user_id, pathname, content_hash, start_offset, end_offset, text, color, created_at) VALUES (1, '/papers/${highlighted}', 'h', 0, 1, 'x', 'yellow', 'now')`)
    db.insert(schema.paperReferenceLinks).values({ user_id: 2, paper_id: linked, url: 'https://x', created_at: now(), updated_at: now() }).run()

    const backfill = readFileSync(resolve(MIGRATIONS_DIR, '0031_user_papers.sql'), 'utf8').split('--> statement-breakpoint')[2]
    sqlite.run(backfill)
    const lib = (u: number) => (sqlite.query('SELECT paper_id FROM user_papers WHERE user_id = ? AND in_library = 1 ORDER BY paper_id').all(u) as any[]).map(r => r.paper_id)
    expect(lib(1)).toEqual([starter, tagged, noted, asked, highlighted])
    expect(lib(2)).toEqual([starter, linked])
    expect(lib(3)).toEqual([starter])
    expect(lib(1)).not.toContain(untouched)
  })
})

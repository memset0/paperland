import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { highlightsRoutes } from './highlights.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
const USERS = [
  { id: 1, username: 'alice', role: 'user' },
  { id: 2, username: 'bob', role: 'user' },
  { id: 3, username: 'admin', role: 'admin' },
]

let sqlite: Database
let app: FastifyInstance

beforeEach(async () => {
  sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  setDatabaseForTesting(db)
  sqlite.exec(`
    INSERT INTO users (id, username, password_hash, role, created_at) VALUES
      (1,'alice','h','user','t'),(2,'bob','h','user','t'),(3,'admin','h','admin','t');
    INSERT INTO papers (id, title, authors, listed, created_at, updated_at) VALUES (42,'P','[]',1,'t','t');
    INSERT INTO highlights (id, user_id, pathname, content_hash, start_offset, end_offset, text, color, created_at) VALUES
      (1,1,'/papers/42','h',0,3,'abc','yellow','t'),
      (2,2,'/papers/42','h',4,6,'de','green','t');
  `)
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    request.user = (USERS.find((u) => u.id === id) as any) ?? null
  })
  await app.register(highlightsRoutes)
})

afterEach(async () => {
  await app.close()
  sqlite.close()
})

const get = (user: number, scope?: string) => app.inject({
  method: 'GET',
  url: `/api/highlights?pathname=/papers/42${scope ? `&scope=${scope}` : ''}`,
  headers: user ? { 'x-test-user': String(user) } : {},
})

describe('highlight visibility', () => {
  test('mine is the default', async () => {
    expect((await get(1)).json().data.map((h: any) => h.id)).toEqual([1])
  })

  test('all includes shared highlights with attribution', async () => {
    const data = (await get(1, 'all')).json().data
    expect(data.map((h: any) => h.id).sort()).toEqual([1, 2])
    expect(data.find((h: any) => h.id === 2)).toMatchObject({ user_id: 2, username: 'bob', shared: true })
  })

  test('opted-out highlights hidden from non-admins, visible to admin flagged private', async () => {
    sqlite.exec(`INSERT INTO user_sharing_settings VALUES (2,'highlights',0,'t')`)
    expect((await get(1, 'all')).json().data.map((h: any) => h.id)).toEqual([1])
    const admin = (await get(3, 'all')).json().data
    expect(admin.find((h: any) => h.id === 2).shared).toBe(false)
  })

  test('anonymous sees nothing', async () => {
    const res = await get(0, 'all')
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  test('non-owner cannot recolor or delete a visible highlight', async () => {
    const put = await app.inject({ method: 'PUT', url: '/api/highlights/2', headers: { 'x-test-user': '1' }, payload: { color: 'pink' } })
    expect(put.statusCode).toBe(404)
    const del = await app.inject({ method: 'DELETE', url: '/api/highlights/2', headers: { 'x-test-user': '1' } })
    expect(del.statusCode).toBe(404)
    expect(sqlite.query('SELECT color FROM highlights WHERE id=2').get()).toEqual({ color: 'green' })
  })
})

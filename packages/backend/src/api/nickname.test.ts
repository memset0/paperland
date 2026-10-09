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
import { authRoutes } from './auth.js'
import { userRoutes } from './users.js'
import { referenceLinksRoutes } from './reference_links.js'
import { notesRoutes } from './notes.js'

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')

let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance

function inject(userId: number | null, method: 'GET' | 'PATCH', url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as any, headers: userId ? { 'x-test-user': String(userId) } : {} })
}

beforeEach(async () => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  setDatabaseForTesting(db)
  const now = new Date().toISOString()
  for (const [username, role] of [['alice', 'user'], ['bob', 'user'], ['root', 'admin']]) {
    db.insert(schema.users).values({ username, password_hash: 'x', role, created_at: now }).run()
  }
  db.insert(schema.papers).values({ id: 42, title: 'T', authors: '[]', created_at: now, updated_at: now }).run()
  db.insert(schema.paperReferenceLinks).values({ user_id: 1, paper_id: 42, url: 'https://a.example', created_at: now, updated_at: now }).run()
  db.insert(schema.notes).values({ user_id: 1, paper_id: 42, body: '# hi', created_at: now, updated_at: now }).run()

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    const row = id ? db.select().from(schema.users).where(eq(schema.users.id, id)).get() : undefined
    request.user = row ? toSessionUser(row) : null
  })
  await app.register(authRoutes)
  await app.register(userRoutes)
  await app.register(referenceLinksRoutes)
  await app.register(notesRoutes)
})

afterEach(async () => {
  await app.close()
  sqlite.close()
})

describe('nickname', () => {
  test('new users have no nickname', async () => {
    const res = await inject(1, 'GET', '/api/auth/me')
    expect(res.json().user).toEqual({ id: 1, username: 'alice', nickname: null, role: 'user' })
  })

  test('self-service set (trimmed), duplicate allowed, and clear', async () => {
    let res = await inject(1, 'PATCH', '/api/auth/me', { nickname: '  Alice W  ' })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.nickname).toBe('Alice W')

    res = await inject(2, 'PATCH', '/api/auth/me', { nickname: 'Alice W' })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.nickname).toBe('Alice W')

    res = await inject(1, 'PATCH', '/api/auth/me', { nickname: '' })
    expect(res.json().user.nickname).toBeNull()
  })

  test('rejects too long or non-string nicknames without changes', async () => {
    await inject(1, 'PATCH', '/api/auth/me', { nickname: 'keep' })
    for (const nickname of ['x'.repeat(33), 5, { a: 1 }]) {
      const res = await inject(1, 'PATCH', '/api/auth/me', { nickname, username: 'changed' })
      expect(res.statusCode).toBe(400)
    }
    const me = (await inject(1, 'GET', '/api/auth/me')).json().user
    expect(me).toMatchObject({ username: 'alice', nickname: 'keep' })
    expect((await inject(1, 'PATCH', '/api/auth/me', { nickname: 'x'.repeat(32) })).statusCode).toBe(200)
  })

  test('admin lists and edits nicknames; non-admin forbidden', async () => {
    let res = await inject(3, 'PATCH', '/api/users/2', { nickname: ' Bobby ' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.nickname).toBe('Bobby')
    res = await inject(3, 'GET', '/api/users')
    expect(res.json().data.find((u: any) => u.id === 2).nickname).toBe('Bobby')
    expect((await inject(3, 'PATCH', '/api/users/2', { nickname: 'x'.repeat(40) })).statusCode).toBe(400)
    expect((await inject(1, 'PATCH', '/api/users/2', { nickname: 'hack' })).statusCode).toBe(403)
  })

  test('attribution carries display_name with username fallback', async () => {
    let links = (await inject(2, 'GET', '/api/papers/42/reference-links?scope=all')).json().data
    expect(links[0]).toMatchObject({ username: 'alice', display_name: 'alice' })

    await inject(1, 'PATCH', '/api/auth/me', { nickname: 'Alice W' })
    links = (await inject(2, 'GET', '/api/papers/42/reference-links?scope=all')).json().data
    expect(links[0]).toMatchObject({ username: 'alice', display_name: 'Alice W' })

    const notes = (await inject(2, 'GET', '/api/notes?scope=all')).json().data
    expect(notes[0]).toMatchObject({ username: 'alice', display_name: 'Alice W' })
    expect(notes[0]).not.toHaveProperty('nickname')
    const others = (await inject(2, 'GET', '/api/papers/42/public-notes')).json().data
    expect(others[0]).toMatchObject({ display_name: 'Alice W' })
  })
})

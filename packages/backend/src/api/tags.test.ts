import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { and, eq } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { tagRoutes } from './tags.js'
import { TAG_COLOR_PALETTE } from '../utils/tag-colors.js'

/**
 * HTTP-level tests for the tag-management API, focused on the new
 * `POST /api/tags` create endpoint:
 *   - creates a tag for the current user with an auto-assigned palette color
 *   - honors an explicitly provided color
 *   - rejects an empty name (400)
 *   - returns 409 on a duplicate name within the same user (no dup row)
 *   - allows the same name across different users (per-user isolation)
 *   - rejects anonymous create (401)
 *
 * We bring up Fastify with an in-memory DB (via setDatabaseForTesting) and a
 * global preHandler that mimics index.ts's auth hook — flipping `currentUserId`
 * selects which user (or anonymous) the next inject() call is made as.
 */

let db: ReturnType<typeof drizzle>
let sqlite: Database
let app: FastifyInstance
let userA: number
let userB: number

// Which user the next inject() runs as; null = anonymous.
let currentUserId: number | null = null

beforeAll(async () => {
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  const migrationsFolder = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
  migrate(db, { migrationsFolder })
  setDatabaseForTesting(db)

  const now = new Date().toISOString()
  userA = db.insert(schema.users).values({ username: 'alice', password_hash: 'x', role: 'user', created_at: now }).returning().get().id
  userB = db.insert(schema.users).values({ username: 'bob', password_hash: 'x', role: 'user', created_at: now }).returning().get().id

  app = Fastify()
  // Mimic the global auth hook index.ts installs at onRequest (before preHandler),
  // so the route plugin's requireUser preHandler sees the resolved user.
  app.addHook('onRequest', async (request) => {
    request.user = currentUserId == null
      ? null
      : ({ id: currentUserId, username: `u${currentUserId}`, role: 'user' } as any)
  })
  await app.register(tagRoutes)
  await app.ready()
})

function post(payload: unknown) {
  return app.inject({ method: 'POST', url: '/api/tags', payload: payload as any })
}

describe('POST /api/tags', () => {
  it('creates a tag for the current user with an auto-assigned palette color', async () => {
    currentUserId = userA
    const res = await post({ name: 'machine-learning' })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeGreaterThan(0)
    expect(body.name).toBe('machine-learning')
    expect(body.visible).toBe(true)
    expect(body.paper_count).toBe(0)
    expect(TAG_COLOR_PALETTE).toContain(body.color)
  })

  it('honors an explicitly provided color', async () => {
    currentUserId = userA
    const res = await post({ name: 'nlp', color: '#123456' })
    expect(res.statusCode).toBe(201)
    expect(res.json().color).toBe('#123456')
  })

  it('trims and rejects an empty name with 400', async () => {
    currentUserId = userA
    const res = await post({ name: '   ' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('TAG_NAME_REQUIRED')
  })

  it('returns 409 on a duplicate name within the same user and creates no duplicate', async () => {
    currentUserId = userA
    const first = await post({ name: 'dup' })
    expect(first.statusCode).toBe(201)
    const firstId = first.json().id

    const second = await post({ name: 'dup' })
    expect(second.statusCode).toBe(409)
    const body = second.json()
    expect(body.error.code).toBe('TAG_NAME_CONFLICT')
    expect(body.target_tag.id).toBe(firstId)

    const rows = db.select().from(schema.tags)
      .where(and(eq(schema.tags.user_id, userA), eq(schema.tags.name, 'dup'))).all()
    expect(rows.length).toBe(1)
  })

  it('allows the same name for a different user (per-user isolation)', async () => {
    currentUserId = userA
    expect((await post({ name: 'shared' })).statusCode).toBe(201)

    currentUserId = userB
    const res = await post({ name: 'shared' })
    expect(res.statusCode).toBe(201)

    const rows = db.select().from(schema.tags).where(eq(schema.tags.name, 'shared')).all()
    expect(rows.length).toBe(2)
  })

  it('rejects anonymous create with 401', async () => {
    currentUserId = null
    const res = await post({ name: 'anon' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })
})

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { and, eq } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { tokenAuth } from '../auth/token_auth.js'
import { ensureAgentToken, resetAgentToken } from '../services/api_tokens.js'
import { createMcpService } from '../services/mcp_services.js'
import { tokenRoutes } from './tokens.js'
import { settingsRoutes } from './settings.js'
import { userRoutes } from './users.js'

let app: FastifyInstance
let db: ReturnType<typeof drizzle<typeof schema>>
const now = new Date().toISOString()
const alice = { id: 1, username: 'alice', role: 'user' }
const bob = { id: 2, username: 'bob', role: 'user' }
const admin = { id: 3, username: 'root', role: 'admin' }

function as(user: { id: number } | null) {
  return user ? { 'x-test-user': String(user.id) } : {}
}
function agentRows(userId: number) {
  return db.select().from(schema.apiTokens).where(and(eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'agent'))).all()
}

beforeAll(async () => {
  loadConfig()
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    request.user = ([alice, bob, admin].find((u) => u.id === id) as any) ?? null
  })
  await app.register(tokenRoutes)
  await app.register(settingsRoutes)
  await app.register(userRoutes)
  // Stand-in External API route guarded like the real ones.
  app.get('/external-api/v1/ping', { preHandler: tokenAuth }, async (request) => ({ user_id: request.user?.id ?? null }))
  await app.ready()
})

afterAll(async () => { await app.close() })

beforeEach(() => {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  for (const u of [alice, bob, admin]) {
    db.insert(schema.users).values({ id: u.id, username: u.username, password_hash: 'x', role: u.role, created_at: now }).run()
  }
})

describe('agent token', () => {
  it('is created once per user: ensure is idempotent and the index forbids a second row', () => {
    const first = ensureAgentToken(alice.id)
    expect(ensureAgentToken(alice.id).id).toBe(first.id)
    expect(agentRows(alice.id)).toHaveLength(1)
    expect(() => db.insert(schema.apiTokens).values({ token: 'sk-dup', user_id: alice.id, kind: 'agent', created_at: now }).run()).toThrow()
    expect(first.token).toMatch(/^sk-[0-9a-f]{64}$/)
  })

  it('reset replaces the value in place and records the time', () => {
    const before = ensureAgentToken(alice.id)
    const after = resetAgentToken(alice.id)
    expect(after.id).toBe(before.id)
    expect(after.token).not.toBe(before.token)
    expect(after.rotated_at).not.toBeNull()
    expect(agentRows(alice.id)).toHaveLength(1)
  })

  it('is rejected by the External API, while Plugins service keys work there', async () => {
    const agent = ensureAgentToken(alice.id).token
    const rejected = await app.inject({ url: '/external-api/v1/ping', headers: { authorization: `Bearer ${agent}` } })
    expect(rejected.statusCode).toBe(401)
    const key = createMcpService(alice.id, { name: 'Zotero' }).secret
    const ok = await app.inject({ url: '/external-api/v1/ping', headers: { authorization: `Bearer ${key}` } })
    expect(ok.json()).toEqual({ user_id: alice.id })
  })

  it('External API rejects keys of inactive owners and owner-less legacy tokens', async () => {
    const key = createMcpService(alice.id, { name: 'Zotero' }).secret
    db.update(schema.users).set({ status: 'pending' }).where(eq(schema.users.id, alice.id)).run()
    const rejected = await app.inject({ url: '/external-api/v1/ping', headers: { authorization: `Bearer ${key}` } })
    expect(rejected.statusCode).toBe(401)
    db.insert(schema.apiTokens).values({ token: 'sk-legacy', created_at: new Date().toISOString() }).run()
    expect((await app.inject({ url: '/external-api/v1/ping', headers: { authorization: 'Bearer sk-legacy' } })).statusCode).toBe(401)
  })
})

describe('/api/auth/me/agent-token', () => {
  it('requires login', async () => {
    expect((await app.inject({ url: '/api/auth/me/agent-token' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/api/auth/me/agent-token/reset' })).statusCode).toBe(401)
  })

  it('returns only times, never the agent token value; personal token routes are gone', async () => {
    const info = await app.inject({ url: '/api/auth/me/agent-token', headers: as(alice) })
    expect(Object.keys(info.json().data).sort()).toEqual(['created_at', 'rotated_at'])
    const agentValue = agentRows(alice.id)[0].token
    expect(info.body).not.toContain(agentValue)
    const reset = await app.inject({ method: 'POST', url: '/api/auth/me/agent-token/reset', headers: as(alice) })
    expect(reset.json().data.rotated_at).not.toBeNull()
    expect(reset.body).not.toContain(agentRows(alice.id)[0].token)
    expect(agentRows(alice.id)[0].token).not.toBe(agentValue)
    expect((await app.inject({ method: 'POST', url: '/api/auth/me/tokens', headers: as(alice) })).statusCode).toBe(404)
    expect((await app.inject({ url: '/api/auth/me/tokens', headers: as(alice) })).statusCode).toBe(404)
  })
})

describe('admin token list', () => {
  it('labels agent tokens, hides their value, and refuses to revoke them', async () => {
    const agent = ensureAgentToken(alice.id)
    const list = (await app.inject({ url: '/api/settings/tokens', headers: as(admin) })).json().data
    const row = list.find((t: any) => t.id === agent.id)
    expect(row).toMatchObject({ kind: 'agent', token: null, user_id: alice.id })
    const del = await app.inject({ method: 'DELETE', url: `/api/settings/tokens/${agent.id}`, headers: as(admin) })
    expect(del.statusCode).toBe(400)
    expect((await app.inject({ url: '/api/settings/tokens', headers: as(alice) })).statusCode).toBe(403)
  })
})

describe('user lifecycle', () => {
  it('creates the agent token for admin-created and approved users; rejecting a pending user still works', async () => {
    const created = (await app.inject({ method: 'POST', url: '/api/users', headers: as(admin), payload: { username: 'carol', password: 'pw-123456' } })).json().data
    expect(agentRows(created.id)).toHaveLength(1)
    db.insert(schema.users).values({ id: 20, username: 'pending', password_hash: 'x', role: 'user', status: 'pending', created_at: now }).run()
    expect(agentRows(20)).toHaveLength(0)
    await app.inject({ method: 'POST', url: '/api/users/20/approve', headers: as(admin) })
    expect(agentRows(20)).toHaveLength(1)
    db.insert(schema.users).values({ id: 21, username: 'pending2', password_hash: 'x', role: 'user', status: 'pending', created_at: now }).run()
    expect((await app.inject({ method: 'DELETE', url: '/api/users/21', headers: as(admin) })).statusCode).toBe(200)
  })
})

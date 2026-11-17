import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { mcpServiceRoutes } from './mcp_services.js'
import { settingsRoutes } from './settings.js'
import { mcpRoutes } from './mcp.js'

let app: FastifyInstance
const now = new Date().toISOString()
const users = [{ id: 1, username: 'alice', role: 'user' }, { id: 2, username: 'bob', role: 'user' }, { id: 3, username: 'root', role: 'admin' }]
const as = (id: number) => ({ 'x-test-user': String(id) })

beforeAll(async () => {
  loadConfig()
  app = Fastify()
  app.addHook('onRequest', async (request) => { request.user = (users.find((u) => u.id === Number(request.headers['x-test-user'] || 0)) as any) ?? null })
  await app.register(mcpServiceRoutes)
  await app.register(settingsRoutes)
  await app.register(mcpRoutes)
  await app.ready()
})
afterAll(async () => { await app.close() })
beforeEach(() => {
  const db = drizzle(new Database(':memory:'), { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  for (const u of users) db.insert(schema.users).values({ ...u, password_hash: 'x', created_at: now }).run()
})

describe('/api/auth/me/mcp-services', () => {
  it('creates with a one-time URL, lists without secrets, edits, rotates and revokes own services only', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/me/mcp-services' })).statusCode).toBe(401)
    const created = await app.inject({ method: 'POST', url: '/api/auth/me/mcp-services', headers: as(1), payload: { name: 'ChatGPT' } })
    expect(created.statusCode).toBe(201)
    const svc = created.json().data
    expect(svc.url_path).toMatch(/^\/mcp\/s\/pls_[0-9a-f]{64}$/)
    expect(svc.permissions).toEqual({ write: true, delete_papers: false, delete_answers: false })
    const listed = (await app.inject({ method: 'GET', url: '/api/auth/me/mcp-services', headers: as(1) })).json().data
    expect(listed).toHaveLength(1)
    expect(JSON.stringify(listed)).not.toContain(svc.url_path.slice(7))
    expect((await app.inject({ method: 'GET', url: '/api/auth/me/mcp-services', headers: as(2) })).json().data).toEqual([])
    expect((await app.inject({ method: 'PATCH', url: `/api/auth/me/mcp-services/${svc.id}`, headers: as(2), payload: { name: 'x' } })).statusCode).toBe(404)
    const edited = (await app.inject({ method: 'PATCH', url: `/api/auth/me/mcp-services/${svc.id}`, headers: as(1), payload: { name: 'Claude', permissions: { delete_answers: true } } })).json().data
    expect(edited).toMatchObject({ name: 'Claude', permissions: { write: true, delete_papers: false, delete_answers: true } })
    expect((await app.inject({ method: 'PATCH', url: `/api/auth/me/mcp-services/${svc.id}`, headers: as(1), payload: { permissions: { admin: true } } })).statusCode).toBe(422)
    expect((await app.inject({ method: 'POST', url: '/api/auth/me/mcp-services', headers: as(1), payload: { name: '' } })).statusCode).toBe(422)
    const rotated = (await app.inject({ method: 'POST', url: `/api/auth/me/mcp-services/${svc.id}/rotate`, headers: as(1) })).json().data
    expect(rotated.url_path).not.toBe(svc.url_path)
    const ping = (path: string) => app.inject({ method: 'POST', url: path, payload: { jsonrpc: '2.0', id: 1, method: 'ping' } }).then((r) => r.statusCode)
    expect(await ping(svc.url_path)).toBe(404)
    expect(await ping(rotated.url_path)).toBe(200)
    // Admins see the service (name, owner) but never a key value.
    const adminList = await app.inject({ method: 'GET', url: '/api/settings/tokens', headers: as(3) })
    expect(adminList.json().data).toEqual([expect.objectContaining({ id: svc.id, kind: 'service', name: 'Claude', token: null, user_id: 1 })])
    expect(adminList.body).not.toContain(rotated.url_path.split('/').pop()!)
    expect((await app.inject({ method: 'DELETE', url: `/api/auth/me/mcp-services/${svc.id}`, headers: as(2) })).statusCode).toBe(404)
    expect((await app.inject({ method: 'DELETE', url: `/api/auth/me/mcp-services/${svc.id}`, headers: as(1) })).statusCode).toBe(200)
    expect(await ping(rotated.url_path)).toBe(404)
    expect((await app.inject({ method: 'GET', url: '/api/auth/me/mcp-services', headers: as(1) })).json().data).toEqual([])
  })
})

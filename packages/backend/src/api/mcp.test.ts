import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { getDatabase, setDatabaseForTesting } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { createPersonalToken, ensureAgentToken, resetAgentToken } from '../services/api_tokens.js'
import { mcpRoutes } from './mcp.js'

// No S2 calls here: only site tools and protocol handling are exercised.

let app: FastifyInstance
let token = ''
let agentToken = ''
const now = new Date().toISOString()

function post(body: unknown, auth: string | null = `Bearer ${token}`) {
  return app.inject({ method: 'POST', url: '/mcp', headers: auth ? { authorization: auth } : {}, payload: body as any })
}

beforeAll(async () => {
  loadConfig()
  app = Fastify()
  await app.register(mcpRoutes)
  await app.ready()
})

afterAll(async () => { await app.close() })

beforeEach(() => {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  db.insert(schema.users).values({ id: 1, username: 'owner', password_hash: 'x', role: 'user', created_at: now }).run()
  db.insert(schema.papers).values({ id: 5, title: 'Paper Five', authors: '[]', listed: 1, created_at: now, updated_at: now }).run()
  token = createPersonalToken(1).token
  agentToken = ensureAgentToken(1).token
})

describe('POST /mcp', () => {
  it('rejects missing, unknown, and revoked tokens with 401', async () => {
    const msg = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await post(msg, null)).statusCode).toBe(401)
    expect((await post(msg, 'Bearer nope')).statusCode).toBe(401)
    getDatabase().update(schema.apiTokens).set({ revoked_at: now }).where(eq(schema.apiTokens.token, token)).run()
    expect((await post(msg)).statusCode).toBe(401)
  })

  it('accepts both personal and agent tokens, from any origin', async () => {
    const msg = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await post(msg)).json()).toEqual({ jsonrpc: '2.0', id: 1, result: {} })
    expect((await post(msg, `Bearer ${agentToken}`)).statusCode).toBe(200)
    const proxied = await app.inject({ method: 'POST', url: '/mcp', remoteAddress: '203.0.113.9', headers: { authorization: `Bearer ${agentToken}`, 'x-forwarded-for': '203.0.113.9' }, payload: msg })
    expect(proxied.statusCode).toBe(200)
  })

  it('stops accepting the old agent token value after a reset', async () => {
    const msg = { jsonrpc: '2.0', id: 1, method: 'ping' }
    const fresh = resetAgentToken(1).token
    expect((await post(msg, `Bearer ${agentToken}`)).statusCode).toBe(401)
    expect((await post(msg, `Bearer ${fresh}`)).statusCode).toBe(200)
  })

  it('rejects tokens of accounts that are not active', async () => {
    getDatabase().update(schema.users).set({ status: 'pending' }).where(eq(schema.users.id, 1)).run()
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' })).statusCode).toBe(401)
  })

  it('initializes with a supported protocol version and lists read-only tools', async () => {
    const init = (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })).json()
    expect(init.result.protocolVersion).toBe('2025-03-26')
    expect(init.result.capabilities.tools).toBeDefined()
    const unknown = (await post({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).json()
    expect(unknown.result.protocolVersion).toBe('2025-06-18')
    const list = (await post({ jsonrpc: '2.0', id: 3, method: 'tools/list' })).json()
    const names = list.result.tools.map((t: any) => t.name)
    expect(names).toEqual(expect.arrayContaining(['search_papers', 'read_paper', 's2_search', 's2_match', 's2_get']))
    expect(list.result.tools.every((t: any) => t.annotations.readOnlyHint === true)).toBe(true)
  })

  it('answers notifications with 202, unknown methods with -32601, and supports batches', async () => {
    const note = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(note.statusCode).toBe(202)
    expect(note.body).toBe('')
    expect((await post({ jsonrpc: '2.0', id: 9, method: 'resources/list' })).json().error.code).toBe(-32601)
    const batch = (await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }])).json()
    expect(batch).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }])
  })

  it('calls tools as the token user and reports tool failures as isError results', async () => {
    const res = (await post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_paper', arguments: { paper_id: 5 } } })).json()
    expect(res.result.isError).toBe(false)
    expect(JSON.parse(res.result.content[0].text)).toMatchObject({ paper_id: 5, title: 'Paper Five', in_my_library: false })
    const missing = (await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_paper', arguments: { paper_id: 404 } } })).json()
    expect(missing.result).toEqual({ content: [{ type: 'text', text: 'Paper 404 not found' }], isError: true })
  })

  it('GET and DELETE are not allowed', async () => {
    expect((await app.inject({ method: 'GET', url: '/mcp' })).statusCode).toBe(405)
    expect((await app.inject({ method: 'DELETE', url: '/mcp' })).statusCode).toBe(405)
  })
})

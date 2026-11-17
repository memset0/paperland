import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { schema } from '../db/index'
import { topicFixture } from '../testing/topic_fixture'
import { checkBearerToken, ensureAgentToken } from './api_tokens'
import { requireTopicAccess, setTopicDefaultAccess, setTopicMember } from './topic_access'
import { createMcpService, revokeMcpService, rotateMcpService, serviceVerifier } from './mcp_services'
import { mcpCountsForUser, parseCallCounts, recordMcpCall } from './mcp_counts'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setDatabaseForTesting } from '../db/index'
import Fastify from 'fastify'
import { tokenAuth } from '../auth/token_auth'
import { settingsRoutes } from '../api/settings'

let f: ReturnType<typeof topicFixture>
let topicId: number
beforeEach(() => {
  f = topicFixture()
  topicId = f.db.insert(schema.topics).values({ owner_id: 1, title: 'Fixture', created_at: f.now, updated_at: f.now }).returning().get().id
  f.db.insert(schema.topicMembers).values({ topic_id: topicId, user_id: 1, role: 'owner' }).run()
})
afterEach(() => f.close())

describe('Topic identities, membership and credentials (offline)', () => {
  test('public defaults, explicit exceptions and counter-only membership follow policy without sticky grants', async () => {
    await setTopicDefaultAccess(topicId, 1, 'editor')
    expect(requireTopicAccess(topicId, 4, 'editor').member.role).toBe('editor')
    expect(() => requireTopicAccess(topicId, 5)).toThrow('not found')
    await expect(setTopicDefaultAccess(topicId, 4, 'none')).rejects.toThrow('permission')
    await setTopicMember(topicId, 1, 'viewer', 'viewer')
    expect(requireTopicAccess(topicId, 3, 'editor').member.role).toBe('editor')
    recordMcpCall(4, 'get_topic', topicId)
    expect(requireTopicAccess(topicId, 4).member.mcp_call_counts).toContain('get_topic')
    await setTopicDefaultAccess(topicId, 1, 'viewer')
    await setTopicMember(topicId, 1, 'editor', 'editor')
    expect(requireTopicAccess(topicId, 2, 'editor').member.role).toBe('editor')
    expect(requireTopicAccess(topicId, 4).member.role).toBe('viewer')
    await setTopicDefaultAccess(topicId, 1, 'none')
    expect(() => requireTopicAccess(topicId, 4)).toThrow('not found')
    expect(requireTopicAccess(topicId, 3).member.role).toBe('viewer')
    await setTopicDefaultAccess(topicId, 1, 'editor')
    expect(requireTopicAccess(topicId, 4).member.mcp_call_counts).toContain('get_topic')
    await setTopicMember(topicId, 1, 'outsider', null)
    expect(requireTopicAccess(topicId, 4, 'editor').member.role).toBe('editor')
    recordMcpCall(4, 'get_topic', topicId)
    expect(JSON.parse(requireTopicAccess(topicId, 4).member.mcp_call_counts).get_topic).toBe(2)
    await setTopicMember(topicId, 1, 'outsider', 'editor')
    expect(requireTopicAccess(topicId, 4).member.role).toBe('editor')
  })
  test('owner controls sharing and site-admin status does not grant membership', async () => {
    await setTopicMember(topicId, 1, 'editor', 'editor')
    await setTopicMember(topicId, 1, 'viewer', 'viewer')
    expect(requireTopicAccess(topicId, 2, 'editor').member.role).toBe('editor')
    expect(() => requireTopicAccess(topicId, 3, 'editor')).toThrow('permission')
    expect(() => requireTopicAccess(topicId, 4)).toThrow('not found')
    await expect(setTopicMember(topicId, 2, 'outsider', 'editor')).rejects.toThrow('permission')
    await expect(setTopicMember(topicId, 1, 'inactive', 'viewer')).rejects.toThrow('Active user')
    await expect(setTopicMember(topicId, 1, 'owner', null)).rejects.toThrow('owner membership')
  })
  test('service keys are hashed, rotatable, revocable and follow their owner status', async () => {
    const svc = createMcpService(2, { name: 'Agent' })
    expect(checkBearerToken(svc.secret, ['service']).ok).toBe(true)
    const stored = f.db.select().from(schema.apiTokens).where(eq(schema.apiTokens.id, svc.id)).get()!
    expect(stored.token).toBe(serviceVerifier(svc.secret))
    expect(checkBearerToken(stored.token, ['service']).ok).toBe(false)
    expect(checkBearerToken(svc.secret, ['agent']).ok).toBe(false)
    const rotated = rotateMcpService(2, svc.id)
    expect(checkBearerToken(svc.secret, ['service']).ok).toBe(false)
    expect(checkBearerToken(rotated.secret, ['service']).ok).toBe(true)
    expect(() => revokeMcpService(1, svc.id)).toThrow()
    const agent = ensureAgentToken(2).token
    expect(checkBearerToken(agent, ['agent']).ok).toBe(true)
    expect(checkBearerToken(agent, ['service']).ok).toBe(false)
    f.db.update(schema.users).set({ status: 'pending' }).where(eq(schema.users.id, 2)).run()
    expect(checkBearerToken(rotated.secret, ['service']).ok).toBe(false)
    f.db.update(schema.users).set({ status: 'active' }).where(eq(schema.users.id, 2)).run()
    revokeMcpService(2, svc.id)
    expect(checkBearerToken(rotated.secret, ['service']).ok).toBe(false)
  })
  test('External API takes service keys (write for non-GET) and admins see services without values', async () => {
    const full = createMcpService(1, { name: 'Zotero' }), reader = createMcpService(1, { name: 'Reader', permissions: { write: false } })
    const app = Fastify()
    app.addHook('onRequest', async (r) => { r.user = { id: 4, username: 'outsider', nickname: null, role: 'admin' } })
    app.get('/external-api/v1/health', { preHandler: tokenAuth }, async () => ({ status: 'ok' }))
    app.post('/external-api/v1/thing', { preHandler: tokenAuth }, async (r) => ({ user: r.user?.id }))
    await app.register(settingsRoutes)
    try {
      const auth = (value: string) => ({ authorization: `Bearer ${value}` })
      expect((await app.inject({ url: '/external-api/v1/health', headers: auth(full.secret) })).statusCode).toBe(200)
      expect((await app.inject({ method: 'POST', url: '/external-api/v1/thing', headers: auth(full.secret) })).json().user).toBe(1)
      expect((await app.inject({ url: '/external-api/v1/health', headers: auth(reader.secret) })).statusCode).toBe(200)
      expect((await app.inject({ method: 'POST', url: '/external-api/v1/thing', headers: auth(reader.secret) })).statusCode).toBe(403)
      expect((await app.inject({ url: '/external-api/v1/health', headers: auth(ensureAgentToken(1).token) })).statusCode).toBe(401)
      expect((await app.inject({ url: '/external-api/v1/health', headers: auth(serviceVerifier(full.secret)) })).statusCode).toBe(401)
      const listed = (await app.inject({ url: '/api/settings/tokens' })).json().data
      expect(listed.find((t: any) => t.id === full.id)).toMatchObject({ kind: 'service', name: 'Zotero', token: null })
      expect(JSON.stringify(listed)).not.toContain(full.secret)
      const agentRow = listed.find((t: any) => t.kind === 'agent')
      expect((await app.inject({ method: 'DELETE', url: `/api/settings/tokens/${agentRow.id}` })).statusCode).toBe(400)
      expect((await app.inject({ method: 'DELETE', url: `/api/settings/tokens/${full.id}` })).statusCode).toBe(200)
      expect(checkBearerToken(full.secret, ['service']).ok).toBe(false)
      expect((await app.inject({ method: 'POST', url: '/api/settings/tokens' })).statusCode).toBe(404)
    } finally { await app.close() }
  })
})

describe('MCP aggregate counters (offline)', () => {
  test('zeros, ordinary calls and Topic subtotals independent of credentials', async () => {
    expect(mcpCountsForUser(1, ['read_paper'])).toEqual({ read_paper: 0 })
    await Promise.all(Array.from({ length: 20 }, async () => recordMcpCall(1, 'read_paper', topicId)))
    recordMcpCall(1, 'read_paper')
    expect(mcpCountsForUser(1, ['read_paper'])).toEqual({ read_paper: 21 })
    const member = () => f.db.select().from(schema.topicMembers).where(and(eq(schema.topicMembers.topic_id, topicId), eq(schema.topicMembers.user_id, 1))).get()!
    expect(parseCallCounts(member().mcp_call_counts)).toEqual({ read_paper: 20 })
    const svc = createMcpService(1, { name: 'Counter' })
    rotateMcpService(1, svc.id)
    expect(mcpCountsForUser(1, ['read_paper']).read_paper).toBe(21)
    expect(() => recordMcpCall(2, 'read_paper', topicId)).toThrow()
    expect(mcpCountsForUser(2, ['read_paper']).read_paper).toBe(0)
    const file = join(f.root, 'persisted-counts.db')
    writeFileSync(file, f.sqlite.serialize())
    const restarted = new Database(file)
    try {
      setDatabaseForTesting(drizzle(restarted, { schema }))
      expect(mcpCountsForUser(1, ['read_paper']).read_paper).toBe(21)
      recordMcpCall(1, 'read_paper', topicId)
      expect(mcpCountsForUser(1, ['read_paper']).read_paper).toBe(22)
    } finally { restarted.close(); setDatabaseForTesting(f.db) }
  })
})

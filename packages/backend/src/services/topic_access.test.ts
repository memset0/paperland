import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { schema } from '../db/index'
import { topicFixture } from '../testing/topic_fixture'
import { checkBearerToken, createPersonalToken, ensureAgentToken } from './api_tokens'
import { issueTopicCredential, listTopicCredentials, requireTopicAccess, revokeTopicCredential, setTopicDefaultAccess, setTopicMember, topicTokenVerifier } from './topic_access'
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
    const credential = await issueTopicCredential(topicId, 4)
    recordMcpCall(4, 'get_topic', topicId)
    expect(requireTopicAccess(topicId, 4).member.mcp_call_counts).toContain('get_topic')
    await setTopicDefaultAccess(topicId, 1, 'viewer')
    await setTopicMember(topicId, 1, 'editor', 'editor')
    expect(requireTopicAccess(topicId, 2, 'editor').member.role).toBe('editor')
    expect(requireTopicAccess(topicId, 4).member.role).toBe('viewer')
    expect(checkBearerToken(credential.token, ['topic']).ok).toBe(true)
    await setTopicDefaultAccess(topicId, 1, 'none')
    expect(() => requireTopicAccess(topicId, 4)).toThrow('not found')
    expect(checkBearerToken(credential.token, ['topic']).ok).toBe(false)
    expect(requireTopicAccess(topicId, 3).member.role).toBe('viewer')
    await setTopicDefaultAccess(topicId, 1, 'editor')
    expect(requireTopicAccess(topicId, 4).member.mcp_call_counts).toContain('get_topic')
    await setTopicMember(topicId, 1, 'outsider', null)
    expect(requireTopicAccess(topicId, 4, 'editor').member.role).toBe('editor')
    recordMcpCall(4, 'get_topic', topicId)
    expect(JSON.parse(requireTopicAccess(topicId, 4).member.mcp_call_counts).get_topic).toBe(2)
    await setTopicMember(topicId, 1, 'outsider', 'editor')
    expect(requireTopicAccess(topicId, 4).member.role).toBe('editor')
    expect(checkBearerToken(credential.token, ['topic']).ok).toBe(true)
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
  test('secrets are hashed, own-only, rotatable and bound to active membership', async () => {
    await setTopicMember(topicId, 1, 'editor', 'editor')
    const issued = await issueTopicCredential(topicId, 2)
    expect(checkBearerToken(issued.token, ['topic']).ok).toBe(true)
    const stored = f.db.select().from(schema.apiTokens).where(eq(schema.apiTokens.id, issued.id)).get()!
    expect(stored.token).toBe(topicTokenVerifier(issued.token))
    expect(checkBearerToken(stored.token, ['topic']).ok).toBe(false)
    expect(listTopicCredentials(topicId, 1)).toEqual([])
    expect(JSON.stringify(listTopicCredentials(topicId, 2))).not.toContain(issued.token)
    const rotated = await issueTopicCredential(topicId, 2, issued.id)
    expect(checkBearerToken(issued.token, ['topic']).ok).toBe(false)
    expect(checkBearerToken(rotated.token, ['personal', 'agent']).ok).toBe(false)
    await setTopicMember(topicId, 1, 'editor', 'viewer')
    expect(checkBearerToken(rotated.token, ['topic']).ok).toBe(true)
    expect(() => requireTopicAccess(topicId, 2, 'editor')).toThrow()
    await setTopicMember(topicId, 1, 'editor', null)
    expect(checkBearerToken(rotated.token, ['topic']).ok).toBe(false)
    await setTopicMember(topicId, 1, 'editor', 'editor')
    expect(checkBearerToken(rotated.token, ['topic']).ok).toBe(false)
  })
  test('revocation, inactive users and existing personal/agent credentials', async () => {
    const credential = await issueTopicCredential(topicId, 1)
    await expect(revokeTopicCredential(topicId, 2, credential.id)).rejects.toThrow()
    await revokeTopicCredential(topicId, 1, credential.id)
    expect(checkBearerToken(credential.token, ['topic']).ok).toBe(false)
    const personal = createPersonalToken(1).token
    const agent = ensureAgentToken(1).token
    expect(checkBearerToken(personal, ['personal']).ok).toBe(true)
    expect(checkBearerToken(agent, ['agent']).ok).toBe(true)
    f.db.update(schema.users).set({ status: 'pending' }).where(eq(schema.users.id, 1)).run()
    expect(checkBearerToken(personal, ['personal']).ok).toBe(false)
  })
  test('Topic secrets/verifiers cannot authorize the ordinary API or bypass Topic token management', async () => {
    const credential = await issueTopicCredential(topicId, 1)
    const app = Fastify()
    app.addHook('onRequest', async (r) => { r.user = { id: 4, username: 'outsider', nickname: null, role: 'admin' } })
    app.get('/external-api/v1/health', { preHandler: tokenAuth }, async () => ({ status: 'ok' }))
    await app.register(settingsRoutes)
    try {
      for (const value of [credential.token, topicTokenVerifier(credential.token)]) expect((await app.inject({ url: '/external-api/v1/health', headers: { authorization: `Bearer ${value}` } })).statusCode).toBe(401)
      expect((await app.inject({ url: '/api/settings/tokens' })).json().data).toEqual([])
      expect((await app.inject({ method: 'DELETE', url: `/api/settings/tokens/${credential.id}` })).statusCode).toBe(404)
      expect(checkBearerToken(credential.token, ['topic']).ok).toBe(true)
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
    const token = await issueTopicCredential(topicId, 1)
    await issueTopicCredential(topicId, 1, token.id)
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

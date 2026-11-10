import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import type { TopicCredential, TopicDefaultAccess, TopicMember, TopicRole } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { TopicError } from './topic_format.js'
import { withTopicLock } from './topic_lock.js'

export function topicTokenVerifier(secret: string): string {
  return `topic_sha256:${createHash('sha256').update(secret).digest('hex')}`
}

/** Correlated policy expression shared by reads, list queries and generated tag visibility. */
export function topicAccessRole(userId: number) {
  return sql<TopicRole | null>`case
    when not exists (select 1 from users where id = ${userId} and status = 'active') then null
    when ${schema.topics.owner_id} = ${userId} then 'owner'
    when ${schema.topics.default_access} = 'editor' or exists (select 1 from topic_members m where m.topic_id = ${schema.topics.id} and m.user_id = ${userId} and m.active = 1 and m.role = 'editor') then 'editor'
    when ${schema.topics.default_access} = 'viewer' or exists (select 1 from topic_members m where m.topic_id = ${schema.topics.id} and m.user_id = ${userId} and m.active = 1 and m.role = 'viewer') then 'viewer'
    else null end`
}

export function requireTopicAccess(topicId: number, userId: number, needed: TopicRole = 'viewer') {
  const db = getDatabase()
  const row = db.select({ topic: schema.topics, member: schema.topicMembers, user: schema.users })
    .from(schema.topics).leftJoin(schema.topicMembers, and(eq(schema.topics.id, schema.topicMembers.topic_id), eq(schema.topicMembers.user_id, userId)))
    .innerJoin(schema.users, eq(schema.users.id, userId))
    .where(and(eq(schema.topics.id, topicId), eq(schema.users.status, 'active'))).get()
  if (!row) throw new TopicError(404, 'Topic not found')
  const grant = row.member?.active === 1 ? row.member.role : null
  const role: TopicRole | null = row.topic.owner_id === userId ? 'owner'
    : row.topic.default_access === 'editor' || grant === 'editor' ? 'editor'
    : row.topic.default_access === 'viewer' || grant === 'viewer' ? 'viewer' : null
  if (!role) throw new TopicError(404, 'Topic not found')
  if (row.topic.legacy_migration_state && row.topic.legacy_migration_state !== 'complete') throw new TopicError(503, 'Topic migration is in progress')
  if ((needed === 'owner' && role !== 'owner') || (needed === 'editor' && role === 'viewer')) {
    throw new TopicError(403, 'This Topic permission does not allow that action')
  }
  return { ...row, member: { topic_id: topicId, user_id: userId, active: 1, mcp_call_counts: row.member?.mcp_call_counts ?? '{}', role } }
}

export async function setTopicDefaultAccess(topicId: number, ownerId: number, access: TopicDefaultAccess) {
  return withTopicLock(topicId, () => {
    requireTopicAccess(topicId, ownerId, 'owner')
    if (!['none', 'viewer', 'editor'].includes(access)) throw new TopicError(422, 'Default access must be none, viewer or editor')
    getDatabase().update(schema.topics).set({ default_access: access }).where(eq(schema.topics.id, topicId)).run()
    return { default_access: access }
  })
}

export function topicMembers(topicId: number, userId: number): TopicMember[] {
  requireTopicAccess(topicId, userId)
  return getDatabase().select({ user_id: schema.users.id, username: schema.users.username, nickname: schema.users.nickname, role: schema.topicMembers.role, active: schema.topicMembers.active })
    .from(schema.topicMembers).innerJoin(schema.users, eq(schema.users.id, schema.topicMembers.user_id))
    .where(and(eq(schema.topicMembers.topic_id, topicId), eq(schema.topicMembers.active, 1), eq(schema.users.status, 'active'), ne(schema.topicMembers.role, 'default'))).all()
    .map((r) => ({ user_id: r.user_id, username: r.username, display_name: r.nickname || r.username, role: r.role as TopicRole, effective_role: requireTopicAccess(topicId, r.user_id).member.role, active: r.active === 1 }))
}

export async function setTopicMember(topicId: number, ownerId: number, username: string, role: 'viewer' | 'editor' | null) {
  return withTopicLock(topicId, () => {
    const { topic } = requireTopicAccess(topicId, ownerId, 'owner')
    if (typeof username !== 'string' || !username.trim() || ![null, 'viewer', 'editor'].includes(role)) throw new TopicError(422, 'Provide an active username and viewer/editor permission')
    const db = getDatabase()
    const user = db.select().from(schema.users).where(and(eq(schema.users.username, username.trim()), eq(schema.users.status, 'active'))).get()
    if (!user) throw new TopicError(404, 'Active user not found')
    if (user.id === topic.owner_id) throw new TopicError(422, 'The owner membership cannot be changed')
    db.transaction((tx) => {
      tx.insert(schema.topicMembers).values({ topic_id: topicId, user_id: user.id, role: role ?? 'viewer', active: role ? 1 : 0 })
        .onConflictDoUpdate({ target: [schema.topicMembers.topic_id, schema.topicMembers.user_id], set: { role: role ?? 'viewer', active: role ? 1 : 0 } }).run()
      if (role === null && topic.default_access === 'none') tx.update(schema.apiTokens).set({ revoked_at: new Date().toISOString() })
        .where(and(eq(schema.apiTokens.topic_id, topicId), eq(schema.apiTokens.user_id, user.id), eq(schema.apiTokens.kind, 'topic'))).run()
    })
    return topicMembers(topicId, ownerId)
  })
}

function credentialInfo(row: typeof schema.apiTokens.$inferSelect): TopicCredential {
  return { id: row.id, created_at: row.created_at, rotated_at: row.rotated_at, revoked_at: row.revoked_at }
}

export function listTopicCredentials(topicId: number, userId: number): TopicCredential[] {
  requireTopicAccess(topicId, userId)
  return getDatabase().select().from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.topic_id, topicId), eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'topic')))
    .orderBy(desc(schema.apiTokens.id)).all().map(credentialInfo)
}

export async function issueTopicCredential(topicId: number, userId: number, rotateId?: number) {
  return withTopicLock(topicId, () => {
    requireTopicAccess(topicId, userId)
    const db = getDatabase()
    const secret = `plt_${randomBytes(32).toString('hex')}`
    const now = new Date().toISOString()
    let row: typeof schema.apiTokens.$inferSelect | undefined
    if (rotateId !== undefined) {
      row = db.update(schema.apiTokens).set({ token: topicTokenVerifier(secret), rotated_at: now, revoked_at: null })
        .where(and(eq(schema.apiTokens.id, rotateId), eq(schema.apiTokens.topic_id, topicId), eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'topic'))).returning().get()
      if (!row) throw new TopicError(404, 'Topic credential not found')
    } else {
      row = db.insert(schema.apiTokens).values({ token: topicTokenVerifier(secret), kind: 'topic', topic_id: topicId, user_id: userId, created_at: now }).returning().get()
    }
    return { ...credentialInfo(row), token: secret }
  })
}

export async function revokeTopicCredential(topicId: number, userId: number, tokenId: number) {
  return withTopicLock(topicId, () => {
    requireTopicAccess(topicId, userId)
    const row = getDatabase().update(schema.apiTokens).set({ revoked_at: new Date().toISOString() })
      .where(and(eq(schema.apiTokens.id, tokenId), eq(schema.apiTokens.topic_id, topicId), eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'topic'))).returning().get()
    if (!row) throw new TopicError(404, 'Topic credential not found')
    return credentialInfo(row)
  })
}

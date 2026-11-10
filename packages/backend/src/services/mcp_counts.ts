import { and, eq, sql } from 'drizzle-orm'
import type { McpCallCounts } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { TopicError } from './topic_format.js'
import { requireTopicAccess } from './topic_access.js'

let knownCounterTools: string[] = []
export function registerMcpCounterTools(names: string[]): void { knownCounterTools = [...names] }
export function completeCallCounts(raw: string | null | undefined, knownTools = knownCounterTools): McpCallCounts {
  const values = parseCallCounts(raw)
  return Object.fromEntries([...new Set([...knownTools, ...Object.keys(values)])].map((name) => [name, values[name] ?? 0]))
}

export function parseCallCounts(raw: string | null | undefined): McpCallCounts {
  try {
    const value = JSON.parse(raw || '{}')
    return Object.fromEntries(Object.entries(value).filter(([name, n]) => /^[a-z][a-z0-9_]*$/.test(name) && Number.isSafeInteger(n) && (n as number) >= 0)) as McpCallCounts
  } catch { return {} }
}

/** Call only after matching a known tool; no credential identity is retained in aggregates. */
export function recordMcpCall(userId: number, tool: string, topicId?: number): void {
  if (!/^[a-z][a-z0-9_]*$/.test(tool)) throw new Error('Invalid tool counter name')
  const path = `$.${tool}`
  getDatabase().transaction((tx) => {
    const user = tx.update(schema.users).set({ mcp_call_counts: sql`json_set(${schema.users.mcp_call_counts}, ${path}, coalesce(json_extract(${schema.users.mcp_call_counts}, ${path}), 0) + 1)` })
      .where(and(eq(schema.users.id, userId), eq(schema.users.status, 'active'))).returning({ id: schema.users.id }).get()
    if (!user) throw new TopicError(401, 'Active user required')
    if (topicId != null) {
      requireTopicAccess(topicId, userId)
      // A default-policy reader needs durable counters, without becoming an explicit grant.
      tx.insert(schema.topicMembers).values({ topic_id: topicId, user_id: userId, role: 'default' }).onConflictDoNothing().run()
      const member = tx.update(schema.topicMembers).set({ mcp_call_counts: sql`json_set(${schema.topicMembers.mcp_call_counts}, ${path}, coalesce(json_extract(${schema.topicMembers.mcp_call_counts}, ${path}), 0) + 1)` })
        .where(and(eq(schema.topicMembers.user_id, userId), eq(schema.topicMembers.topic_id, topicId))).returning({ id: schema.topicMembers.user_id }).get()
      if (!member) throw new TopicError(401, 'Active Topic membership required')
    }
  })
}

export function mcpCountsForUser(userId: number, knownTools: string[]): McpCallCounts {
  const row = getDatabase().select({ counts: schema.users.mcp_call_counts }).from(schema.users).where(eq(schema.users.id, userId)).get()
  return completeCallCounts(row?.counts, knownTools)
}

export function mcpCountsForTopic(topicId: number, userId: number, knownTools: string[]): McpCallCounts {
  return completeCallCounts(requireTopicAccess(topicId, userId).member.mcp_call_counts, knownTools)
}

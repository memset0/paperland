import { randomBytes } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { resolveServiceKey, type McpServicePermissions } from './mcp_services.js'

/**
 * Credentials (`api_tokens`). Two kinds remain:
 * - `service`: Plugins services, one per external app (see mcp_services.ts).
 * - `agent`: exactly one per user (partial unique index), created automatically and injected into
 *   the Codex agents Paperland runs on the user's behalf. Only `/mcp` accepts it; no API ever
 *   returns its value, and it can only be reset in place (the old value stops working at once).
 */

export type TokenKind = 'agent' | 'service'
export type TokenRow = typeof schema.apiTokens.$inferSelect
type UserRow = typeof schema.users.$inferSelect

export function newTokenValue(): string {
  return `sk-${randomBytes(32).toString('hex')}`
}

export function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

/** The user's agent token row, creating it if missing. Idempotent and safe under concurrency. */
export function ensureAgentToken(userId: number): TokenRow {
  const db = getDatabase()
  db.insert(schema.apiTokens)
    .values({ token: newTokenValue(), user_id: userId, kind: 'agent', created_at: new Date().toISOString() })
    .onConflictDoNothing()
    .run()
  return db.select().from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'agent')))
    .get()!
}

/** Replace the agent token's value in place (same row); the previous value stops working. */
export function resetAgentToken(userId: number): TokenRow {
  const row = ensureAgentToken(userId)
  return getDatabase().update(schema.apiTokens)
    .set({ token: newTokenValue(), rotated_at: new Date().toISOString(), revoked_at: null })
    .where(eq(schema.apiTokens.id, row.id))
    .returning()
    .get()!
}

export type TokenCheck =
  | { ok: true; token: TokenRow; user: UserRow; permissions?: McpServicePermissions }
  | { ok: false; message: string }

/**
 * Resolve a bearer value to its active owner. `kinds` lists what the caller accepts: `service`
 * (Plugins service keys — MCP, External API, Topic Git) and/or `agent` (Paperland's own Codex runs,
 * `/mcp` only). Service results carry the service's permissions.
 */
export function checkBearerToken(raw: string | null | undefined, kinds: TokenKind[]): TokenCheck {
  if (!raw) return { ok: false, message: 'Bearer token required' }
  const service = resolveServiceKey(raw)
  if (service) {
    if (!kinds.includes('service')) return { ok: false, message: 'Token kind not accepted here' }
    return { ok: true, token: service.token, user: service.user, permissions: service.permissions }
  }
  const db = getDatabase()
  const token = db.select().from(schema.apiTokens).where(and(eq(schema.apiTokens.token, raw), eq(schema.apiTokens.kind, 'agent'))).get()
  if (!token) return { ok: false, message: 'Invalid token' }
  if (token.revoked_at !== null) return { ok: false, message: 'Token has been revoked' }
  if (!kinds.includes('agent')) return { ok: false, message: 'Agent tokens are only accepted by /mcp' }
  const user = token.user_id != null ? db.select().from(schema.users).where(eq(schema.users.id, token.user_id)).get() : undefined
  if (!user) return { ok: false, message: 'Token has no owner' }
  if (user.status !== 'active') return { ok: false, message: 'Account is not active' }
  return { ok: true, token, user }
}

/** `Authorization: Bearer <token>` value, or null. */
export function bearerFromHeader(header: unknown): string | null {
  const match = typeof header === 'string' ? header.match(/^Bearer\s+(\S+)$/i) : null
  return match ? match[1] : null
}

import { randomBytes } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

/**
 * Bearer tokens (`api_tokens`). Two kinds share the table:
 * - `personal`: managed by the user (or an admin), usable for the External API and `/mcp`; the
 *   full value is returned once, at creation.
 * - `agent`: exactly one per user (partial unique index), created automatically and injected into
 *   the Codex agents Paperland runs on the user's behalf. Only `/mcp` accepts it; no API ever
 *   returns its value, and it can only be reset in place (the old value stops working at once).
 */

export type TokenKind = 'personal' | 'agent'
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

export function createPersonalToken(userId: number): TokenRow {
  return getDatabase().insert(schema.apiTokens)
    .values({ token: newTokenValue(), user_id: userId, kind: 'personal', created_at: new Date().toISOString() })
    .returning()
    .get()
}

/** Revoke one of the user's own personal tokens. Returns false when it is not theirs / not personal. */
export function revokeOwnPersonalToken(userId: number, tokenId: number): boolean {
  const revoked = getDatabase().update(schema.apiTokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(and(
      eq(schema.apiTokens.id, tokenId),
      eq(schema.apiTokens.user_id, userId),
      eq(schema.apiTokens.kind, 'personal'),
      isNull(schema.apiTokens.revoked_at),
    ))
    .returning()
    .get()
  return !!revoked
}

export type TokenCheck =
  | { ok: true; token: TokenRow; user: UserRow }
  | { ok: false; message: string }

/**
 * Resolve a bearer token to its active owner. `kinds` lists the token kinds the caller accepts
 * (the External API takes only personal tokens; `/mcp` takes both).
 */
export function checkBearerToken(raw: string | null | undefined, kinds: TokenKind[]): TokenCheck {
  if (!raw) return { ok: false, message: 'Bearer token required' }
  const db = getDatabase()
  const token = db.select().from(schema.apiTokens).where(eq(schema.apiTokens.token, raw)).get()
  if (!token) return { ok: false, message: 'Invalid token' }
  if (token.revoked_at !== null) return { ok: false, message: 'Token has been revoked' }
  if (!kinds.includes(token.kind as TokenKind)) {
    return { ok: false, message: token.kind === 'agent' ? 'Agent tokens are only accepted by /mcp' : 'Token kind not accepted here' }
  }
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

import type { FastifyRequest } from 'fastify'
import { randomBytes } from 'crypto'
import { eq, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import type { SessionUser, UserRole } from '@paperland/shared'

export const SESSION_COOKIE = 'paperland_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Make `request.user` available throughout the app (set by the onRequest hook).
declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser | null
  }
}

function toSessionUser(row: { id: number; username: string; role: string }): SessionUser {
  return { id: row.id, username: row.username, role: row.role as UserRole }
}

/** Create a session for a user and return the opaque token (to be set as a cookie). */
export function createSession(userId: number): string {
  const db = getDatabase()
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  db.insert(schema.sessions).values({
    id: token,
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
  }).run()
  return token
}

/** Delete a session by its token. */
export function destroySession(token: string): void {
  const db = getDatabase()
  db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run()
}

/** Resolve the current user from the session cookie, or null if unauthenticated/expired. */
export function resolveSessionUser(request: FastifyRequest): SessionUser | null {
  const token = request.cookies?.[SESSION_COOKIE]
  if (!token) return null
  const db = getDatabase()
  const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, token)).get()
  if (!session) return null
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run() // stale cleanup
    return null
  }
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.user_id)).get()
  return user ? toSessionUser(user) : null
}

// Dev-bypass identity: the lowest-id admin (memoized). Using a real user keeps
// ownership FKs valid when `auth.enabled` is false.
let _devAdmin: SessionUser | null = null
export function getDevAdmin(): SessionUser | null {
  if (_devAdmin) return _devAdmin
  const db = getDatabase()
  const user = db.select().from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .orderBy(asc(schema.users.id))
    .get()
  _devAdmin = user ? toSessionUser(user) : null
  return _devAdmin
}

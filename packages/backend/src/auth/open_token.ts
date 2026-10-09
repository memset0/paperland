import { randomBytes, timingSafeEqual } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

// Per-user CSRF token for the arxiv quick-open link (`/open/arxiv/:id?token=…`).
// On its own it grants nothing — the request must also carry a valid session — so it
// only stops third-party pages from making a logged-in user create papers via a link.

function newToken(): string {
  return randomBytes(32).toString('hex')
}

/** Return the user's quick-open token, generating and persisting one on first use. */
export function getOrCreateOpenToken(userId: number): string {
  const db = getDatabase()
  const row = db.select({ open_token: schema.users.open_token }).from(schema.users).where(eq(schema.users.id, userId)).get()
  if (row?.open_token) return row.open_token
  return regenerateOpenToken(userId)
}

/** Replace the user's quick-open token; the previous one stops working immediately. */
export function regenerateOpenToken(userId: number): string {
  const token = newToken()
  getDatabase().update(schema.users).set({ open_token: token }).where(eq(schema.users.id, userId)).run()
  return token
}

/** Timing-safe check of a supplied token against the user's stored token. */
export function verifyOpenToken(userId: number, supplied: string | null | undefined): boolean {
  if (!supplied) return false
  const row = getDatabase().select({ open_token: schema.users.open_token }).from(schema.users).where(eq(schema.users.id, userId)).get()
  if (!row?.open_token) return false
  const a = Buffer.from(row.open_token)
  const b = Buffer.from(supplied)
  return a.length === b.length && timingSafeEqual(a, b)
}

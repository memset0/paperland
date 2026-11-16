import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

/**
 * Per-application MCP services: `api_tokens` rows of kind `service`, each with a display name and
 * permissions. The secret lives only in the service URL `/mcp/s/<secret>` (for clients such as
 * ChatGPT that cannot send an Authorization header); the table keeps a SHA-256 verifier.
 */

export interface McpServicePermissions { write: boolean; delete_papers: boolean; delete_answers: boolean }
export const DEFAULT_SERVICE_PERMISSIONS: McpServicePermissions = { write: true, delete_papers: false, delete_answers: false }
export type ServicePermission = 'read' | keyof McpServicePermissions

export class McpServiceError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export interface McpServiceInfo {
  id: number
  name: string
  permissions: McpServicePermissions
  created_at: string
  rotated_at: string | null
  revoked_at: string | null
}

export function serviceVerifier(secret: string): string {
  return `service_sha256:${createHash('sha256').update(secret).digest('hex')}`
}
const newSecret = () => `pls_${randomBytes(32).toString('hex')}`

export function parsePermissions(raw: string | null | undefined): McpServicePermissions {
  let value: Record<string, unknown> = {}
  try { value = JSON.parse(raw || '{}') } catch {}
  return {
    write: value.write === undefined ? DEFAULT_SERVICE_PERMISSIONS.write : value.write === true,
    delete_papers: value.delete_papers === true,
    delete_answers: value.delete_answers === true,
  }
}

function cleanName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) throw new McpServiceError(422, 'Name must be 1-60 characters')
  return name.trim()
}

function cleanPermissions(input: unknown, base: McpServicePermissions): McpServicePermissions {
  if (input === undefined) return base
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new McpServiceError(422, 'permissions must be an object')
  const out = { ...base }
  for (const [key, value] of Object.entries(input)) {
    if (!(key in out)) throw new McpServiceError(422, `Unknown permission: ${key}`)
    if (typeof value !== 'boolean') throw new McpServiceError(422, `${key} must be a boolean`)
    out[key as keyof McpServicePermissions] = value
  }
  return out
}

type Row = typeof schema.apiTokens.$inferSelect
function info(row: Row): McpServiceInfo {
  return { id: row.id, name: row.name ?? '', permissions: parsePermissions(row.permissions), created_at: row.created_at, rotated_at: row.rotated_at, revoked_at: row.revoked_at }
}

function ownRow(userId: number, id: number): Row {
  const row = getDatabase().select().from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.id, id), eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'service'), isNull(schema.apiTokens.revoked_at))).get()
  if (!row) throw new McpServiceError(404, 'Service not found')
  return row
}

export function listMcpServices(userId: number): McpServiceInfo[] {
  return getDatabase().select().from(schema.apiTokens)
    .where(and(eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'service'), isNull(schema.apiTokens.revoked_at)))
    .orderBy(desc(schema.apiTokens.id)).all().map(info)
}

/** Creates a service; the secret is returned only here. */
export function createMcpService(userId: number, input: { name?: unknown; permissions?: unknown }): McpServiceInfo & { secret: string } {
  const name = cleanName(input.name)
  const permissions = cleanPermissions(input.permissions, DEFAULT_SERVICE_PERMISSIONS)
  const secret = newSecret()
  const row = getDatabase().insert(schema.apiTokens).values({
    token: serviceVerifier(secret), kind: 'service', user_id: userId, name, permissions: JSON.stringify(permissions), created_at: new Date().toISOString(),
  }).returning().get()
  return { ...info(row), secret }
}

export function updateMcpService(userId: number, id: number, input: { name?: unknown; permissions?: unknown }): McpServiceInfo {
  const row = ownRow(userId, id)
  const name = input.name === undefined ? row.name : cleanName(input.name)
  const permissions = cleanPermissions(input.permissions, parsePermissions(row.permissions))
  return info(getDatabase().update(schema.apiTokens).set({ name, permissions: JSON.stringify(permissions) }).where(eq(schema.apiTokens.id, row.id)).returning().get())
}

/** Replaces the secret in place; the old URL stops working at once. */
export function rotateMcpService(userId: number, id: number): McpServiceInfo & { secret: string } {
  const row = ownRow(userId, id)
  const secret = newSecret()
  const updated = getDatabase().update(schema.apiTokens).set({ token: serviceVerifier(secret), rotated_at: new Date().toISOString() }).where(eq(schema.apiTokens.id, row.id)).returning().get()
  return { ...info(updated), secret }
}

export function revokeMcpService(userId: number, id: number): void {
  const row = ownRow(userId, id)
  getDatabase().update(schema.apiTokens).set({ revoked_at: new Date().toISOString() }).where(eq(schema.apiTokens.id, row.id)).run()
}

/** Resolve a service URL secret to its active owner, or null (never says why). */
export function checkServiceSecret(secret: string): { token: Row; user: typeof schema.users.$inferSelect; permissions: McpServicePermissions } | null {
  if (!/^pls_[0-9a-f]{64}$/.test(secret)) return null
  const db = getDatabase()
  const token = db.select().from(schema.apiTokens).where(and(eq(schema.apiTokens.token, serviceVerifier(secret)), eq(schema.apiTokens.kind, 'service'))).get()
  if (!token || token.revoked_at !== null || token.user_id == null) return null
  const user = db.select().from(schema.users).where(eq(schema.users.id, token.user_id)).get()
  if (!user || user.status !== 'active') return null
  return { token, user, permissions: parsePermissions(token.permissions) }
}

/** `/mcp/s/<secret>` with the secret replaced, for logs. */
export function redactServiceUrl(url: string): string {
  return url.replace(/\/mcp\/s\/[^/?#]+/, '/mcp/s/[redacted]')
}

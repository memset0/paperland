import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { toSessionUser } from './session_auth.js'

export async function tokenAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } })
    return
  }

  const token = authHeader.slice(7)
  const db = getDatabase()

  const found = db.select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.token, token))
    .get()

  if (!found) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } })
    return
  }

  if (found.revoked_at !== null) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token has been revoked' } })
    return
  }

  // Agent tokens (one per user, injected into Codex runs) only work with /mcp.
  if (found.kind === 'agent') {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Agent tokens are only accepted by /mcp' } })
    return
  }

  // Attribute the request to the token's owning user so per-user data (e.g. tags)
  // created via the External API is owned by that user (Zotero sync continues to work;
  // pre-existing tokens are migrated to the admin user).
  // A token whose owner is not active (e.g. a pending registration) is rejected; owner-less legacy
  // tokens keep working.
  if (found.user_id != null) {
    const user = db.select().from(schema.users).where(eq(schema.users.id, found.user_id)).get()
    if (user && user.status !== 'active') {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Account is not active' } })
      return
    }
    if (user) request.user = toSessionUser(user)
  }
}

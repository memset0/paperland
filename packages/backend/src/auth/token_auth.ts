import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import type { UserRole } from '@paperland/shared'

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

  // Attribute the request to the token's owning user so per-user data (e.g. tags)
  // created via the External API is owned by that user (Zotero sync continues to work;
  // pre-existing tokens are migrated to the admin user).
  if (found.user_id != null) {
    const user = db.select().from(schema.users).where(eq(schema.users.id, found.user_id)).get()
    if (user) request.user = { id: user.id, username: user.username, role: user.role as UserRole }
  }
}

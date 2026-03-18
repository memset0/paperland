import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

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
}

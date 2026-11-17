import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireAdmin } from '../auth/guards.js'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Credential oversight is admin-only (users manage their own services on the Plugins page).
  app.addHook('preHandler', requireAdmin)

  // List credentials: agent tokens and Plugins services, with owner, never a value (not even masked).
  app.get('/api/settings/tokens', async () => {
    const tokens = getDatabase().select().from(schema.apiTokens).all().filter((token) => token.kind === 'agent' || token.kind === 'service')
    return {
      data: tokens.map((t) => ({
        id: t.id,
        kind: t.kind,
        name: t.kind === 'service' ? t.name : null,
        token: null,
        user_id: t.user_id,
        created_at: t.created_at,
        rotated_at: t.rotated_at,
        revoked_at: t.revoked_at,
      })),
    }
  })

  // Revoke token
  app.delete<{ Params: { id: string } }>('/api/settings/tokens/:id', async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)
    const now = new Date().toISOString()

    const existing = db.select().from(schema.apiTokens).where(eq(schema.apiTokens.id, id)).get()
    if (!existing || (existing.kind !== 'service' && existing.kind !== 'agent')) {
      reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Token not found' } })
      return
    }
    if (existing.kind === 'agent') {
      reply.code(400).send({ error: { code: 'AGENT_TOKEN', message: 'Agent tokens cannot be revoked; the owner can reset it' } })
      return
    }

    db.update(schema.apiTokens)
      .set({ revoked_at: now })
      .where(eq(schema.apiTokens.id, id))
      .run()

    return { success: true }
  })
}

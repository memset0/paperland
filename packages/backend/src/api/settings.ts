import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireAdmin } from '../auth/guards.js'
import { createPersonalToken, maskToken } from '../services/api_tokens.js'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Token management is admin-only.
  app.addHook('preHandler', requireAdmin)

  // List tokens (with owning user and kind). Agent tokens never expose their value, not even masked.
  app.get('/api/settings/tokens', async () => {
    const db = getDatabase()
    const tokens = db.select().from(schema.apiTokens).all()

    return {
      data: tokens.map((t) => ({
        id: t.id,
        kind: t.kind,
        token: t.kind === 'agent' ? null : maskToken(t.token),
        user_id: t.user_id,
        created_at: t.created_at,
        rotated_at: t.rotated_at,
        revoked_at: t.revoked_at,
      })),
    }
  })

  // Issue new token (owned by the issuing admin so External-API data is attributed to them)
  app.post('/api/settings/tokens', async (request) => {
    const result = createPersonalToken(request.user!.id)

    return {
      id: result.id,
      token: result.token, // Full token shown only on creation
      user_id: result.user_id,
      created_at: result.created_at,
    }
  })

  // Revoke token
  app.delete<{ Params: { id: string } }>('/api/settings/tokens/:id', async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)
    const now = new Date().toISOString()

    const existing = db.select().from(schema.apiTokens).where(eq(schema.apiTokens.id, id)).get()
    if (!existing) {
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

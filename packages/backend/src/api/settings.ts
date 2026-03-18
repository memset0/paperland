import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // List tokens
  app.get('/api/settings/tokens', async (_request, _reply) => {
    const db = getDatabase()
    const tokens = db.select().from(schema.apiTokens).all()

    return {
      data: tokens.map((t) => ({
        id: t.id,
        token: maskToken(t.token),
        created_at: t.created_at,
        revoked_at: t.revoked_at,
      })),
    }
  })

  // Issue new token
  app.post('/api/settings/tokens', async (_request, _reply) => {
    const db = getDatabase()
    const token = `sk-${randomBytes(32).toString('hex')}`
    const now = new Date().toISOString()

    const result = db.insert(schema.apiTokens).values({
      token,
      created_at: now,
    }).returning().get()

    return {
      id: result.id,
      token: result.token, // Full token shown only on creation
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

    db.update(schema.apiTokens)
      .set({ revoked_at: now })
      .where(eq(schema.apiTokens.id, id))
      .run()

    return { success: true }
  })
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

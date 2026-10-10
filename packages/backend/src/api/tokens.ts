import type { FastifyInstance } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'
import { createPersonalToken, ensureAgentToken, maskToken, resetAgentToken, revokeOwnPersonalToken } from '../services/api_tokens.js'

// The signed-in user's own API tokens: personal tokens (External API + /mcp; full value returned
// only at creation) and their single Codex agent token (/mcp only; never returned, only reset).
// Every route acts on `request.user` only — there is no way to address another user's tokens here.

function agentInfo(row: { created_at: string; rotated_at: string | null }) {
  return { created_at: row.created_at, rotated_at: row.rotated_at }
}

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/auth/me/tokens — own personal tokens (masked) + agent token metadata (no value)
  app.get('/api/auth/me/tokens', { preHandler: requireUser }, async (request) => {
    const userId = request.user!.id
    const personal = getDatabase().select().from(schema.apiTokens)
      .where(and(eq(schema.apiTokens.user_id, userId), eq(schema.apiTokens.kind, 'personal')))
      .orderBy(desc(schema.apiTokens.id))
      .all()
    return {
      data: {
        personal: personal.map((t) => ({ id: t.id, token: maskToken(t.token), created_at: t.created_at, revoked_at: t.revoked_at })),
        agent: agentInfo(ensureAgentToken(userId)),
      },
    }
  })

  // POST /api/auth/me/tokens — new personal token; the full value is returned only here
  app.post('/api/auth/me/tokens', { preHandler: requireUser }, async (request, reply) => {
    const row = createPersonalToken(request.user!.id)
    return reply.code(201).send({ data: { id: row.id, token: row.token, created_at: row.created_at } })
  })

  // DELETE /api/auth/me/tokens/:id — revoke one of the user's own personal tokens
  app.delete<{ Params: { id: string } }>('/api/auth/me/tokens/:id', { preHandler: requireUser }, async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isInteger(id) || !revokeOwnPersonalToken(request.user!.id, id)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Token not found' } })
    }
    return { success: true }
  })

  // POST /api/auth/me/agent-token/reset — replace the agent token's value in place (not returned)
  app.post('/api/auth/me/agent-token/reset', { preHandler: requireUser }, async (request) => {
    return { data: agentInfo(resetAgentToken(request.user!.id)) }
  })
}

import type { FastifyInstance } from 'fastify'
import { requireUser } from '../auth/guards.js'
import { ensureAgentToken, resetAgentToken } from '../services/api_tokens.js'

// The signed-in user's Codex agent token (/mcp only; its value is never returned, only reset).
// External apps use Plugins services (api/mcp_services.ts) instead.

function agentInfo(row: { created_at: string; rotated_at: string | null }) {
  return { created_at: row.created_at, rotated_at: row.rotated_at }
}

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/auth/me/agent-token — agent token metadata (no value)
  app.get('/api/auth/me/agent-token', { preHandler: requireUser }, async (request) => {
    return { data: agentInfo(ensureAgentToken(request.user!.id)) }
  })

  // POST /api/auth/me/agent-token/reset — replace the agent token's value in place (not returned)
  app.post('/api/auth/me/agent-token/reset', { preHandler: requireUser }, async (request) => {
    return { data: agentInfo(resetAgentToken(request.user!.id)) }
  })
}

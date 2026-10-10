import type { FastifyInstance } from 'fastify'
import { requireAdmin, requireUser } from '../auth/guards.js'
import { usageLeaderboard, userUsage } from '../services/model_usage.js'

// Model token usage and estimated cost from the `model_usage` ledger. `days` limits the window to
// the last N days; without it the totals cover all time.

function parseDays(raw: unknown): number | undefined {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { days?: string } }>('/api/usage/me', { preHandler: requireUser }, async (request) => {
    return { data: userUsage(request.user!.id, parseDays(request.query.days)) }
  })

  app.get<{ Querystring: { days?: string } }>('/api/usage/leaderboard', { preHandler: requireAdmin }, async (request) => {
    return { data: usageLeaderboard(parseDays(request.query.days)) }
  })
}

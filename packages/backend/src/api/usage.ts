import type { FastifyInstance } from 'fastify'
import { requireAdmin, requireUser } from '../auth/guards.js'
import { parseUtcDay, recalculateCosts, usageLeaderboard, userUsage } from '../services/model_usage.js'

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

  // Admin: recompute estimated costs from stored tokens and the current config pricing, for rows
  // created in an optional inclusive UTC day range (`from` / `to` as YYYY-MM-DD).
  app.post<{ Body: { from?: string | null; to?: string | null } }>('/api/usage/recalculate', { preHandler: requireAdmin }, async (request, reply) => {
    const from = request.body?.from || undefined
    const to = request.body?.to || undefined
    for (const [key, day] of [['from', from], ['to', to]] as const) {
      if (day !== undefined && (typeof day !== 'string' || !parseUtcDay(day))) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: `"${key}" must be a date YYYY-MM-DD` } })
      }
    }
    if (from && to && from > to) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: '"from" must not be after "to"' } })
    }
    return { data: recalculateCosts({ from, to }) }
  })
}

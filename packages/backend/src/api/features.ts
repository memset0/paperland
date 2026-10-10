import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import type { FeatureListResponse } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'
import { FEATURES, FEATURE_KEYS } from '../features.js'

// Feature announcements: the registry (src/features.ts) with the caller's seen flags, and marking
// features seen. Images are static files of the frontend (`/features/<key>.svg`).

export async function featuresRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/features', { preHandler: requireUser }, async (request): Promise<{ data: FeatureListResponse }> => {
    const db = getDatabase()
    const seen = new Set(db.select({ key: schema.featureViews.feature_key })
      .from(schema.featureViews)
      .where(eq(schema.featureViews.user_id, request.user!.id))
      .all()
      .map((r) => r.key))
    // Newest first; Array.prototype.sort is stable, so same-day entries keep registry order.
    const features = [...FEATURES]
      .sort((a, b) => b.released_at.localeCompare(a.released_at))
      .map((f) => ({ ...f, image_url: `/features/${f.key}.svg`, seen: seen.has(f.key) }))
    return { data: { features } }
  })

  app.post<{ Body: { keys?: unknown } }>('/api/features/seen', { preHandler: requireUser }, async (request, reply) => {
    const keys = request.body?.keys
    if (!Array.isArray(keys) || keys.length === 0 || !keys.every((k) => typeof k === 'string')) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'keys must be a non-empty array of strings' } })
    }
    const unknown = keys.filter((k) => !FEATURE_KEYS.has(k))
    if (unknown.length) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: `Unknown feature keys: ${unknown.join(', ')}` } })
    }
    const seenAt = new Date().toISOString()
    getDatabase().insert(schema.featureViews)
      .values([...new Set(keys as string[])].map((feature_key) => ({ user_id: request.user!.id, feature_key, seen_at: seenAt })))
      .onConflictDoNothing()
      .run()
    return { success: true }
  })
}

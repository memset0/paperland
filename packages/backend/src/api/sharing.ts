import type { FastifyInstance } from 'fastify'
import type { SharingPreferences } from '@paperland/shared'
import { getSharingPrefs, setSharingPrefs, SHARING_DATA_TYPES } from '../auth/visibility.js'

// Per-user sharing switches for optionally-shared data (see auth/visibility.ts).
// Auth is guarded inline: under this Fastify version a 401-sending preHandler does not
// reliably halt a GET handler.
export async function sharingRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/auth/me/sharing — the caller's effective switches
  app.get('/api/auth/me/sharing', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
    return { data: getSharingPrefs(request.user.id) }
  })

  // PUT /api/auth/me/sharing — update any subset of { highlights, notes, qa, reference_links, research }
  app.put<{ Body: Record<string, unknown> }>('/api/auth/me/sharing', async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Expected an object of boolean switches' } })
    }
    const patch: Partial<SharingPreferences> = {}
    for (const [key, value] of Object.entries(body)) {
      if (!(SHARING_DATA_TYPES as string[]).includes(key) || typeof value !== 'boolean') {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: `Invalid sharing switch: ${key}` } })
      }
      patch[key as keyof SharingPreferences] = value
    }
    return { data: setSharingPrefs(request.user.id, patch) }
  })
}

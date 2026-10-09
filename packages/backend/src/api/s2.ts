import type { FastifyInstance } from 'fastify'
import { getConfig } from '../config.js'
import { resolveS2Ids } from '../services/s2_paper_cache.js'

export async function s2Routes(app: FastifyInstance): Promise<void> {
  // POST /api/s2/papers/resolve — S2 ids → cached metadata, in request order. Public: anonymous
  // callers read the library/cache only; logged-in callers also fetch what is missing from S2.
  app.post<{ Body: { ids?: unknown } }>('/api/s2/papers/resolve', async (request, reply) => {
    const ids = request.body?.ids
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return reply.status(400).send({ error: 'ids must be an array of strings' })
    }
    const max = getConfig().s2_cache.max_ids_per_request
    if (ids.length > max) {
      return reply.status(400).send({ error: `At most ${max} ids per request` })
    }
    const results = await resolveS2Ids(ids as string[], { allowFetch: !!request.user })
    return { results }
  })
}

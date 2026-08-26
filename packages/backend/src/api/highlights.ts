import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { touchPaperUpdatedAt, parsePaperIdFromPathname } from '../db/utils.js'
import { requireUser } from '../auth/guards.js'
import { markdownContentHash } from '../services/content_hash.js'

export async function highlightsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/highlights?pathname=/papers/42
  app.get<{ Querystring: { pathname?: string } }>('/api/highlights', async (request, reply) => {
    const { pathname } = request.query
    if (!pathname) {
      return reply.code(400).send({ error: { message: 'pathname query parameter is required' } })
    }
    // Owner-scoped: anonymous users get an empty set (HTTP 200, not 401).
    const userId = request.user?.id
    if (userId == null) return { data: [] }

    const db = getDatabase()
    const rows = db.select().from(schema.highlights)
      .where(and(eq(schema.highlights.pathname, pathname), eq(schema.highlights.user_id, userId)))
      .all()

    return { data: rows }
  })

  // POST /api/highlights
  app.post<{ Body: {
    pathname: string
    content_hash: string
    start_offset: number
    end_offset: number
    text: string
    color: string
    qa_result_id?: number | null
  } }>('/api/highlights', { preHandler: requireUser }, async (request, reply) => {
    const { pathname, content_hash, start_offset, end_offset, text, color, qa_result_id } = request.body || {} as any
    if (!pathname || !content_hash || start_offset == null || end_offset == null || !text || !color) {
      return reply.code(400).send({ error: { message: 'Missing required fields' } })
    }

    const validColors = ['yellow', 'green', 'blue', 'pink']
    if (!validColors.includes(color)) {
      return reply.code(400).send({ error: { message: `Invalid color. Must be one of: ${validColors.join(', ')}` } })
    }

    const db = getDatabase()
    if (qa_result_id != null) {
      const result = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, qa_result_id)).get()
      const entry = result
        ? db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get()
        : null
      const paperId = parsePaperIdFromPathname(pathname)
      const resultHash = result?.content_hash || (result ? markdownContentHash(result.answer) : null)
      if (!result || !entry || paperId == null || entry.paper_id !== paperId || resultHash !== content_hash) {
        return reply.code(400).send({ error: { message: 'Invalid QA result attribution' } })
      }
    }
    const result = db.insert(schema.highlights).values({
      user_id: request.user!.id,
      pathname,
      content_hash,
      qa_result_id: qa_result_id ?? null,
      start_offset,
      end_offset,
      text,
      color,
      created_at: new Date().toISOString(),
    }).returning().get()

    const paperId = parsePaperIdFromPathname(pathname)
    if (paperId) touchPaperUpdatedAt(db, paperId)

    return reply.code(201).send({ data: result })
  })

  // PUT /api/highlights/:id
  app.put<{ Params: { id: string }; Body: { color?: string } }>(
    '/api/highlights/:id', { preHandler: requireUser }, async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      const { color } = request.body || {} as any

      const db = getDatabase()
      const existing = db.select().from(schema.highlights)
        .where(eq(schema.highlights.id, id))
        .get()

      // Treat another user's highlight as not found.
      if (!existing || existing.user_id !== request.user!.id) {
        return reply.code(404).send({ error: { message: 'Highlight not found' } })
      }

      const updates: Record<string, unknown> = {}
      if (color !== undefined) {
        const validColors = ['yellow', 'green', 'blue', 'pink']
        if (!validColors.includes(color)) {
          return reply.code(400).send({ error: { message: `Invalid color` } })
        }
        updates.color = color
      }

      if (Object.keys(updates).length === 0) {
        return { data: existing }
      }

      db.update(schema.highlights).set(updates).where(eq(schema.highlights.id, id)).run()

      const paperId = parsePaperIdFromPathname(existing.pathname)
      if (paperId) touchPaperUpdatedAt(db, paperId)

      const updated = db.select().from(schema.highlights)
        .where(eq(schema.highlights.id, id))
        .get()
      return { data: updated }
    }
  )

  // DELETE /api/highlights/:id
  app.delete<{ Params: { id: string } }>('/api/highlights/:id', { preHandler: requireUser }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)

    const db = getDatabase()
    const existing = db.select().from(schema.highlights)
      .where(eq(schema.highlights.id, id))
      .get()

    // Treat another user's highlight as not found.
    if (!existing || existing.user_id !== request.user!.id) {
      return reply.code(404).send({ error: { message: 'Highlight not found' } })
    }

    const paperId = parsePaperIdFromPathname(existing.pathname)
    db.delete(schema.highlights).where(eq(schema.highlights.id, id)).run()
    if (paperId) touchPaperUpdatedAt(db, paperId)
    return { success: true }
  })
}

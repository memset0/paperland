import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { touchPaperUpdatedAt, parsePaperIdFromPathname } from '../db/utils.js'

export async function highlightsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/highlights?pathname=/papers/42
  app.get<{ Querystring: { pathname?: string } }>('/api/highlights', async (request, reply) => {
    const { pathname } = request.query
    if (!pathname) {
      return reply.code(400).send({ error: { message: 'pathname query parameter is required' } })
    }

    const db = getDatabase()
    const rows = db.select().from(schema.highlights)
      .where(eq(schema.highlights.pathname, pathname))
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
    note?: string | null
  } }>('/api/highlights', async (request, reply) => {
    const { pathname, content_hash, start_offset, end_offset, text, color, note } = request.body || {} as any
    if (!pathname || !content_hash || start_offset == null || end_offset == null || !text || !color) {
      return reply.code(400).send({ error: { message: 'Missing required fields' } })
    }

    const validColors = ['yellow', 'green', 'blue', 'pink']
    if (!validColors.includes(color)) {
      return reply.code(400).send({ error: { message: `Invalid color. Must be one of: ${validColors.join(', ')}` } })
    }

    const db = getDatabase()
    const result = db.insert(schema.highlights).values({
      pathname,
      content_hash,
      start_offset,
      end_offset,
      text,
      color,
      note: note ?? null,
      created_at: new Date().toISOString(),
    }).returning().get()

    const paperId = parsePaperIdFromPathname(pathname)
    if (paperId) touchPaperUpdatedAt(db, paperId)

    return reply.code(201).send({ data: result })
  })

  // PUT /api/highlights/:id
  app.put<{ Params: { id: string }; Body: { color?: string; note?: string | null } }>(
    '/api/highlights/:id', async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      const { color, note } = request.body || {} as any

      const db = getDatabase()
      const existing = db.select().from(schema.highlights)
        .where(eq(schema.highlights.id, id))
        .get()

      if (!existing) {
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
      if (note !== undefined) {
        updates.note = note
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
  app.delete<{ Params: { id: string } }>('/api/highlights/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10)

    const db = getDatabase()
    const existing = db.select().from(schema.highlights)
      .where(eq(schema.highlights.id, id))
      .get()

    if (!existing) {
      return reply.code(404).send({ error: { message: 'Highlight not found' } })
    }

    const paperId = parsePaperIdFromPathname(existing.pathname)
    db.delete(schema.highlights).where(eq(schema.highlights.id, id)).run()
    if (paperId) touchPaperUpdatedAt(db, paperId)
    return { success: true }
  })
}

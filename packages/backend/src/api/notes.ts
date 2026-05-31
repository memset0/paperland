import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'

/**
 * Notes API — ONE Markdown document per (user, paper). The whole note is a single `body`
 * string; structure (mind-map + walkthrough) is derived on the frontend from its Markdown
 * headings. There are no tree endpoints (no create-child / move / subtree-delete) and no
 * walkthrough endpoint.
 */
export async function notesRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/papers/:id/note — owner-scoped single document; anonymous gets { note: null } (HTTP 200).
  app.get<{ Params: { id: string } }>('/api/papers/:id/note', async (request) => {
    const paperId = parseInt(request.params.id, 10)
    const userId = request.user?.id
    if (userId == null) return { note: null }

    const db = getDatabase()
    const note = db.select().from(schema.notes)
      .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
      .get()
    return { note: note ?? null }
  })

  // PUT /api/papers/:id/note — upsert the whole document body; optimistic updated_at on update.
  // The first write (no row yet) creates it and needs no prior updated_at.
  app.put<{ Params: { id: string }; Body: { body?: string; updated_at?: string } }>(
    '/api/papers/:id/note', { preHandler: requireUser }, async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const { body = '', updated_at } = request.body || {}

      const db = getDatabase()
      const existing = db.select().from(schema.notes)
        .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
        .get()

      const now = new Date().toISOString()
      if (existing) {
        if (updated_at && updated_at !== existing.updated_at) {
          return reply.code(409).send({ error: { message: '已在别处修改' }, data: existing })
        }
        db.update(schema.notes).set({ body, updated_at: now }).where(eq(schema.notes.id, existing.id)).run()
        return { data: db.select().from(schema.notes).where(eq(schema.notes.id, existing.id)).get() }
      }

      try {
        const created = db.insert(schema.notes).values({
          user_id: userId, paper_id: paperId, body, created_at: now, updated_at: now,
        }).returning().get()
        return reply.code(201).send({ data: created })
      } catch {
        // unique-index race: another writer created the row — update that one instead.
        const winner = db.select().from(schema.notes)
          .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
          .get()!
        db.update(schema.notes).set({ body, updated_at: now }).where(eq(schema.notes.id, winner.id)).run()
        return { data: db.select().from(schema.notes).where(eq(schema.notes.id, winner.id)).get() }
      }
    },
  )

  // GET /api/notes — one note per paper (the single document), with paper title.
  // Empty-body documents are excluded — they don't count as notes.
  // NOTE: auth is guarded inline (not via the requireUser preHandler) — under this Fastify
  // version a preHandler that sends 401 does not reliably halt a GET handler, so we do the
  // check here as the sole responder to avoid a double-send.
  app.get('/api/notes', async (request, reply) => {
    const userId = request.user?.id
    if (userId == null) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
    }
    const db = getDatabase()
    const rows = db.select({
      id: schema.notes.id,
      user_id: schema.notes.user_id,
      paper_id: schema.notes.paper_id,
      body: schema.notes.body,
      created_at: schema.notes.created_at,
      updated_at: schema.notes.updated_at,
      paper_title: schema.papers.title,
    }).from(schema.notes)
      .innerJoin(schema.papers, eq(schema.notes.paper_id, schema.papers.id))
      .where(eq(schema.notes.user_id, userId))
      .orderBy(desc(schema.notes.updated_at))
      .all()
      .filter((r) => r.body.trim() !== '')
    return { data: rows }
  })
}

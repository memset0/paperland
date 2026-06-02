import type { FastifyInstance } from 'fastify'
import { eq, and, or, ne, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'

/**
 * Notes API — ONE Markdown document per (user, paper). The whole note is a single `body`
 * string; structure (mind-map + walkthrough) is derived on the frontend from its Markdown
 * headings. A `completed` flag records whether the user marked the note's reading complete.
 * An `is_public` flag publishes the note so anyone (incl. anonymous) can read it.
 */
/** Normalize a stored row for the API: `completed`/`is_public` are integers in SQLite, booleans in the API. */
function toNote<T extends { completed: number; is_public: number }>(
  row: T,
): Omit<T, 'completed' | 'is_public'> & { completed: boolean; is_public: boolean } {
  return { ...row, completed: !!row.completed, is_public: !!row.is_public }
}

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
    return { note: note ? toNote(note) : null }
  })

  // PUT /api/papers/:id/note — upsert the whole document body; optimistic updated_at on update.
  // The first write (no row yet) creates it and needs no prior updated_at. `completed` is left
  // untouched (body and completion are updated independently).
  app.put<{ Params: { id: string }; Body: { body?: string; updated_at?: string } }>(
    '/api/papers/:id/note', { preHandler: requireUser }, async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const { body = '', updated_at } = request.body || {}

      const db = getDatabase()
      const reread = (id: number) => toNote(db.select().from(schema.notes).where(eq(schema.notes.id, id)).get()!)
      const existing = db.select().from(schema.notes)
        .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
        .get()

      const now = new Date().toISOString()
      if (existing) {
        if (updated_at && updated_at !== existing.updated_at) {
          return reply.code(409).send({ error: { message: '已在别处修改' }, data: toNote(existing) })
        }
        db.update(schema.notes).set({ body, updated_at: now }).where(eq(schema.notes.id, existing.id)).run()
        return { data: reread(existing.id) }
      }

      try {
        const created = db.insert(schema.notes).values({
          user_id: userId, paper_id: paperId, body, created_at: now, updated_at: now,
        }).returning().get()
        return reply.code(201).send({ data: toNote(created) })
      } catch {
        // unique-index race: another writer created the row — update that one instead.
        const winner = db.select().from(schema.notes)
          .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
          .get()!
        db.update(schema.notes).set({ body, updated_at: now }).where(eq(schema.notes.id, winner.id)).run()
        return { data: reread(winner.id) }
      }
    },
  )

  // POST /api/papers/:id/note/completed — toggle the note's `completed` flag. Owner-scoped; auth
  // guarded inline (a preHandler 401 doesn't reliably halt under this Fastify version). Requires
  // an existing note row — a paper with no note cannot be marked complete.
  app.post<{ Params: { id: string }; Body: { completed?: boolean } }>(
    '/api/papers/:id/note/completed', async (request, reply) => {
      const userId = request.user?.id
      if (userId == null) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
      const paperId = parseInt(request.params.id, 10)
      const completed = request.body?.completed ? 1 : 0

      const db = getDatabase()
      const existing = db.select().from(schema.notes)
        .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
        .get()
      if (!existing) return reply.code(400).send({ error: { message: 'No note to mark complete' } })

      db.update(schema.notes).set({ completed }).where(eq(schema.notes.id, existing.id)).run()
      return { data: toNote(db.select().from(schema.notes).where(eq(schema.notes.id, existing.id)).get()!) }
    },
  )

  // PUT /api/papers/:id/note/visibility — publish/unpublish the caller's note. Owner-scoped; auth
  // guarded inline. Requires an existing, NON-EMPTY note (publishing nothing is meaningless). The
  // toggle is independent of body autosave, so it carries no optimistic `updated_at` check.
  app.put<{ Params: { id: string }; Body: { is_public?: boolean } }>(
    '/api/papers/:id/note/visibility', async (request, reply) => {
      const userId = request.user?.id
      if (userId == null) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
      const paperId = parseInt(request.params.id, 10)
      const is_public = request.body?.is_public ? 1 : 0

      const db = getDatabase()
      const existing = db.select().from(schema.notes)
        .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
        .get()
      if (!existing || existing.body.trim() === '') {
        return reply.code(400).send({ error: { message: 'No note to publish' } })
      }

      db.update(schema.notes).set({ is_public }).where(eq(schema.notes.id, existing.id)).run()
      return { data: toNote(db.select().from(schema.notes).where(eq(schema.notes.id, existing.id)).get()!) }
    },
  )

  // GET /api/papers/:id/public-notes — body-less list of OTHER users' public, non-empty notes for
  // the paper (anonymous excludes nobody). The body is fetched lazily per entry via GET /api/notes/:noteId.
  app.get<{ Params: { id: string } }>('/api/papers/:id/public-notes', async (request) => {
    const paperId = parseInt(request.params.id, 10)
    const callerId = request.user?.id ?? -1 // -1 excludes nobody for anonymous

    const db = getDatabase()
    const rows = db.select({
      id: schema.notes.id,
      user_id: schema.notes.user_id,
      username: schema.users.username,
      updated_at: schema.notes.updated_at,
      body: schema.notes.body,
    }).from(schema.notes)
      .innerJoin(schema.users, eq(schema.notes.user_id, schema.users.id))
      .where(and(
        eq(schema.notes.paper_id, paperId),
        eq(schema.notes.is_public, 1),
        ne(schema.notes.user_id, callerId),
      ))
      .orderBy(desc(schema.notes.updated_at))
      .all()
      .filter((r) => r.body.trim() !== '')
      .map(({ body: _body, ...summary }) => summary)
    return { data: rows }
  })

  // GET /api/notes/:noteId — a single note's full content with author. Authorized when the note is
  // public, OR owned by the caller, OR the caller is an admin. Otherwise 404 (don't reveal existence).
  app.get<{ Params: { noteId: string } }>('/api/notes/:noteId', async (request, reply) => {
    const noteId = parseInt(request.params.noteId, 10)
    if (Number.isNaN(noteId)) return reply.code(404).send({ error: { message: 'Not found' } })

    const db = getDatabase()
    const row = db.select({
      id: schema.notes.id,
      user_id: schema.notes.user_id,
      paper_id: schema.notes.paper_id,
      body: schema.notes.body,
      completed: schema.notes.completed,
      is_public: schema.notes.is_public,
      created_at: schema.notes.created_at,
      updated_at: schema.notes.updated_at,
      paper_title: schema.papers.title,
      username: schema.users.username,
    }).from(schema.notes)
      .innerJoin(schema.papers, eq(schema.notes.paper_id, schema.papers.id))
      .innerJoin(schema.users, eq(schema.notes.user_id, schema.users.id))
      .where(eq(schema.notes.id, noteId))
      .get()

    if (!row) return reply.code(404).send({ error: { message: 'Not found' } })
    const isOwner = request.user?.id === row.user_id
    const isAdmin = request.user?.role === 'admin'
    if (!row.is_public && !isOwner && !isAdmin) {
      return reply.code(404).send({ error: { message: 'Not found' } })
    }
    return { data: toNote(row) }
  })

  // GET /api/notes — one note per paper (the single document), annotated with paper title, author,
  // completion, and visibility. Empty-body documents are excluded. Query:
  //   ?scope=mine|all      (default mine)   — mine: caller's own notes (anonymous → 401);
  //                                            all: public notes (any author) + caller's own.
  //   ?include_private=true (admin only)    — when scope=all, also include others' private notes.
  // NOTE: auth is guarded inline (not via the requireUser preHandler) — under this Fastify
  // version a preHandler that sends 401 does not reliably halt a GET handler.
  app.get<{ Querystring: { scope?: string; include_private?: string } }>('/api/notes', async (request, reply) => {
    const userId = request.user?.id ?? null
    const isAdmin = request.user?.role === 'admin'
    const scope = request.query.scope === 'all' ? 'all' : 'mine'

    if (scope === 'mine' && userId == null) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } })
    }

    // Visibility filter. mine → only the caller's notes. all → public OR own; admins may also
    // pull others' private notes via include_private (no visibility filter at all).
    let where
    if (scope === 'mine') {
      where = eq(schema.notes.user_id, userId!)
    } else {
      const includePrivate = request.query.include_private === 'true' && isAdmin
      if (includePrivate) where = undefined // every note
      else if (userId != null) where = or(eq(schema.notes.is_public, 1), eq(schema.notes.user_id, userId))
      else where = eq(schema.notes.is_public, 1)
    }

    const db = getDatabase()
    const rows = db.select({
      id: schema.notes.id,
      user_id: schema.notes.user_id,
      paper_id: schema.notes.paper_id,
      body: schema.notes.body,
      completed: schema.notes.completed,
      is_public: schema.notes.is_public,
      created_at: schema.notes.created_at,
      updated_at: schema.notes.updated_at,
      paper_title: schema.papers.title,
      username: schema.users.username,
    }).from(schema.notes)
      .innerJoin(schema.papers, eq(schema.notes.paper_id, schema.papers.id))
      .innerJoin(schema.users, eq(schema.notes.user_id, schema.users.id))
      .where(where)
      .orderBy(desc(schema.notes.updated_at))
      .all()
      .filter((r) => r.body.trim() !== '')
      .map(toNote)
    return { data: rows }
  })
}

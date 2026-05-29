import type { FastifyInstance } from 'fastify'
import { eq, and, desc, isNull, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'

type NoteRow = typeof schema.notes.$inferSelect

export async function notesRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/papers/:id/notes — owner-scoped; anonymous gets empty (HTTP 200).
  app.get<{ Params: { id: string } }>('/api/papers/:id/notes', async (request) => {
    const paperId = parseInt(request.params.id, 10)
    const userId = request.user?.id
    if (userId == null) return { walkthrough: null, notes: [] }

    const db = getDatabase()
    const rows = db.select().from(schema.notes)
      .where(and(eq(schema.notes.paper_id, paperId), eq(schema.notes.user_id, userId)))
      .all()

    const walkthrough = rows.find((r) => r.kind === 'walkthrough') ?? null
    const notes = rows.filter((r) => r.kind === 'note').sort((a, b) => a.sort_order - b.sort_order)
    return { walkthrough, notes }
  })

  // PUT /api/papers/:id/walkthrough — upsert the single walkthrough; optimistic updated_at.
  app.put<{ Params: { id: string }; Body: { body?: string; updated_at?: string } }>(
    '/api/papers/:id/walkthrough', { preHandler: requireUser }, async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const { body = '', updated_at } = request.body || {}

      const db = getDatabase()
      const existing = db.select().from(schema.notes)
        .where(and(
          eq(schema.notes.paper_id, paperId),
          eq(schema.notes.user_id, userId),
          eq(schema.notes.kind, 'walkthrough'),
        ))
        .get()

      const now = new Date().toISOString()
      if (existing) {
        if (updated_at && updated_at !== existing.updated_at) {
          return reply.code(409).send({ error: { message: '已在别处修改' }, data: existing })
        }
        db.update(schema.notes).set({ body, updated_at: now }).where(eq(schema.notes.id, existing.id)).run()
        return { data: db.select().from(schema.notes).where(eq(schema.notes.id, existing.id)).get() }
      }

      const created = db.insert(schema.notes).values({
        user_id: userId, paper_id: paperId, kind: 'walkthrough',
        parent_id: null, title: null, body, sort_order: 0, created_at: now, updated_at: now,
      }).returning().get()
      return reply.code(201).send({ data: created })
    },
  )

  // POST /api/papers/:id/notes — create a small note; appended at end of its sibling list.
  app.post<{ Params: { id: string }; Body: { title?: string | null; body?: string; parent_id?: number | null } }>(
    '/api/papers/:id/notes', { preHandler: requireUser }, async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const { title = null, body = '', parent_id = null } = request.body || {}

      const db = getDatabase()
      if (parent_id != null) {
        const parent = db.select().from(schema.notes).where(eq(schema.notes.id, parent_id)).get()
        if (!parent || parent.user_id !== userId || parent.paper_id !== paperId || parent.kind !== 'note') {
          return reply.code(400).send({ error: { message: 'Invalid parent_id' } })
        }
      }

      const siblings = db.select().from(schema.notes)
        .where(and(
          eq(schema.notes.user_id, userId),
          eq(schema.notes.paper_id, paperId),
          eq(schema.notes.kind, 'note'),
          parent_id == null ? isNull(schema.notes.parent_id) : eq(schema.notes.parent_id, parent_id),
        ))
        .all()
      const sort_order = siblings.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1

      const now = new Date().toISOString()
      const created = db.insert(schema.notes).values({
        user_id: userId, paper_id: paperId, kind: 'note', parent_id, title, body, sort_order, created_at: now, updated_at: now,
      }).returning().get()
      return reply.code(201).send({ data: created })
    },
  )

  // PATCH /api/notes/:id — update title/body; optimistic updated_at; 404 if not owner.
  app.patch<{ Params: { id: string }; Body: { title?: string | null; body?: string; updated_at?: string } }>(
    '/api/notes/:id', { preHandler: requireUser }, async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const db = getDatabase()

      const existing = db.select().from(schema.notes).where(eq(schema.notes.id, id)).get()
      if (!existing || existing.user_id !== userId) {
        return reply.code(404).send({ error: { message: 'Note not found' } })
      }

      const { title, body, updated_at } = request.body || {}
      if (updated_at && updated_at !== existing.updated_at) {
        return reply.code(409).send({ error: { message: '已在别处修改' }, data: existing })
      }

      const updates: Record<string, unknown> = {}
      if (title !== undefined) updates.title = title
      if (body !== undefined) updates.body = body
      if (Object.keys(updates).length === 0) return { data: existing }

      updates.updated_at = new Date().toISOString()
      db.update(schema.notes).set(updates).where(eq(schema.notes.id, id)).run()
      return { data: db.select().from(schema.notes).where(eq(schema.notes.id, id)).get() }
    },
  )

  // POST /api/notes/:id/move — reparent + reorder; rejects cycles (moving under own descendant).
  app.post<{ Params: { id: string }; Body: { parent_id?: number | null; sort_order?: number } }>(
    '/api/notes/:id/move', { preHandler: requireUser }, async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const { parent_id = null, sort_order = 0 } = request.body || {}

      const db = getDatabase()
      const node = db.select().from(schema.notes).where(eq(schema.notes.id, id)).get()
      if (!node || node.user_id !== userId) {
        return reply.code(404).send({ error: { message: 'Note not found' } })
      }
      if (node.kind !== 'note') {
        return reply.code(400).send({ error: { message: 'Only small notes can be moved' } })
      }

      if (parent_id != null) {
        const parent = db.select().from(schema.notes).where(eq(schema.notes.id, parent_id)).get()
        if (!parent || parent.user_id !== userId || parent.paper_id !== node.paper_id || parent.kind !== 'note') {
          return reply.code(400).send({ error: { message: 'Invalid parent_id' } })
        }
        // Cycle guard: walk up the parent chain — if we reach the moving node, reject.
        let cur: NoteRow | undefined = parent
        while (cur) {
          if (cur.id === id) {
            return reply.code(400).send({ error: { message: 'Cannot move a note under its own descendant' } })
          }
          cur = cur.parent_id != null
            ? db.select().from(schema.notes).where(eq(schema.notes.id, cur.parent_id)).get()
            : undefined
        }
      }

      db.update(schema.notes)
        .set({ parent_id, sort_order, updated_at: new Date().toISOString() })
        .where(eq(schema.notes.id, id)).run()
      return { data: db.select().from(schema.notes).where(eq(schema.notes.id, id)).get() }
    },
  )

  // DELETE /api/notes/:id — delete the note and its entire subtree in one transaction.
  app.delete<{ Params: { id: string } }>('/api/notes/:id', { preHandler: requireUser }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const userId = request.user!.id
    const db = getDatabase()

    const node = db.select().from(schema.notes).where(eq(schema.notes.id, id)).get()
    if (!node || node.user_id !== userId) {
      return reply.code(404).send({ error: { message: 'Note not found' } })
    }

    // Build the child map from this user's notes for the paper, then collect the subtree.
    const all = db.select().from(schema.notes)
      .where(and(eq(schema.notes.user_id, userId), eq(schema.notes.paper_id, node.paper_id)))
      .all()
    const childrenOf = new Map<number, number[]>()
    for (const n of all) {
      if (n.parent_id != null) {
        const list = childrenOf.get(n.parent_id) || []
        list.push(n.id)
        childrenOf.set(n.parent_id, list)
      }
    }
    const toDelete: number[] = []
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      toDelete.push(cur)
      for (const c of childrenOf.get(cur) || []) stack.push(c)
    }

    db.transaction((tx) => {
      tx.delete(schema.notes).where(inArray(schema.notes.id, toDelete)).run()
    })
    return { success: true, deleted: toDelete.length }
  })

  // GET /api/notes — all of the current user's notes across papers, with paper title.
  app.get('/api/notes', { preHandler: requireUser }, async (request) => {
    const userId = request.user!.id
    const db = getDatabase()
    const rows = db.select({
      id: schema.notes.id,
      user_id: schema.notes.user_id,
      paper_id: schema.notes.paper_id,
      kind: schema.notes.kind,
      parent_id: schema.notes.parent_id,
      title: schema.notes.title,
      body: schema.notes.body,
      sort_order: schema.notes.sort_order,
      created_at: schema.notes.created_at,
      updated_at: schema.notes.updated_at,
      paper_title: schema.papers.title,
    }).from(schema.notes)
      .innerJoin(schema.papers, eq(schema.notes.paper_id, schema.papers.id))
      .where(eq(schema.notes.user_id, userId))
      .orderBy(desc(schema.notes.updated_at))
      .all()
    return { data: rows }
  })
}

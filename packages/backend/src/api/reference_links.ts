import type { FastifyInstance } from 'fastify'
import { eq, and, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 1000

// Validate/normalize a title. Returns the trimmed value, or null if invalid (empty / too long).
function normalizeTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t.length === 0 || t.length > TITLE_MAX) return null
  return t
}

// Validate/normalize a url: must be a syntactically valid absolute http(s) URL.
// Returns the trimmed value, or null if invalid.
function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const u = raw.trim()
  if (u.length === 0) return null
  let parsed: URL
  try {
    parsed = new URL(u)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return u
}

// Normalize an optional description: undefined/null/empty all collapse to null.
// Returns { ok, value } so callers can distinguish "too long" (invalid) from "absent".
function normalizeDescription(raw: unknown): { ok: boolean; value: string | null } {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, value: null }
  const d = raw.trim()
  if (d.length === 0) return { ok: true, value: null }
  if (d.length > DESCRIPTION_MAX) return { ok: false, value: null }
  return { ok: true, value: d }
}

export async function referenceLinksRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/papers/:id/reference-links — owner-scoped; anonymous gets an empty list (HTTP 200).
  // Ordered oldest-first (insertion order), id as tiebreaker.
  app.get<{ Params: { id: string } }>('/api/papers/:id/reference-links', async (request) => {
    const paperId = parseInt(request.params.id, 10)
    const userId = request.user?.id
    if (userId == null) return { data: [] }

    const db = getDatabase()
    const data = db.select().from(schema.paperReferenceLinks)
      .where(and(
        eq(schema.paperReferenceLinks.paper_id, paperId),
        eq(schema.paperReferenceLinks.user_id, userId),
      ))
      .orderBy(asc(schema.paperReferenceLinks.created_at), asc(schema.paperReferenceLinks.id))
      .all()
    return { data }
  })

  // POST /api/papers/:id/reference-links — create a link for the current user.
  app.post<{ Params: { id: string }; Body: { title?: string; url?: string; description?: string | null } }>(
    '/api/papers/:id/reference-links', { preHandler: requireUser }, async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const { title: rawTitle, url: rawUrl, description: rawDesc } = request.body || {}

      const title = normalizeTitle(rawTitle)
      if (!title) return reply.code(400).send({ error: { message: 'A non-empty title is required' } })
      const url = normalizeUrl(rawUrl)
      if (!url) return reply.code(400).send({ error: { message: 'A valid http(s) url is required' } })
      const desc = normalizeDescription(rawDesc)
      if (!desc.ok) return reply.code(400).send({ error: { message: 'Description is too long' } })

      const db = getDatabase()
      const now = new Date().toISOString()
      const created = db.insert(schema.paperReferenceLinks).values({
        user_id: userId, paper_id: paperId, title, url, description: desc.value, created_at: now, updated_at: now,
      }).returning().get()
      return reply.code(201).send({ data: created })
    },
  )

  // PATCH /api/reference-links/:id — update provided fields; 404 if not owner.
  app.patch<{ Params: { id: string }; Body: { title?: string; url?: string; description?: string | null } }>(
    '/api/reference-links/:id', { preHandler: requireUser }, async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const db = getDatabase()

      const existing = db.select().from(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).get()
      if (!existing || existing.user_id !== userId) {
        return reply.code(404).send({ error: { message: 'Reference link not found' } })
      }

      const { title: rawTitle, url: rawUrl, description: rawDesc } = request.body || {}
      const updates: Record<string, unknown> = {}
      if (rawTitle !== undefined) {
        const title = normalizeTitle(rawTitle)
        if (!title) return reply.code(400).send({ error: { message: 'A non-empty title is required' } })
        updates.title = title
      }
      if (rawUrl !== undefined) {
        const url = normalizeUrl(rawUrl)
        if (!url) return reply.code(400).send({ error: { message: 'A valid http(s) url is required' } })
        updates.url = url
      }
      if (rawDesc !== undefined) {
        const desc = normalizeDescription(rawDesc)
        if (!desc.ok) return reply.code(400).send({ error: { message: 'Description is too long' } })
        updates.description = desc.value
      }
      if (Object.keys(updates).length === 0) return { data: existing }

      updates.updated_at = new Date().toISOString()
      db.update(schema.paperReferenceLinks).set(updates).where(eq(schema.paperReferenceLinks.id, id)).run()
      return { data: db.select().from(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).get() }
    },
  )

  // DELETE /api/reference-links/:id — delete; 404 if not owner.
  app.delete<{ Params: { id: string } }>('/api/reference-links/:id', { preHandler: requireUser }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const userId = request.user!.id
    const db = getDatabase()

    const existing = db.select().from(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).get()
    if (!existing || existing.user_id !== userId) {
      return reply.code(404).send({ error: { message: 'Reference link not found' } })
    }

    db.delete(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).run()
    return { success: true }
  })
}

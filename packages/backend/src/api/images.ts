import type { FastifyInstance } from 'fastify'
import { desc, eq, isNotNull } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { requireUser } from '../auth/guards.js'
import { displayName } from '../auth/nickname.js'
import { storeImage, ImageValidationError } from '../services/image_store.js'
import { parseStoredInputs } from '../services/qa_inputs.js'

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0
  let count = 0
  let idx = haystack.indexOf(needle)
  while (idx !== -1) {
    count++
    idx = haystack.indexOf(needle, idx + needle.length)
  }
  return count
}

export async function imagesRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/images — authenticated upload. Body: { data: base64|dataURL, filename? }.
  // Dedupes on the content hash; returns 201 for a new image, 200 when an identical one
  // already existed. Response includes the canonical public URL.
  app.post<{ Body: { data?: string; filename?: string | null } }>(
    '/api/images', { preHandler: requireUser }, async (request, reply) => {
      const { data, filename } = request.body || {}
      if (!data || typeof data !== 'string') {
        return reply.code(400).send({ error: { message: 'Missing image data' } })
      }
      try {
        const { row, deduped } = storeImage(data, {
          originalName: filename ?? null,
          userId: request.user!.id,
        })
        return reply.code(deduped ? 200 : 201).send({ data: { ...row, url: `/image/${row.path}` } })
      } catch (e) {
        if (e instanceof ImageValidationError) {
          return reply.code(400).send({ error: { message: e.message } })
        }
        throw e
      }
    },
  )

  // GET /api/images — list images, newest first: a non-admin gets only their own uploads, an admin
  // gets every image. Each carries the uploader's display name, a reference_count computed by
  // scanning every note body for the image's hash (works for relative or absolute URLs), and a
  // qa_reference_count of Q&A image inputs that use it. Image URLs stay public; only the list is scoped.
  app.get('/api/images', { preHandler: requireUser }, async (request) => {
    const db = getDatabase()
    const user = request.user!
    const rows = db.select({ image: schema.images, nickname: schema.users.nickname, username: schema.users.username })
      .from(schema.images)
      .leftJoin(schema.users, eq(schema.users.id, schema.images.uploaded_by))
      .where(user.role === 'admin' ? undefined : eq(schema.images.uploaded_by, user.id))
      .orderBy(desc(schema.images.created_at))
      .all()
    const images = rows.map((r) => ({ ...r.image, uploaded_by_name: displayName(r.username != null ? { username: r.username, nickname: r.nickname } : null) }))
    const bodies = db.select({ body: schema.notes.body }).from(schema.notes).all()
    const qaReferences = new Map<string, number>()
    for (const row of db.select({ inputs: schema.qaEntries.inputs }).from(schema.qaEntries)
      .where(isNotNull(schema.qaEntries.inputs)).all()) {
      for (const input of parseStoredInputs(row.inputs)) {
        if (input.kind === 'image') qaReferences.set(input.image_hash, (qaReferences.get(input.image_hash) || 0) + 1)
      }
    }
    const data = images.map((img) => ({
      ...img,
      url: `/image/${img.path}`,
      reference_count: bodies.reduce((sum, n) => sum + countOccurrences(n.body || '', img.hash), 0),
      qa_reference_count: qaReferences.get(img.hash) || 0,
    }))
    // public_base_url lets the client build absolute "copy link" URLs; blank ⇒ use origin.
    return { data, public_base_url: getConfig().image_host.public_base_url }
  })
  // Images are intentionally not deletable: notes and Q&A inputs (screenshots that follow-ups and
  // regenerations still send to models) must keep resolving.
}

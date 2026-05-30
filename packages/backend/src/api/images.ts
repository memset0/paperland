import type { FastifyInstance } from 'fastify'
import { eq, desc } from 'drizzle-orm'
import { existsSync, rmSync } from 'fs'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { requireUser } from '../auth/guards.js'
import { storeImage, imageAbsPath, ImageValidationError } from '../services/image_store.js'

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

  // GET /api/images — list all images, newest first, each with a reference_count computed
  // by scanning every note body for the image's hash (works for relative or absolute URLs).
  app.get('/api/images', { preHandler: requireUser }, async () => {
    const db = getDatabase()
    const images = db.select().from(schema.images).orderBy(desc(schema.images.created_at)).all()
    const bodies = db.select({ body: schema.notes.body }).from(schema.notes).all()
    const data = images.map((img) => ({
      ...img,
      url: `/image/${img.path}`,
      reference_count: bodies.reduce((sum, n) => sum + countOccurrences(n.body || '', img.hash), 0),
    }))
    // public_base_url lets the client build absolute "copy link" URLs; blank ⇒ use origin.
    return { data, public_base_url: getConfig().image_host.public_base_url }
  })

  // DELETE /api/images/:hash — remove the row and the file from disk. Idempotent on the
  // file (already-gone is fine). The client is responsible for warning when referenced.
  app.delete<{ Params: { hash: string } }>(
    '/api/images/:hash', { preHandler: requireUser }, async (request, reply) => {
      const { hash } = request.params
      const db = getDatabase()
      const img = db.select().from(schema.images).where(eq(schema.images.hash, hash)).get()
      if (!img) return reply.code(404).send({ error: { message: 'Image not found' } })

      const abs = imageAbsPath(img.path)
      if (existsSync(abs)) rmSync(abs)
      db.delete(schema.images).where(eq(schema.images.hash, hash)).run()
      return { success: true }
    },
  )
}

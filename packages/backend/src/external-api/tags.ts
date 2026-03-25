import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { randomTagColor } from '../utils/tag-colors.js'
import { syncPaperTagsJson } from '../utils/tags-json-sync.js'

export async function externalTagRoutes(app: FastifyInstance): Promise<void> {
  // PUT — replace all tags for a paper
  app.put<{ Params: { id: string }; Body: { tags: string[] } }>(
    '/external-api/v1/papers/:id/tags',
    async (request, reply) => {
      const db = getDatabase()
      const paperId = parseInt(request.params.id, 10)
      const { tags: tagNames } = request.body || {}

      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

      // Remove all existing tags
      db.delete(schema.paperTags).where(eq(schema.paperTags.paper_id, paperId)).run()

      // Add new tags
      const resultTags: string[] = []
      for (const tagName of (tagNames || [])) {
        let tag = db.select().from(schema.tags).where(eq(schema.tags.name, tagName)).get()
        if (!tag) tag = db.insert(schema.tags).values({ name: tagName, color: randomTagColor() }).returning().get()
        db.insert(schema.paperTags).values({ paper_id: paperId, tag_id: tag.id }).run()
        resultTags.push(tagName)
      }

      syncPaperTagsJson(paperId)
      return { id: paperId, tags: resultTags }
    }
  )

  // PATCH — add/remove tags
  app.patch<{ Params: { id: string }; Body: { add?: string[]; remove?: string[] } }>(
    '/external-api/v1/papers/:id/tags',
    async (request, reply) => {
      const db = getDatabase()
      const paperId = parseInt(request.params.id, 10)
      const { add, remove } = request.body || {}

      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

      // Remove tags
      if (remove) {
        for (const tagName of remove) {
          const tag = db.select().from(schema.tags).where(eq(schema.tags.name, tagName)).get()
          if (tag) {
            db.delete(schema.paperTags)
              .where(eq(schema.paperTags.paper_id, paperId))
              .run()
            // Re-add other tags (SQLite doesn't support compound WHERE in delete easily)
            // Actually let's use a different approach
          }
        }
        // Simpler: get current tags, filter, reset
        const current = db.select().from(schema.paperTags).where(eq(schema.paperTags.paper_id, paperId)).all()
        const removeTagIds = new Set<number>()
        for (const tagName of remove) {
          const tag = db.select().from(schema.tags).where(eq(schema.tags.name, tagName)).get()
          if (tag) removeTagIds.add(tag.id)
        }
        for (const pt of current) {
          if (removeTagIds.has(pt.tag_id)) {
            db.delete(schema.paperTags)
              .where(eq(schema.paperTags.paper_id, paperId))
              .run()
          }
        }
        // Re-add the ones that weren't removed
        for (const pt of current) {
          if (!removeTagIds.has(pt.tag_id)) {
            try { db.insert(schema.paperTags).values({ paper_id: paperId, tag_id: pt.tag_id }).run() } catch {}
          }
        }
      }

      // Add tags
      if (add) {
        for (const tagName of add) {
          let tag = db.select().from(schema.tags).where(eq(schema.tags.name, tagName)).get()
          if (!tag) tag = db.insert(schema.tags).values({ name: tagName, color: randomTagColor() }).returning().get()
          try { db.insert(schema.paperTags).values({ paper_id: paperId, tag_id: tag.id }).run() } catch {}
        }
      }

      // Return updated tags
      const paperTagRows = db.select().from(schema.paperTags).where(eq(schema.paperTags.paper_id, paperId)).all()
      const tagIds = paperTagRows.map((pt) => pt.tag_id)
      const allTags = tagIds.length > 0 ? db.select().from(schema.tags).all().filter((t) => tagIds.includes(t.id)) : []

      syncPaperTagsJson(paperId)
      return { id: paperId, tags: allTags.map((t) => t.name) }
    }
  )
}

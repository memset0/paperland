import type { FastifyInstance } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { randomTagColor } from '../utils/tag-colors.js'
import { syncPaperTagsJson, syncTagsJsonForPapers } from '../utils/tags-json-sync.js'

export async function tagRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/tags — list all tags with paper count
  app.get('/api/tags', async () => {
    const db = getDatabase()
    const tags = db.select().from(schema.tags).all()

    // Count papers per tag
    const counts = db.select({
      tag_id: schema.paperTags.tag_id,
      count: sql<number>`count(*)`.as('count'),
    }).from(schema.paperTags).groupBy(schema.paperTags.tag_id).all()

    const countMap = new Map(counts.map(c => [c.tag_id, c.count]))

    return tags.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      paper_count: countMap.get(t.id) || 0,
    }))
  })

  // PATCH /api/tags/:id — rename and/or change color
  app.patch<{ Params: { id: string }; Body: { name?: string; color?: string } }>(
    '/api/tags/:id',
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const tag = db.select().from(schema.tags).where(eq(schema.tags.id, id)).get()
      if (!tag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Tag not found' } }); return }

      const { name, color } = request.body || {}
      const updates: Record<string, any> = {}

      if (name !== undefined && name !== tag.name) {
        // Check for name conflict
        const existing = db.select().from(schema.tags).where(eq(schema.tags.name, name)).get()
        if (existing) {
          reply.code(409).send({
            error: { code: 'TAG_NAME_CONFLICT', message: 'A tag with this name already exists' },
            target_tag: { id: existing.id, name: existing.name, color: existing.color },
          })
          return
        }
        updates.name = name
      }

      if (color !== undefined) {
        updates.color = color
      }

      if (Object.keys(updates).length === 0) {
        return { id: tag.id, name: tag.name, color: tag.color }
      }

      db.update(schema.tags).set(updates).where(eq(schema.tags.id, id)).run()

      // If name changed, sync tags_json for all affected papers
      if (updates.name) {
        const paperIds = db.select({ paper_id: schema.paperTags.paper_id })
          .from(schema.paperTags)
          .where(eq(schema.paperTags.tag_id, id))
          .all()
          .map(r => r.paper_id)
        syncTagsJsonForPapers(paperIds)
      }

      const updated = db.select().from(schema.tags).where(eq(schema.tags.id, id)).get()!
      return { id: updated.id, name: updated.name, color: updated.color }
    }
  )

  // POST /api/tags/:id/merge — merge source into target
  app.post<{ Params: { id: string }; Body: { target_id: number } }>(
    '/api/tags/:id/merge',
    async (request, reply) => {
      const db = getDatabase()
      const sourceId = parseInt(request.params.id, 10)
      const { target_id: targetId } = request.body || {}

      const sourceTag = db.select().from(schema.tags).where(eq(schema.tags.id, sourceId)).get()
      if (!sourceTag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Source tag not found' } }); return }

      const targetTag = db.select().from(schema.tags).where(eq(schema.tags.id, targetId)).get()
      if (!targetTag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Target tag not found' } }); return }

      const sqlite = getSqliteDatabase()
      const affectedPaperIds: number[] = []

      const tx = sqlite.transaction(() => {
        // Get all papers with source tag
        const sourcePapers = db.select({ paper_id: schema.paperTags.paper_id })
          .from(schema.paperTags)
          .where(eq(schema.paperTags.tag_id, sourceId))
          .all()

        for (const sp of sourcePapers) {
          affectedPaperIds.push(sp.paper_id)
          // Try to add target tag association (may already exist)
          try {
            db.insert(schema.paperTags).values({ paper_id: sp.paper_id, tag_id: targetId }).run()
          } catch {}
        }

        // Delete all source tag associations
        db.delete(schema.paperTags).where(eq(schema.paperTags.tag_id, sourceId)).run()

        // Delete source tag
        db.delete(schema.tags).where(eq(schema.tags.id, sourceId)).run()
      })
      tx()

      // Sync tags_json for all affected papers
      syncTagsJsonForPapers([...new Set(affectedPaperIds)])

      return { merged: true, source_id: sourceId, target_id: targetId, target_tag: { id: targetTag.id, name: targetTag.name, color: targetTag.color } }
    }
  )

  // DELETE /api/tags/:id — delete tag
  app.delete<{ Params: { id: string } }>(
    '/api/tags/:id',
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const tag = db.select().from(schema.tags).where(eq(schema.tags.id, id)).get()
      if (!tag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Tag not found' } }); return }

      // Get affected papers before deleting
      const affectedPaperIds = db.select({ paper_id: schema.paperTags.paper_id })
        .from(schema.paperTags)
        .where(eq(schema.paperTags.tag_id, id))
        .all()
        .map(r => r.paper_id)

      const sqlite = getSqliteDatabase()
      const tx = sqlite.transaction(() => {
        db.delete(schema.paperTags).where(eq(schema.paperTags.tag_id, id)).run()
        db.delete(schema.tags).where(eq(schema.tags.id, id)).run()
      })
      tx()

      // Sync tags_json for affected papers
      syncTagsJsonForPapers(affectedPaperIds)

      return { success: true, deleted_id: id }
    }
  )
}

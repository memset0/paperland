import type { FastifyInstance } from 'fastify'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'
import { randomTagColor } from '../utils/tag-colors.js'

/** Load a tag only if it belongs to the given user. */
function getOwnedTag(userId: number, id: number) {
  const db = getDatabase()
  return db.select().from(schema.tags)
    .where(and(eq(schema.tags.id, id), eq(schema.tags.user_id, userId)))
    .get()
}

export async function tagRoutes(app: FastifyInstance): Promise<void> {
  // All tag-management routes require login and operate only on the current user's tags.
  app.addHook('preHandler', requireUser)

  // GET /api/tags — list the current user's tags with paper count
  app.get('/api/tags', async (request) => {
    const db = getDatabase()
    const userId = request.user!.id
    const tags = db.select().from(schema.tags).where(eq(schema.tags.user_id, userId)).all()

    const tagIds = tags.map(t => t.id)
    const countMap = new Map<number, number>()
    if (tagIds.length > 0) {
      const counts = db.select({
        tag_id: schema.paperTags.tag_id,
        count: sql<number>`count(*)`.as('count'),
      }).from(schema.paperTags).where(inArray(schema.paperTags.tag_id, tagIds)).groupBy(schema.paperTags.tag_id).all()
      for (const c of counts) countMap.set(c.tag_id, c.count)
    }

    return tags.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      visible: !!t.visible,
      paper_count: countMap.get(t.id) || 0,
    }))
  })

  // POST /api/tags — create a new tag for the current user
  app.post<{ Body: { name?: string; color?: string } }>(
    '/api/tags',
    async (request, reply) => {
      const db = getDatabase()
      const userId = request.user!.id
      const name = (request.body?.name || '').trim()
      if (!name) {
        reply.code(400).send({ error: { code: 'TAG_NAME_REQUIRED', message: 'Tag name is required' } })
        return
      }

      // Uniqueness is enforced within the current user's tag set.
      const existing = db.select().from(schema.tags)
        .where(and(eq(schema.tags.user_id, userId), eq(schema.tags.name, name)))
        .get()
      if (existing) {
        reply.code(409).send({
          error: { code: 'TAG_NAME_CONFLICT', message: 'A tag with this name already exists' },
          target_tag: { id: existing.id, name: existing.name, color: existing.color },
        })
        return
      }

      const color = request.body?.color || randomTagColor()
      const created = db.insert(schema.tags)
        .values({ user_id: userId, name, color })
        .returning().get()
      reply.code(201)
      return { id: created.id, name: created.name, color: created.color, visible: !!created.visible, paper_count: 0 }
    }
  )

  // PATCH /api/tags/:id — rename and/or change color/visibility (current user's tag)
  app.patch<{ Params: { id: string }; Body: { name?: string; color?: string; visible?: boolean } }>(
    '/api/tags/:id',
    async (request, reply) => {
      const db = getDatabase()
      const userId = request.user!.id
      const id = parseInt(request.params.id, 10)
      const tag = getOwnedTag(userId, id)
      if (!tag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Tag not found' } }); return }

      const { name, color, visible } = request.body || {}
      const updates: Record<string, any> = {}

      if (name !== undefined && name !== tag.name) {
        // Conflict is checked within the current user's tag set.
        const existing = db.select().from(schema.tags)
          .where(and(eq(schema.tags.user_id, userId), eq(schema.tags.name, name)))
          .get()
        if (existing) {
          reply.code(409).send({
            error: { code: 'TAG_NAME_CONFLICT', message: 'A tag with this name already exists' },
            target_tag: { id: existing.id, name: existing.name, color: existing.color },
          })
          return
        }
        updates.name = name
      }

      if (color !== undefined) updates.color = color
      if (visible !== undefined) updates.visible = visible ? 1 : 0

      if (Object.keys(updates).length === 0) {
        return { id: tag.id, name: tag.name, color: tag.color, visible: !!tag.visible }
      }

      db.update(schema.tags).set(updates).where(eq(schema.tags.id, id)).run()
      const updated = db.select().from(schema.tags).where(eq(schema.tags.id, id)).get()!
      return { id: updated.id, name: updated.name, color: updated.color, visible: !!updated.visible }
    }
  )

  // POST /api/tags/:id/merge — merge source into target (both must belong to the user)
  app.post<{ Params: { id: string }; Body: { target_id: number } }>(
    '/api/tags/:id/merge',
    async (request, reply) => {
      const db = getDatabase()
      const userId = request.user!.id
      const sourceId = parseInt(request.params.id, 10)
      const { target_id: targetId } = request.body || {}

      const sourceTag = getOwnedTag(userId, sourceId)
      if (!sourceTag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Source tag not found' } }); return }
      const targetTag = getOwnedTag(userId, targetId)
      if (!targetTag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Target tag not found' } }); return }

      const sqlite = getSqliteDatabase()
      const tx = sqlite.transaction(() => {
        const sourcePapers = db.select({ paper_id: schema.paperTags.paper_id })
          .from(schema.paperTags)
          .where(eq(schema.paperTags.tag_id, sourceId))
          .all()
        for (const sp of sourcePapers) {
          try { db.insert(schema.paperTags).values({ paper_id: sp.paper_id, tag_id: targetId }).run() } catch {}
        }
        db.delete(schema.paperTags).where(eq(schema.paperTags.tag_id, sourceId)).run()
        db.delete(schema.tags).where(eq(schema.tags.id, sourceId)).run()
      })
      tx()

      return { merged: true, source_id: sourceId, target_id: targetId, target_tag: { id: targetTag.id, name: targetTag.name, color: targetTag.color } }
    }
  )

  // DELETE /api/tags/:id — delete the current user's tag
  app.delete<{ Params: { id: string } }>(
    '/api/tags/:id',
    async (request, reply) => {
      const db = getDatabase()
      const userId = request.user!.id
      const id = parseInt(request.params.id, 10)
      const tag = getOwnedTag(userId, id)
      if (!tag) { reply.code(404).send({ error: { code: 'TAG_NOT_FOUND', message: 'Tag not found' } }); return }

      const sqlite = getSqliteDatabase()
      const tx = sqlite.transaction(() => {
        db.delete(schema.paperTags).where(eq(schema.paperTags.tag_id, id)).run()
        db.delete(schema.tags).where(eq(schema.tags.id, id)).run()
      })
      tx()

      return { success: true, deleted_id: id }
    }
  )
}

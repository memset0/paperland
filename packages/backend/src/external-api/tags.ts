import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { findOrCreateUserTag, findUserTagByName, clearUserPaperTags, userTagsForPaper } from '../utils/user-tags.js'

export async function externalTagRoutes(app: FastifyInstance): Promise<void> {
  // PUT — replace the token user's tags for a paper
  app.put<{ Params: { id: string }; Body: { tags: string[] } }>(
    '/external-api/v1/papers/:id/tags',
    async (request, reply) => {
      const db = getDatabase()
      const userId = request.user?.id
      if (userId == null) { reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token has no associated user' } }); return }
      const paperId = parseInt(request.params.id, 10)
      const { tags: tagNames } = request.body || {}

      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

      // Replace only the token user's tags on this paper.
      clearUserPaperTags(db, paperId, userId)

      const resultTags: string[] = []
      for (const tagName of (tagNames || [])) {
        const tag = findOrCreateUserTag(db, userId, tagName)
        try { db.insert(schema.paperTags).values({ paper_id: paperId, tag_id: tag.id }).run() } catch {}
        resultTags.push(tagName)
      }
      return { id: paperId, tags: resultTags }
    }
  )

  // PATCH — add/remove the token user's tags
  app.patch<{ Params: { id: string }; Body: { add?: string[]; remove?: string[] } }>(
    '/external-api/v1/papers/:id/tags',
    async (request, reply) => {
      const db = getDatabase()
      const userId = request.user?.id
      if (userId == null) { reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token has no associated user' } }); return }
      const paperId = parseInt(request.params.id, 10)
      const { add, remove } = request.body || {}

      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

      if (remove) {
        for (const tagName of remove) {
          const tag = findUserTagByName(db, userId, tagName)
          if (tag) {
            db.delete(schema.paperTags)
              .where(and(eq(schema.paperTags.paper_id, paperId), eq(schema.paperTags.tag_id, tag.id)))
              .run()
          }
        }
      }

      if (add) {
        for (const tagName of add) {
          const tag = findOrCreateUserTag(db, userId, tagName)
          try { db.insert(schema.paperTags).values({ paper_id: paperId, tag_id: tag.id }).run() } catch {}
        }
      }

      return { id: paperId, tags: userTagsForPaper(db, paperId, userId).map((t) => t.name) }
    }
  )
}

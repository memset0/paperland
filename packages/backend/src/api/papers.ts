import type { FastifyInstance } from 'fastify'
import { eq, like, or, desc, asc, inArray, sql, and } from 'drizzle-orm'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { withDedup, getDedupKey } from '../services/paper_dedup.js'
import { serviceRunner } from '../services/service_runner.js'
import { requireUser } from '../auth/guards.js'
import { userTagsByPapers, userTagsForPaper, findOrCreateUserTag, findUserTagByName, clearUserPaperTags } from '../utils/user-tags.js'

export async function paperRoutes(app: FastifyInstance): Promise<void> {
  // List papers with pagination and search
  app.get<{ Querystring: { page?: string; page_size?: string; search?: string; sort_by?: string; sort_order?: string; tag_ids?: string } }>(
    '/api/papers',
    async (request) => {
      const db = getDatabase()
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = parseInt(request.query.page_size || '20', 10)
      const search = request.query.search
      const tagIdsParam = request.query.tag_ids

      const allowedSortBy = ['created_at', 'updated_at'] as const
      const sortBy = allowedSortBy.includes(request.query.sort_by as any) ? (request.query.sort_by as 'created_at' | 'updated_at') : 'created_at'
      const sortOrder = request.query.sort_order === 'asc' ? 'asc' : 'desc'

      // If tag_ids filter, find paper IDs that have ALL specified tags
      let tagFilteredPaperIds: number[] | null = null
      if (tagIdsParam) {
        const tagIds = tagIdsParam.split(',').map(Number).filter(n => !isNaN(n))
        if (tagIds.length > 0) {
          const rows = db.select({
            paper_id: schema.paperTags.paper_id,
            cnt: sql<number>`count(distinct ${schema.paperTags.tag_id})`.as('cnt'),
          })
            .from(schema.paperTags)
            .where(inArray(schema.paperTags.tag_id, tagIds))
            .groupBy(schema.paperTags.paper_id)
            .all()
          tagFilteredPaperIds = rows.filter(r => r.cnt === tagIds.length).map(r => r.paper_id)
          if (tagFilteredPaperIds.length === 0) {
            return { data: [], pagination: { page, page_size: pageSize, total: 0, total_pages: 0 } }
          }
        }
      }

      const conditions = []
      if (search) {
        conditions.push(or(
          like(schema.papers.title, `%${search}%`),
          like(schema.papers.abstract, `%${search}%`)
        )!)
      }
      if (tagFilteredPaperIds) {
        conditions.push(inArray(schema.papers.id, tagFilteredPaperIds))
      }

      let query = db.select().from(schema.papers)
      if (conditions.length > 0) {
        query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as typeof query
      }

      const sortColumn = schema.papers[sortBy]
      const allResults = query.orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)).all()
      const total = allResults.length
      const data = allResults.slice((page - 1) * pageSize, page * pageSize)

      // Parse JSON fields + attach the current user's tags (none for anonymous)
      const tagsByPaper = userTagsByPapers(db, data.map(p => p.id), request.user?.id ?? null)
      const parsed = data.map(p => ({ ...parsePaper(p), tags: tagsByPaper.get(p.id) ?? [] }))

      return {
        data: parsed,
        pagination: {
          page,
          page_size: pageSize,
          total,
          total_pages: Math.ceil(total / pageSize),
        },
      }
    }
  )

  // Get paper by id
  app.get<{ Params: { id: string } }>('/api/papers/:id', async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
    if (!paper) {
      reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${id} not found` } })
      return
    }

    // The current user's tags for this paper (none for anonymous)
    const tags = userTagsForPaper(db, id, request.user?.id ?? null)

    return {
      ...parsePaper(paper),
      tags,
    }
  })

  // Semantic Scholar citation graph: references (this paper cites) + citations (cite this paper)
  app.get<{ Params: { id: string }; Querystring: { direction?: string } }>(
    '/api/papers/:id/citations',
    async (request) => {
      const db = getDatabase()
      const paperId = parseInt(request.params.id, 10)
      const dir = request.query.direction
      let rows = db.select().from(schema.paperCitations).where(eq(schema.paperCitations.paper_id, paperId)).all()
      if (dir === 'reference' || dir === 'citation') rows = rows.filter((r) => r.direction === dir)
      const parse = (r: any) => ({
        ...r,
        authors: r.authors ? JSON.parse(r.authors) : [],
        contexts: r.contexts ? JSON.parse(r.contexts) : [],
        intents: r.intents ? JSON.parse(r.intents) : [],
        is_influential: !!r.is_influential,
      })
      const all = rows.map(parse)
      return {
        references: all.filter((r) => r.direction === 'reference'),
        citations: all.filter((r) => r.direction === 'citation'),
      }
    }
  )

  // Update paper
  app.patch<{ Params: { id: string }; Body: { title?: string; authors?: string[]; link?: string; content?: string } }>(
    '/api/papers/:id',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
      if (!paper) {
        reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${id} not found` } })
        return
      }

      const { title, authors, link, content } = request.body || {}
      const updates: Record<string, any> = {}

      // arXiv papers: reject title/authors changes
      if (paper.arxiv_id && (title !== undefined || authors !== undefined)) {
        reply.code(400).send({ error: { code: 'ARXIV_LOCKED', message: 'Cannot modify title or authors for arXiv papers' } })
        return
      }

      if (title !== undefined) updates.title = title
      if (authors !== undefined) updates.authors = JSON.stringify(Array.isArray(authors) ? authors : [authors])
      if (link !== undefined) updates.link = link || null

      // Handle content → contents.user_input
      if (content !== undefined) {
        const existing = paper.contents ? JSON.parse(paper.contents) : {}
        existing.user_input = content === '' ? null : content
        updates.contents = JSON.stringify(existing)
      }

      if (Object.keys(updates).length === 0) {
        return parsePaper(paper)
      }

      updates.updated_at = new Date().toISOString()
      db.update(schema.papers).set(updates).where(eq(schema.papers.id, id)).run()

      const updated = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
      return parsePaper(updated!)
    }
  )

  // Delete paper with cascade
  app.delete<{ Params: { id: string } }>('/api/papers/:id', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)
    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
    if (!paper) {
      reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${id} not found` } })
      return
    }

    // Cascade delete in a transaction using raw sqlite
    const sqlite = getSqliteDatabase()
    const tx = sqlite.transaction(() => {
      // 1. Delete qa_results via qa_entries
      const entryIds = db.select({ id: schema.qaEntries.id }).from(schema.qaEntries).where(eq(schema.qaEntries.paper_id, id)).all().map(e => e.id)
      if (entryIds.length > 0) {
        db.delete(schema.qaResults).where(inArray(schema.qaResults.qa_entry_id, entryIds)).run()
      }
      // 2. Delete qa_entries
      db.delete(schema.qaEntries).where(eq(schema.qaEntries.paper_id, id)).run()
      // 3. Delete service_executions
      db.delete(schema.serviceExecutions).where(eq(schema.serviceExecutions.paper_id, id)).run()
      // 3b. Delete S2 citation graph
      db.delete(schema.paperCitations).where(eq(schema.paperCitations.paper_id, id)).run()
      // 4. Delete paper_tags
      db.delete(schema.paperTags).where(eq(schema.paperTags.paper_id, id)).run()
      // 5. Delete highlights by pdf_path pattern
      if (paper.pdf_path) {
        db.delete(schema.highlights).where(like(schema.highlights.pathname, `%${paper.pdf_path}%`)).run()
      }
      // 6. Delete the paper
      db.delete(schema.papers).where(eq(schema.papers.id, id)).run()
    })
    tx()

    return { success: true, deleted_id: id }
  })

  // Create paper
  app.post<{ Body: { arxiv_id?: string; corpus_id?: string; title?: string; authors?: string[]; content?: string; link?: string; tags?: string[] } }>(
    '/api/papers',
    { preHandler: requireUser },
    async (request, reply) => {
      const { arxiv_id, corpus_id, title, authors, content, link, tags: tagNames } = request.body || {}
      const userId = request.user!.id

      if (!title && !arxiv_id && !corpus_id) {
        reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Must provide arxiv_id, corpus_id, or title' } })
        return
      }

      // Determine dedup key
      const dedupKey = arxiv_id
        ? getDedupKey('arxiv', arxiv_id)
        : corpus_id
          ? getDedupKey('corpus', corpus_id)
          : null

      const createFn = async () => {
        const db = getDatabase()

        // Check for existing paper
        if (arxiv_id) {
          const existing = db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, arxiv_id)).get()
          if (existing) {
            if (corpus_id && !existing.corpus_id) {
              db.update(schema.papers).set({ corpus_id }).where(eq(schema.papers.id, existing.id)).run()
            }
            return { ...parsePaper(existing), tags: userTagsForPaper(db, existing.id, userId), created: false }
          }
        }
        if (corpus_id) {
          const existing = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, corpus_id)).get()
          if (existing) {
            if (arxiv_id && !existing.arxiv_id) {
              db.update(schema.papers).set({ arxiv_id }).where(eq(schema.papers.id, existing.id)).run()
            }
            return { ...parsePaper(existing), tags: userTagsForPaper(db, existing.id, userId), created: false }
          }
        }

        const now = new Date().toISOString()
        const contents = content ? JSON.stringify({ user_input: content }) : null

        const paper = db.insert(schema.papers).values({
          arxiv_id: arxiv_id || null,
          corpus_id: corpus_id || null,
          title: title || 'Untitled',
          authors: JSON.stringify(authors || []),
          contents,
          link: link || null,
          created_at: now,
          updated_at: now,
        }).returning().get()

        // Handle tags (scoped to the creating user)
        if (tagNames && tagNames.length > 0) {
          for (const tagName of tagNames) {
            const tag = findOrCreateUserTag(db, userId, tagName)
            db.insert(schema.paperTags).values({ paper_id: paper.id, tag_id: tag.id }).run()
          }
        }

        // Trigger services in background (non-blocking)
        serviceRunner.triggerForPaper(paper.id).catch((err) => {
          console.error(`Failed to trigger services for paper ${paper.id}:`, err)
        })

        return { ...parsePaper(paper), tags: userTagsForPaper(db, paper.id, userId), created: true }
      }

      // Use dedup if we have an external ID
      if (dedupKey) {
        return await withDedup(dedupKey, createFn)
      }
      return await createFn()
    }
  )

  // GET /api/papers/:id/tags — the current user's tags for this paper (empty for anonymous)
  app.get<{ Params: { id: string } }>('/api/papers/:id/tags', async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)
    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${id} not found` } }); return }

    return userTagsForPaper(db, id, request.user?.id ?? null)
  })

  // PUT /api/papers/:id/tags — replace the current user's tags for this paper
  app.put<{ Params: { id: string }; Body: { tags: string[] } }>(
    '/api/papers/:id/tags',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${id} not found` } }); return }

      const { tags: tagNames } = request.body || {}

      // Only clear THIS user's associations; other users' tags on the paper are untouched.
      clearUserPaperTags(db, id, userId)

      for (const tagName of (tagNames || [])) {
        const tag = findOrCreateUserTag(db, userId, tagName)
        db.insert(schema.paperTags).values({ paper_id: id, tag_id: tag.id }).run()
      }

      return userTagsForPaper(db, id, userId)
    }
  )

  // PATCH /api/papers/:id/tags — add/remove the current user's tags on this paper
  app.patch<{ Params: { id: string }; Body: { add?: string[]; remove?: string[] } }>(
    '/api/papers/:id/tags',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${id} not found` } }); return }

      const { add, remove } = request.body || {}

      if (remove) {
        for (const tagName of remove) {
          const tag = findUserTagByName(db, userId, tagName)
          if (tag) {
            db.delete(schema.paperTags)
              .where(and(eq(schema.paperTags.paper_id, id), eq(schema.paperTags.tag_id, tag.id)))
              .run()
          }
        }
      }

      if (add) {
        for (const tagName of add) {
          const tag = findOrCreateUserTag(db, userId, tagName)
          try { db.insert(schema.paperTags).values({ paper_id: id, tag_id: tag.id }).run() } catch {}
        }
      }

      return userTagsForPaper(db, id, userId)
    }
  )
}

function parsePaper(raw: any) {
  return {
    ...raw,
    authors: typeof raw.authors === 'string' ? JSON.parse(raw.authors) : raw.authors,
    contents: raw.contents ? JSON.parse(raw.contents) : null,
    metadata: raw.metadata ? JSON.parse(raw.metadata) : null,
    tags: [], // per-user tags are attached by the route handler (papers.tags_json is deprecated)
  }
}

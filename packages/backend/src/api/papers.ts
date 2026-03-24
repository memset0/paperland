import type { FastifyInstance } from 'fastify'
import { eq, like, or, desc, asc, inArray } from 'drizzle-orm'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { withDedup, getDedupKey } from '../services/paper_dedup.js'
import { serviceRunner } from '../services/service_runner.js'

export async function paperRoutes(app: FastifyInstance): Promise<void> {
  // List papers with pagination and search
  app.get<{ Querystring: { page?: string; page_size?: string; search?: string; sort_by?: string; sort_order?: string } }>(
    '/api/papers',
    async (request) => {
      const db = getDatabase()
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = parseInt(request.query.page_size || '20', 10)
      const search = request.query.search

      const allowedSortBy = ['created_at', 'updated_at'] as const
      const sortBy = allowedSortBy.includes(request.query.sort_by as any) ? (request.query.sort_by as 'created_at' | 'updated_at') : 'created_at'
      const sortOrder = request.query.sort_order === 'asc' ? 'asc' : 'desc'

      let query = db.select().from(schema.papers)

      if (search) {
        query = query.where(
          or(
            like(schema.papers.title, `%${search}%`),
            like(schema.papers.abstract, `%${search}%`)
          )
        ) as typeof query
      }

      const sortColumn = schema.papers[sortBy]
      const allResults = query.orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)).all()
      const total = allResults.length
      const data = allResults.slice((page - 1) * pageSize, page * pageSize)

      // Parse JSON fields
      const parsed = data.map(parsePaper)

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

    // Get tags
    const paperTagRows = db.select().from(schema.paperTags).where(eq(schema.paperTags.paper_id, id)).all()
    const tagIds = paperTagRows.map(pt => pt.tag_id)
    const tagList = tagIds.length > 0
      ? db.select().from(schema.tags).all().filter(t => tagIds.includes(t.id))
      : []

    return {
      ...parsePaper(paper),
      tags: tagList.map(t => t.name),
    }
  })

  // Update paper
  app.patch<{ Params: { id: string }; Body: { title?: string; authors?: string[]; link?: string; content?: string } }>(
    '/api/papers/:id',
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
  app.delete<{ Params: { id: string } }>('/api/papers/:id', async (request, reply) => {
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
    async (request, reply) => {
      const { arxiv_id, corpus_id, title, authors, content, link, tags: tagNames } = request.body || {}

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
            return { ...parsePaper(existing), created: false }
          }
        }
        if (corpus_id) {
          const existing = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, corpus_id)).get()
          if (existing) {
            if (arxiv_id && !existing.arxiv_id) {
              db.update(schema.papers).set({ arxiv_id }).where(eq(schema.papers.id, existing.id)).run()
            }
            return { ...parsePaper(existing), created: false }
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

        // Handle tags
        if (tagNames && tagNames.length > 0) {
          for (const tagName of tagNames) {
            let tag = db.select().from(schema.tags).where(eq(schema.tags.name, tagName)).get()
            if (!tag) {
              tag = db.insert(schema.tags).values({ name: tagName }).returning().get()
            }
            db.insert(schema.paperTags).values({ paper_id: paper.id, tag_id: tag.id }).run()
          }
        }

        // Trigger services in background (non-blocking)
        serviceRunner.triggerForPaper(paper.id).catch((err) => {
          console.error(`Failed to trigger services for paper ${paper.id}:`, err)
        })

        return { ...parsePaper(paper), created: true }
      }

      // Use dedup if we have an external ID
      if (dedupKey) {
        return await withDedup(dedupKey, createFn)
      }
      return await createFn()
    }
  )
}

function parsePaper(raw: any) {
  return {
    ...raw,
    authors: typeof raw.authors === 'string' ? JSON.parse(raw.authors) : raw.authors,
    contents: raw.contents ? JSON.parse(raw.contents) : null,
    metadata: raw.metadata ? JSON.parse(raw.metadata) : null,
  }
}

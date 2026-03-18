import type { FastifyInstance } from 'fastify'
import { eq, like, or, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

export async function paperRoutes(app: FastifyInstance): Promise<void> {
  // List papers with pagination and search
  app.get<{ Querystring: { page?: string; page_size?: string; search?: string } }>(
    '/api/papers',
    async (request) => {
      const db = getDatabase()
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = parseInt(request.query.page_size || '20', 10)
      const search = request.query.search

      let query = db.select().from(schema.papers)

      if (search) {
        query = query.where(
          or(
            like(schema.papers.title, `%${search}%`),
            like(schema.papers.abstract, `%${search}%`)
          )
        ) as typeof query
      }

      const allResults = query.orderBy(desc(schema.papers.created_at)).all()
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

  // Create paper
  app.post<{ Body: { arxiv_id?: string; corpus_id?: string; title?: string; authors?: string[]; content?: string; tags?: string[] } }>(
    '/api/papers',
    async (request, reply) => {
      const db = getDatabase()
      const { arxiv_id, corpus_id, title, authors, content, tags: tagNames } = request.body || {}

      // Check for existing paper
      if (arxiv_id) {
        const existing = db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, arxiv_id)).get()
        if (existing) {
          return { ...parsePaper(existing), created: false }
        }
      }
      if (corpus_id) {
        const existing = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, corpus_id)).get()
        if (existing) {
          // Supplement missing id
          if (arxiv_id && !existing.arxiv_id) {
            db.update(schema.papers).set({ arxiv_id }).where(eq(schema.papers.id, existing.id)).run()
          }
          return { ...parsePaper(existing), created: false }
        }
      }

      if (!title && !arxiv_id && !corpus_id) {
        reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Must provide arxiv_id, corpus_id, or title' } })
        return
      }

      const now = new Date().toISOString()
      const contents = content ? JSON.stringify({ user_input: content }) : null

      const paper = db.insert(schema.papers).values({
        arxiv_id: arxiv_id || null,
        corpus_id: corpus_id || null,
        title: title || 'Untitled',
        authors: JSON.stringify(authors || []),
        contents,
        created_at: now,
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

      return { ...parsePaper(paper), created: true }
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

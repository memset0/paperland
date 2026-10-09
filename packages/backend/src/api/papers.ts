import type { FastifyInstance } from 'fastify'
import { eq, like, or, desc, asc, inArray, sql, and, isNull, getTableColumns } from 'drizzle-orm'
import { createHash } from 'crypto'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { matchLibraryPapers } from '../services/qa_formatter.js'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { ingestPaper } from '../services/ingest_paper.js'
import { addToLibrary, removeFromLibrary, libraryIds } from '../services/user_library.js'
import { serviceRunner } from '../services/service_runner.js'
import { removeDoc2xArtifacts } from '../services/doc2x_cli.js'
import { requireUser } from '../auth/guards.js'
import { verifyOpenToken } from '../auth/open_token.js'
import { normalizeArxivId } from '../utils/arxiv_id.js'
import { userTagsByPapers, userTagsForPaper, findOrCreateUserTag, findUserTagByName, clearUserPaperTags } from '../utils/user-tags.js'
import { normalizeS2Ids, S2IdError } from '../utils/s2_ids.js'
import { derivePdfStatus } from '../utils/pdf_status.js'
import { getConfig } from '../config.js'

/** `pdf_upload.max_file_size_mb`; falls back to the schema default when config isn't loaded (route-only unit tests). */
function pdfUploadMaxMb(): number {
  try { return getConfig().pdf_upload.max_file_size_mb } catch { return 100 }
}

export async function paperRoutes(app: FastifyInstance): Promise<void> {
  // List papers with pagination and search
  app.get<{ Querystring: { page?: string; page_size?: string; search?: string; sort_by?: string; sort_order?: string; tag_ids?: string; listed?: string; scope?: string } }>(
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

      // Visibility mode: 'listed' (default) | 'unlisted' | 'all'
      const listedMode = request.query.listed === 'all' ? 'all' : request.query.listed === 'unlisted' ? 'unlisted' : 'listed'
      if (listedMode === 'listed') conditions.push(eq(schema.papers.listed, 1))
      else if (listedMode === 'unlisted') conditions.push(eq(schema.papers.listed, 0))

      // Scope: 'mine' (default for logged-in users) = the caller's personal library; 'all' = site-wide.
      // Anonymous callers have no library and always get 'all'.
      const userId = request.user?.id ?? null
      if (userId != null && request.query.scope !== 'all') {
        conditions.push(inArray(
          schema.papers.id,
          db.select({ id: schema.userPapers.paper_id }).from(schema.userPapers)
            .where(and(eq(schema.userPapers.user_id, userId), eq(schema.userPapers.in_library, 1))),
        ))
      }

      // Paginate in SQL and never read the full text (`contents`): the list doesn't render it,
      // and it is ~165 KB per paper.
      const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)
      const total = db.select({ n: sql<number>`count(*)` }).from(schema.papers).where(where).get()?.n ?? 0
      const { contents: _contents, ...listColumns } = getTableColumns(schema.papers)
      const order = sortOrder === 'desc' ? desc : asc
      const data = db.select(listColumns).from(schema.papers).where(where)
        .orderBy(order(schema.papers[sortBy]), order(schema.papers.id))
        .limit(pageSize).offset((page - 1) * pageSize)
        .all()

      // Parse JSON fields + attach the current user's tags (none for anonymous)
      const tagsByPaper = userTagsByPapers(db, data.map(p => p.id), request.user?.id ?? null)
      const inLibrary = libraryIds(userId, data.map(p => p.id))
      const parsed = data.map(p => ({
        ...p,
        authors: JSON.parse(p.authors),
        metadata: slimListMetadata(p.metadata),
        listed: !!p.listed,
        tags: tagsByPaper.get(p.id) ?? [],
        in_library: inLibrary.has(p.id),
      }))

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

    // PDF availability for the viewer (available / fetching / upload_required + reason).
    const executions = db.select({
      id: schema.serviceExecutions.id,
      service_name: schema.serviceExecutions.service_name,
      status: schema.serviceExecutions.status,
      created_at: schema.serviceExecutions.created_at,
    }).from(schema.serviceExecutions).where(eq(schema.serviceExecutions.paper_id, id)).all()

    return {
      ...parsePaper(paper),
      tags,
      in_library: libraryIds(request.user?.id ?? null, [id]).has(id),
      ...derivePdfStatus(paper, executions),
    }
  })

  // PUT / DELETE /api/papers/:id/library — add the paper to / remove it from the caller's
  // personal library. Idempotent; removing keeps the paper and all the user's data on it.
  for (const method of ['put', 'delete'] as const) {
    app[method]<{ Params: { id: string } }>('/api/papers/:id/library', { preHandler: requireUser }, async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      const paper = getDatabase().select({ id: schema.papers.id }).from(schema.papers).where(eq(schema.papers.id, id)).get()
      if (!paper) {
        return reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${request.params.id} not found` } })
      }
      if (method === 'put') addToLibrary(request.user!.id, id)
      else removeFromLibrary(request.user!.id, id)
      return { paper_id: id, in_library: method === 'put' }
    })
  }

  // POST /api/papers/:id/pdf — user upload for papers without an obtainable PDF (closed
  // access / failed download). Raw `application/pdf` body; the parser is scoped to this
  // route so the rest of the API keeps JSON-only parsing and the default body limit.
  const maxPdfBytes = pdfUploadMaxMb() * 1024 * 1024
  await app.register(async (scoped) => {
    scoped.addContentTypeParser('application/pdf', { parseAs: 'buffer', bodyLimit: maxPdfBytes }, (_req, body, done) => done(null, body))
    scoped.post<{ Params: { id: string }; Body: Buffer }>(
      '/api/papers/:id/pdf',
      { preHandler: requireUser, bodyLimit: maxPdfBytes },
      async (request, reply) => {
        const db = getDatabase()
        const id = parseInt(request.params.id, 10)
        const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
        if (!paper) return reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${id} not found` } })
        if (paper.pdf_path) return reply.code(409).send({ error: { code: 'PDF_EXISTS', message: '该论文已有 PDF' } })

        const body = request.body
        if (!Buffer.isBuffer(body) || body.length < 4 || body.subarray(0, 4).toString('latin1') !== '%PDF') {
          return reply.code(422).send({ error: { code: 'INVALID_PDF', message: '上传的文件不是 PDF' } })
        }

        // Content-hashed name: /api/files is cached for 24h, so a name is never reused for new bytes.
        const hash = createHash('sha256').update(body).digest('hex').slice(0, 8)
        const filename = `upload_${id}_${hash}.pdf`
        const pdfDir = resolve(process.cwd(), 'data/pdfs')
        mkdirSync(pdfDir, { recursive: true })
        const absPath = resolve(pdfDir, filename)
        writeFileSync(absPath, body)

        // Conditional write guards against a concurrent upload / service download.
        const changed = db.update(schema.papers).set({ pdf_path: `data/pdfs/${filename}` })
          .where(and(eq(schema.papers.id, id), isNull(schema.papers.pdf_path))).run().changes
        if (changed === 0) {
          rmSync(absPath, { force: true })
          return reply.code(409).send({ error: { code: 'PDF_EXISTS', message: '该论文已有 PDF' } })
        }

        // pdf_path now exists → pdf_parse / doc2x get scheduled; PDF download services are skipped.
        serviceRunner.triggerForPaper(id).catch((err) => {
          console.error(`Failed to trigger services after PDF upload for paper ${id}:`, err)
        })
        const updated = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()!
        return { ...parsePaper(updated), tags: userTagsForPaper(db, id, request.user!.id), ...derivePdfStatus(updated, []) }
      },
    )
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
      const library = matchLibraryPapers(db, rows)
      const all = rows.map((row) => ({ ...parse(row), library_paper_id: library.get(row.id) ?? null }))
      return {
        references: all.filter((r) => r.direction === 'reference'),
        citations: all.filter((r) => r.direction === 'citation'),
      }
    }
  )

  // Update paper
  app.patch<{ Params: { id: string }; Body: { title?: string; authors?: string[]; link?: string; content?: string; listed?: boolean } }>(
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

      const { title, authors, link, content, listed } = request.body || {}
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

      // Promote/demote visibility (加入列表 = listed:true)
      if (listed !== undefined) updates.listed = listed ? 1 : 0

      if (Object.keys(updates).length === 0) {
        return parsePaper(paper)
      }

      updates.updated_at = new Date().toISOString()
      db.update(schema.papers).set(updates).where(eq(schema.papers.id, id)).run()

      // Promotion to listed → run the previously-deferred full pipeline
      if (listed === true && paper.listed === 0) {
        serviceRunner.triggerForPaper(id).catch(() => {})
      }

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
        const resultIds = db.select({ id: schema.qaResults.id }).from(schema.qaResults)
          .where(inArray(schema.qaResults.qa_entry_id, entryIds)).all().map((result) => result.id)
        if (resultIds.length > 0) {
          db.update(schema.highlights).set({ qa_result_id: null })
            .where(inArray(schema.highlights.qa_result_id, resultIds)).run()
        }
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
      // 4a. Delete per-user library rows
      db.delete(schema.userPapers).where(eq(schema.userPapers.paper_id, id)).run()
      // 4b. Delete per-user reference links
      db.delete(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.paper_id, id)).run()
      // 5. Delete highlights by pdf_path pattern
      if (paper.pdf_path) {
        db.delete(schema.highlights).where(like(schema.highlights.pathname, `%${paper.pdf_path}%`)).run()
      }
      // 6. Delete the paper
      db.delete(schema.papers).where(eq(schema.papers.id, id)).run()
    })
    tx()
    removeDoc2xArtifacts(id)

    return { success: true, deleted_id: id }
  })

  // Create paper
  app.post<{ Body: { arxiv_id?: string; corpus_id?: string; s2_paper_id?: string; title?: string; authors?: string[]; content?: string; link?: string; tags?: string[] } }>(
    '/api/papers',
    { preHandler: requireUser },
    async (request, reply) => {
      const { arxiv_id, title, authors, content, link, tags: tagNames } = request.body || {}
      const userId = request.user!.id

      // corpus_id / s2_paper_id accept ids, `CorpusId:<n>`, or semanticscholar.org URLs.
      let s2Ids
      try {
        s2Ids = normalizeS2Ids(request.body || {})
      } catch (e) {
        if (e instanceof S2IdError) {
          reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: e.message } })
          return
        }
        throw e
      }
      const { corpus_id, s2_paper_id } = s2Ids

      if (!title && !arxiv_id && !corpus_id && !s2_paper_id) {
        reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Must provide arxiv_id, corpus_id, s2_paper_id, or title' } })
        return
      }

      const { paper, created } = await ingestPaper({ arxiv_id, corpus_id, s2_paper_id, title, authors, link, content })
      // Adding a paper (new or already in the site-wide list) puts it in the caller's library.
      addToLibrary(userId, paper.id)

      // Attach per-user tags only when this call actually created the paper —
      // matching the pre-refactor behavior, which only ran tag insertion in the
      // freshly-inserted branch.
      const db = getDatabase()
      if (created && tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          const tag = findOrCreateUserTag(db, userId, tagName)
          db.insert(schema.paperTags).values({ paper_id: paper.id, tag_id: tag.id }).run()
        }
      }

      return { ...parsePaper(paper), tags: userTagsForPaper(db, paper.id, userId), created, in_library: true }
    }
  )

  // POST /api/papers/open-arxiv — backs the `/open/arxiv/:id?token=…` quick-open link
  // (browser extension). Requires a session AND the user's quick-open CSRF token, then
  // finds or creates the paper for the (normalized) arxiv id.
  app.post<{ Body: { arxiv_id?: string; token?: string } }>(
    '/api/papers/open-arxiv',
    { preHandler: requireUser },
    async (request, reply) => {
      const { arxiv_id: rawId, token } = request.body || {}
      if (!verifyOpenToken(request.user!.id, token)) {
        return reply.code(403).send({ error: { code: 'INVALID_OPEN_TOKEN', message: 'Invalid quick-open token. Copy the current token from Account settings into the extension.' } })
      }
      const arxiv_id = normalizeArxivId(rawId)
      if (!arxiv_id) {
        return reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: `Invalid arxiv id: ${rawId ?? ''}` } })
      }
      const { paper, created } = await ingestPaper({ arxiv_id })
      addToLibrary(request.user!.id, paper.id)
      return { paper_id: paper.id, arxiv_id, created }
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

/** The list only renders these metadata values; the full metadata (reference lists etc.) stays on the detail. */
function slimListMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  let m: any
  try { m = JSON.parse(raw) } catch { return null }
  if (!m || typeof m !== 'object') return null
  const slim: Record<string, unknown> = {}
  if (m.citation_count != null) slim.citation_count = m.citation_count
  const refCount = m.reference_count ?? (Array.isArray(m.references) ? m.references.length : undefined)
  if (refCount != null) slim.reference_count = refCount
  if (m.s2_url != null) slim.s2_url = m.s2_url
  return slim
}

function parsePaper(raw: any) {
  return {
    ...raw,
    authors: typeof raw.authors === 'string' ? JSON.parse(raw.authors) : raw.authors,
    contents: raw.contents ? JSON.parse(raw.contents) : null,
    metadata: raw.metadata ? JSON.parse(raw.metadata) : null,
    listed: !!raw.listed,
    tags: [], // per-user tags are attached by the route handler (papers.tags_json is deprecated)
  }
}

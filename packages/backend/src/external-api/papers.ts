import type { FastifyInstance } from 'fastify'
import { eq, and, desc, like, inArray } from 'drizzle-orm'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { withDedup, getDedupKey } from '../services/paper_dedup.js'
import { serviceRunner } from '../services/service_runner.js'
import { resolveContent } from '../services/qa_service.js'
import { loadTemplates } from '../services/template_loader.js'
import { getConfig } from '../config.js'
import { findOrCreateUserTag, userTagsForPaper } from '../utils/user-tags.js'
import { canList, openreviewLinkCount } from '../utils/listing.js'
import { runQA } from '../api/qa.js'

async function waitForQARuns(resultIds: number[], timeoutMs = 30 * 60 * 1000): Promise<void> {
  if (resultIds.length === 0) return
  const db = getDatabase()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const active = db.select({ id: schema.qaResults.id }).from(schema.qaResults)
      .where(and(
        inArray(schema.qaResults.id, resultIds),
        inArray(schema.qaResults.status, ['queued', 'awaiting_output', 'streaming']),
      ))
      .all()
    if (active.length === 0) return
    await Bun.sleep(100)
  }
  throw new Error('Timed out waiting for template QA runs')
}

function parsePaper(raw: any) {
  return {
    ...raw,
    authors: typeof raw.authors === 'string' ? JSON.parse(raw.authors) : raw.authors,
    contents: raw.contents ? (typeof raw.contents === 'string' ? JSON.parse(raw.contents) : raw.contents) : null,
    metadata: raw.metadata ? (typeof raw.metadata === 'string' ? JSON.parse(raw.metadata) : raw.metadata) : null,
  }
}

export function serializeExternalQAResult(result: typeof schema.qaResults.$inferSelect) {
  return {
    id: result.id,
    qa_entry_id: result.qa_entry_id,
    prompt: result.prompt,
    answer: result.answer,
    model_name: result.model_name,
    completed_at: result.completed_at,
    execution_id: result.execution_id,
    content_hash: result.content_hash,
  }
}

// The token user's tags for a paper (External API acts as the token's owning user).
function getTags(db: any, paperId: number, userId: number | null): string[] {
  return userTagsForPaper(db, paperId, userId).map((t) => t.name)
}

export async function externalPaperRoutes(app: FastifyInstance): Promise<void> {
  // Create paper
  app.post<{ Body: { arxiv_id?: string; corpus_id?: string; title?: string; authors?: string[]; link?: string; tags?: string[] } }>(
    '/external-api/v1/papers',
    async (request, reply) => {
      const db = getDatabase()
      const { arxiv_id, corpus_id, title, authors, link, tags: tagNames } = request.body || {}

      if (!arxiv_id && !corpus_id && !title) {
        reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Must provide arxiv_id, corpus_id, or title' } })
        return
      }

      const dedupKey = arxiv_id ? getDedupKey('arxiv', arxiv_id) : corpus_id ? getDedupKey('corpus', corpus_id) : null

      const createFn = async () => {
        if (arxiv_id) {
          const existing = db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, arxiv_id)).get()
          if (existing) {
            if (corpus_id && !existing.corpus_id) db.update(schema.papers).set({ corpus_id }).where(eq(schema.papers.id, existing.id)).run()
            return { ...parsePaper(existing), tags: getTags(db, existing.id, request.user?.id ?? null), created: false }
          }
        }
        if (corpus_id) {
          const existing = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, corpus_id)).get()
          if (existing) {
            if (arxiv_id && !existing.arxiv_id) db.update(schema.papers).set({ arxiv_id }).where(eq(schema.papers.id, existing.id)).run()
            return { ...parsePaper(existing), tags: getTags(db, existing.id, request.user?.id ?? null), created: false }
          }
        }

        const now = new Date().toISOString()
        const paper = db.insert(schema.papers).values({
          arxiv_id: arxiv_id || null, corpus_id: corpus_id || null,
          title: title || 'Untitled', authors: JSON.stringify(authors || []), link: link || null, created_at: now, updated_at: now,
        }).returning().get()

        const userId = request.user?.id ?? null
        if (userId != null && tagNames && tagNames.length > 0) {
          for (const tagName of tagNames) {
            const tag = findOrCreateUserTag(db, userId, tagName)
            db.insert(schema.paperTags).values({ paper_id: paper.id, tag_id: tag.id }).run()
          }
        }

        serviceRunner.triggerForPaper(paper.id).catch(() => {})
        return { ...parsePaper(paper), tags: tagNames || [], created: true }
      }

      return dedupKey ? await withDedup(dedupKey, createFn) : await createFn()
    }
  )

  // Update paper
  app.patch<{ Params: { id: string }; Body: { title?: string; authors?: string[]; link?: string; content?: string; listed?: boolean } }>(
    '/external-api/v1/papers/:id',
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

      const { title, authors, link, content, listed } = request.body || {}
      const updates: Record<string, any> = {}

      if (paper.arxiv_id && (title !== undefined || authors !== undefined)) {
        reply.code(400).send({ error: { code: 'ARXIV_LOCKED', message: 'Cannot modify title or authors for arXiv papers' } })
        return
      }

      if (title !== undefined) updates.title = title
      if (authors !== undefined) updates.authors = JSON.stringify(Array.isArray(authors) ? authors : [authors])
      if (link !== undefined) updates.link = link || null

      if (content !== undefined) {
        const existing = paper.contents ? (typeof paper.contents === 'string' ? JSON.parse(paper.contents) : paper.contents) : {}
        existing.user_input = content === '' ? null : content
        updates.contents = JSON.stringify(existing)
      }

      // Promote/demote visibility, mirroring the internal API.
      if (listed !== undefined) updates.listed = listed ? 1 : 0

      // Listing eligibility: an OpenReview-only paper cannot be promoted to listed=true (demotion always allowed).
      if (listed === true) {
        const effective = {
          arxiv_id: paper.arxiv_id,
          corpus_id: paper.corpus_id,
          link: link !== undefined ? (link || null) : paper.link,
        }
        if (!canList(effective, openreviewLinkCount(db, id))) {
          reply.code(422).send({ error: { code: 'LISTING_NOT_ALLOWED', message: '该论文仅有 OpenReview 链接、缺少 arXiv / Semantic Scholar 来源，无法加入列表' } })
          return
        }
      }

      if (Object.keys(updates).length === 0) {
        return { ...parsePaper(paper), tags: getTags(db, paper.id, request.user?.id ?? null) }
      }

      updates.updated_at = new Date().toISOString()
      db.update(schema.papers).set(updates).where(eq(schema.papers.id, id)).run()

      // Promotion to listed → run the previously-deferred full pipeline.
      if (listed === true && paper.listed === 0) {
        serviceRunner.triggerForPaper(id).catch(() => {})
      }

      const updated = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
      return { ...parsePaper(updated!), tags: getTags(db, id, request.user?.id ?? null) }
    }
  )

  // Delete paper with cascade
  app.delete<{ Params: { id: string } }>('/external-api/v1/papers/:id', async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)
    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

    const sqlite = getSqliteDatabase()
    const tx = sqlite.transaction(() => {
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
      db.delete(schema.qaEntries).where(eq(schema.qaEntries.paper_id, id)).run()
      db.delete(schema.serviceExecutions).where(eq(schema.serviceExecutions.paper_id, id)).run()
      db.delete(schema.paperCitations).where(eq(schema.paperCitations.paper_id, id)).run()
      db.delete(schema.paperTags).where(eq(schema.paperTags.paper_id, id)).run()
      if (paper.pdf_path) {
        db.delete(schema.highlights).where(like(schema.highlights.pathname, `%${paper.pdf_path}%`)).run()
      }
      db.delete(schema.papers).where(eq(schema.papers.id, id)).run()
    })
    tx()

    return { success: true, deleted_id: id }
  })

  // Get paper by id
  app.get<{ Params: { id: string } }>('/external-api/v1/papers/:id', async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)
    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }
    return { ...parsePaper(paper), tags: getTags(db, paper.id, request.user?.id ?? null) }
  })

  // Search paper by external ID
  app.get<{ Querystring: { arxiv_id?: string; corpus_id?: string } }>('/external-api/v1/papers', async (request, reply) => {
    const db = getDatabase()
    const { arxiv_id, corpus_id } = request.query
    let paper = null
    if (arxiv_id) paper = db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, arxiv_id)).get()
    else if (corpus_id) paper = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, corpus_id)).get()
    else { reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Provide arxiv_id or corpus_id' } }); return }

    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }
    return { paper: { ...parsePaper(paper), tags: getTags(db, paper.id, request.user?.id ?? null) } }
  })

  // Full paper info
  app.get<{ Querystring: { id?: string; arxiv_id?: string; corpus_id?: string; auto_create?: string; auto_template_qa?: string; exclude?: string } }>(
    '/external-api/v1/papers/full',
    async (request, reply) => {
      const db = getDatabase()
      const { id, arxiv_id, corpus_id, auto_create, auto_template_qa, exclude } = request.query
      const excludeFields = (exclude || '').split(',').filter(Boolean)

      // Find paper
      let paper = null
      if (id) paper = db.select().from(schema.papers).where(eq(schema.papers.id, parseInt(id, 10))).get()
      else if (arxiv_id) paper = db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, arxiv_id)).get()
      else if (corpus_id) paper = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, corpus_id)).get()
      else { reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Provide id, arxiv_id, or corpus_id' } }); return }

      // Auto-create if not found
      if (!paper && auto_create === 'true' && (arxiv_id || corpus_id)) {
        const now = new Date().toISOString()
        paper = db.insert(schema.papers).values({
          arxiv_id: arxiv_id || null, corpus_id: corpus_id || null,
          title: 'Untitled', authors: '[]', created_at: now, updated_at: now,
        }).returning().get()

        // Wait for services to complete
        await serviceRunner.triggerForPaper(paper.id)
        // Wait a bit for services to finish
        await new Promise((r) => setTimeout(r, 15000))
        paper = db.select().from(schema.papers).where(eq(schema.papers.id, paper.id)).get()
      }

      if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

      // Auto template QA
      if (auto_template_qa === 'true') {
        const content = resolveContent(paper)
        if (content) {
          const config = getConfig()
          const templates = loadTemplates()
          const scheduledResultIds: number[] = []
          for (const tmpl of templates) {
            const existing = db.select().from(schema.qaEntries)
              .where(eq(schema.qaEntries.paper_id, paper.id))
              .all()
              .find((e) => e.type === 'template' && e.template_name === tmpl.name)
            if (existing) {
              const completed = db.select({ id: schema.qaResults.id }).from(schema.qaResults)
                .where(and(eq(schema.qaResults.qa_entry_id, existing.id), eq(schema.qaResults.status, 'done')))
                .get()
              if (completed) continue
            }
            let entryId: number
            if (existing) { entryId = existing.id } else {
              const entry = db.insert(schema.qaEntries).values({
                paper_id: paper.id, type: 'template', template_name: tmpl.name,
                prompt: tmpl.prompt, created_at: new Date().toISOString(),
              }).returning().get()
              entryId = entry.id
            }
            try {
              const run = await runQA(entryId, paper.id, tmpl.prompt, config.models.default, {
                requestedByUserId: request.user?.id ?? null,
              })
              scheduledResultIds.push(run.result_id)
            } catch (err: any) { console.error(`Auto template QA failed for ${tmpl.name}:`, err.message) }
          }
          try {
            await waitForQARuns(scheduledResultIds)
          } catch (err: any) {
            console.error('Auto template QA wait failed:', err.message)
          }
        }
      }

      // Build response
      const parsed = parsePaper(paper)
      const result: any = { paper: { ...parsed, tags: getTags(db, paper.id, request.user?.id ?? null) } }

      if (excludeFields.includes('contents')) delete result.paper.contents
      if (excludeFields.includes('metadata')) delete result.paper.metadata

      if (!excludeFields.includes('qa')) {
        const entries = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.paper_id, paper.id)).all()
        const templateQA: Record<string, any> = {}
        const freeQA: any[] = []
        for (const entry of entries) {
          const results = db.select().from(schema.qaResults)
            .where(and(eq(schema.qaResults.qa_entry_id, entry.id), eq(schema.qaResults.status, 'done')))
            .orderBy(desc(schema.qaResults.completed_at)).all()
            .map(serializeExternalQAResult)
          if (entry.type === 'template' && entry.template_name) {
            templateQA[entry.template_name] = { entry_id: entry.id, results }
          } else {
            freeQA.push({ entry_id: entry.id, results })
          }
        }
        result.qa = { template: templateQA, free: freeQA }
      }

      if (!excludeFields.includes('services')) {
        result.services = db.select().from(schema.serviceExecutions)
          .where(eq(schema.serviceExecutions.paper_id, paper.id))
          .orderBy(desc(schema.serviceExecutions.created_at))
          .all()
      }

      return result
    }
  )

  // Batch create papers
  app.post<{ Body: { papers: Array<{ arxiv_id?: string; corpus_id?: string; link?: string; tags?: string[] }> } }>(
    '/external-api/v1/papers/batch',
    async (request) => {
      const { papers: paperDefs } = request.body || { papers: [] }
      const results = []
      for (const def of paperDefs) {
        const db = getDatabase()
        const dedupKey = def.arxiv_id ? getDedupKey('arxiv', def.arxiv_id) : def.corpus_id ? getDedupKey('corpus', def.corpus_id) : null

        const createFn = async () => {
          if (def.arxiv_id) {
            const existing = db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, def.arxiv_id)).get()
            if (existing) return { id: existing.id, arxiv_id: existing.arxiv_id, created: false }
          }
          if (def.corpus_id) {
            const existing = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, def.corpus_id)).get()
            if (existing) return { id: existing.id, corpus_id: existing.corpus_id, created: false }
          }
          const now = new Date().toISOString()
          const paper = db.insert(schema.papers).values({
            arxiv_id: def.arxiv_id || null, corpus_id: def.corpus_id || null,
            title: 'Untitled', authors: '[]', link: def.link || null, created_at: now, updated_at: now,
          }).returning().get()

          const userId = request.user?.id ?? null
          if (userId != null && def.tags) {
            for (const tagName of def.tags) {
              const tag = findOrCreateUserTag(db, userId, tagName)
              db.insert(schema.paperTags).values({ paper_id: paper.id, tag_id: tag.id }).run()
            }
          }

          serviceRunner.triggerForPaper(paper.id).catch(() => {})
          return { id: paper.id, arxiv_id: paper.arxiv_id, corpus_id: paper.corpus_id, created: true }
        }

        results.push(dedupKey ? await withDedup(dedupKey, createFn) : await createFn())
      }
      return { results }
    }
  )
}

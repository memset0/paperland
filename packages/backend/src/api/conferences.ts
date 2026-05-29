import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, inArray, like, sql } from 'drizzle-orm'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'
import { ingestPaper } from '../services/ingest_paper.js'
import { matchPaperByTitle } from '../services/semantic_scholar_service.js'
import { serviceRunner } from '../services/service_runner.js'

type Source = 'arxiv' | 'openreview' | 'semantic_scholar' | null
type Status = 'pending' | 'candidate' | 'ingested'

const VALID_SOURCES = new Set<string>(['arxiv', 'openreview', 'semantic_scholar'])
const VALID_STATUSES = new Set<string>(['pending', 'candidate', 'ingested'])

function parseConferencePaper(raw: any) {
  return {
    ...raw,
    authors: raw.authors ? JSON.parse(raw.authors) : [],
    metadata: raw.metadata ? JSON.parse(raw.metadata) : null,
  }
}

function normalizeSource(s: unknown): Source {
  if (typeof s === 'string' && VALID_SOURCES.has(s)) return s as Source
  return null
}

function normalizeStatus(s: unknown): Status | null {
  if (typeof s === 'string' && VALID_STATUSES.has(s)) return s as Status
  return null
}

export async function conferenceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/conferences — list + search/year filter + pagination, with aggregate counts
  app.get<{ Querystring: { search?: string; year?: string; page?: string; page_size?: string } }>(
    '/api/conferences',
    async (request) => {
      const db = getDatabase()
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = parseInt(request.query.page_size || '20', 10)
      const search = request.query.search?.trim()
      const yearParam = request.query.year?.trim()
      const year = yearParam ? parseInt(yearParam, 10) : null

      const conditions = []
      if (search) conditions.push(like(schema.conferences.name, `%${search}%`))
      if (year !== null && !isNaN(year)) conditions.push(eq(schema.conferences.year, year))

      let query = db.select().from(schema.conferences)
      if (conditions.length > 0) {
        query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as typeof query
      }
      const all = query.orderBy(desc(schema.conferences.year), asc(schema.conferences.name)).all()
      const total = all.length
      const slice = all.slice((page - 1) * pageSize, page * pageSize)

      // One round trip for per-conference status counts.
      const confIds = slice.map((c) => c.id)
      const countMap = new Map<number, { pending: number; candidate: number; ingested: number; total: number }>()
      if (confIds.length > 0) {
        const rows = db.select({
          conference_id: schema.conferencePapers.conference_id,
          status: schema.conferencePapers.status,
          cnt: sql<number>`count(*)`.as('cnt'),
        })
          .from(schema.conferencePapers)
          .where(inArray(schema.conferencePapers.conference_id, confIds))
          .groupBy(schema.conferencePapers.conference_id, schema.conferencePapers.status)
          .all()
        for (const r of rows) {
          const existing = countMap.get(r.conference_id) || { pending: 0, candidate: 0, ingested: 0, total: 0 }
          if (r.status === 'pending' || r.status === 'candidate' || r.status === 'ingested') {
            existing[r.status] = r.cnt
          }
          existing.total += r.cnt
          countMap.set(r.conference_id, existing)
        }
      }

      const data = slice.map((c) => {
        const counts = countMap.get(c.id) || { pending: 0, candidate: 0, ingested: 0, total: 0 }
        return {
          ...c,
          paper_count: counts.total,
          status_counts: { pending: counts.pending, candidate: counts.candidate, ingested: counts.ingested },
        }
      })

      return {
        data,
        pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) || 1 },
      }
    }
  )

  // POST /api/conferences — create
  app.post<{ Body: { name?: string; year?: number | null; start_date?: string | null; end_date?: string | null; location?: string | null; description?: string | null; link?: string | null } }>(
    '/api/conferences',
    { preHandler: requireUser },
    async (request, reply) => {
      const { name, year, start_date, end_date, location, description, link } = request.body || {}
      if (!name || !name.trim()) {
        reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } })
        return
      }
      const db = getDatabase()
      const now = new Date().toISOString()
      const conf = db.insert(schema.conferences).values({
        name: name.trim(),
        year: typeof year === 'number' ? year : null,
        start_date: start_date || null,
        end_date: end_date || null,
        location: location || null,
        description: description || null,
        link: link || null,
        created_at: now,
        updated_at: now,
      }).returning().get()
      return conf
    }
  )

  // GET /api/conferences/:id — detail (single conference)
  app.get<{ Params: { id: string } }>('/api/conferences/:id', async (request, reply) => {
    const db = getDatabase()
    const id = parseInt(request.params.id, 10)
    const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
    if (!conf) {
      reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } })
      return
    }
    return conf
  })

  // PATCH /api/conferences/:id — edit
  app.patch<{ Params: { id: string }; Body: { name?: string; year?: number | null; start_date?: string | null; end_date?: string | null; location?: string | null; description?: string | null; link?: string | null } }>(
    '/api/conferences/:id',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
      if (!conf) {
        reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } })
        return
      }
      const body = request.body || {}
      const updates: Record<string, any> = {}
      if (body.name !== undefined) {
        if (!body.name.trim()) {
          reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'name cannot be empty' } })
          return
        }
        updates.name = body.name.trim()
      }
      if (body.year !== undefined) updates.year = body.year
      if (body.start_date !== undefined) updates.start_date = body.start_date || null
      if (body.end_date !== undefined) updates.end_date = body.end_date || null
      if (body.location !== undefined) updates.location = body.location || null
      if (body.description !== undefined) updates.description = body.description || null
      if (body.link !== undefined) updates.link = body.link || null

      if (Object.keys(updates).length === 0) return conf
      updates.updated_at = new Date().toISOString()
      db.update(schema.conferences).set(updates).where(eq(schema.conferences.id, id)).run()
      return db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
    }
  )

  // DELETE /api/conferences/:id — cascades conference_papers; never touches `papers`.
  app.delete<{ Params: { id: string } }>(
    '/api/conferences/:id',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
      if (!conf) {
        reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } })
        return
      }
      const sqlite = getSqliteDatabase()
      const tx = sqlite.transaction(() => {
        db.delete(schema.conferencePapers).where(eq(schema.conferencePapers.conference_id, id)).run()
        db.delete(schema.conferences).where(eq(schema.conferences.id, id)).run()
      })
      tx()
      return { success: true, deleted_id: id }
    }
  )

  // GET /api/conferences/:id/papers?topic=&status=
  app.get<{ Params: { id: string }; Querystring: { topic?: string; status?: string } }>(
    '/api/conferences/:id/papers',
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
      if (!conf) {
        reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } })
        return
      }
      const conditions = [eq(schema.conferencePapers.conference_id, id)]
      const topic = request.query.topic
      if (topic !== undefined) {
        if (topic === '' || topic === 'null') {
          conditions.push(sql`${schema.conferencePapers.topic} IS NULL`)
        } else {
          conditions.push(eq(schema.conferencePapers.topic, topic))
        }
      }
      const status = normalizeStatus(request.query.status)
      if (status) conditions.push(eq(schema.conferencePapers.status, status))

      const rows = db.select().from(schema.conferencePapers)
        .where(and(...conditions))
        .orderBy(asc(schema.conferencePapers.topic), asc(schema.conferencePapers.id))
        .all()

      // Attach the linked paper's `listed` so the client derives status:
      // paper_id null → 待添加; paper_listed false → 仅元数据; true → 已加入.
      const paperIds = rows.map(r => r.paper_id).filter((x): x is number => x != null)
      const paperMap = new Map<number, { listed: boolean; arxiv_id: string | null; corpus_id: string | null }>()
      if (paperIds.length > 0) {
        for (const p of db.select({ id: schema.papers.id, listed: schema.papers.listed, arxiv_id: schema.papers.arxiv_id, corpus_id: schema.papers.corpus_id }).from(schema.papers).where(inArray(schema.papers.id, paperIds)).all()) {
          paperMap.set(p.id, { listed: !!p.listed, arxiv_id: p.arxiv_id, corpus_id: p.corpus_id })
        }
      }
      // Surface the resolved/linked paper's S2 + arXiv ids so the candidate row can
      // render the same arxiv:/S2 badges as the library — see resolveOne, which caches
      // the S2 match and links a (metadata-only) paper.
      return rows.map(r => {
        const linked = r.paper_id != null ? paperMap.get(r.paper_id) : undefined
        return {
          ...parseConferencePaper(r),
          paper_listed: r.paper_id != null ? (linked?.listed ?? null) : null,
          paper_arxiv_id: linked?.arxiv_id ?? null,
          paper_corpus_id: linked?.corpus_id ?? null,
        }
      })
    }
  )

  // POST /api/conferences/:id/papers/import — batch insert candidates, atomic
  app.post<{ Params: { id: string }; Body: { papers?: Array<any> } }>(
    '/api/conferences/:id/papers/import',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const sqlite = getSqliteDatabase()
      const id = parseInt(request.params.id, 10)
      const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
      if (!conf) {
        reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } })
        return
      }

      const papers = Array.isArray(request.body?.papers) ? request.body!.papers : []
      // Validate every row up front so the whole batch is atomic.
      for (let i = 0; i < papers.length; i++) {
        const p = papers[i]
        if (!p || typeof p !== 'object' || typeof p.title !== 'string' || !p.title.trim()) {
          reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: `papers[${i}].title is required` } })
          return
        }
      }

      const now = new Date().toISOString()
      const created: number[] = []
      const tx = sqlite.transaction(() => {
        for (const p of papers) {
          const row = db.insert(schema.conferencePapers).values({
            conference_id: id,
            title: String(p.title).trim(),
            topic: typeof p.topic === 'string' && p.topic.trim() ? p.topic.trim() : null,
            authors: Array.isArray(p.authors) ? JSON.stringify(p.authors) : null,
            abstract: typeof p.abstract === 'string' ? p.abstract : null,
            source: normalizeSource(p.source),
            external_id: typeof p.external_id === 'string' ? p.external_id : null,
            link: typeof p.link === 'string' ? p.link : null,
            status: 'pending',
            paper_id: null,
            metadata: p.metadata != null ? JSON.stringify(p.metadata) : null,
            created_at: now,
            updated_at: now,
          }).returning({ id: schema.conferencePapers.id }).get()
          created.push(row.id)
        }
      })
      tx()

      return { imported: created.length, ids: created }
    }
  )

  // PATCH /api/conferences/:id/papers — batch status / topic update (body: { ids: number[], status?, topic? })
  app.patch<{ Params: { id: string }; Body: { ids?: number[]; status?: string; topic?: string | null } }>(
    '/api/conferences/:id/papers',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
      if (!conf) {
        reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } })
        return
      }
      const ids = Array.isArray(request.body?.ids) ? request.body!.ids.filter((n) => Number.isInteger(n)) : []
      if (ids.length === 0) {
        reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'ids is required' } })
        return
      }
      const updates: Record<string, any> = {}
      const nextStatus = normalizeStatus(request.body?.status)
      if (request.body?.status !== undefined) {
        if (!nextStatus) {
          reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: `invalid status` } })
          return
        }
        // Batch endpoint is intended for pending↔candidate flow; do not allow flipping to `ingested` here.
        if (nextStatus === 'ingested') {
          reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'use POST /ingest to mark candidates ingested' } })
          return
        }
        updates.status = nextStatus
      }
      if (request.body?.topic !== undefined) {
        updates.topic = request.body.topic && request.body.topic.toString().trim() ? request.body.topic.toString().trim() : null
      }
      if (Object.keys(updates).length === 0) return { updated: 0 }
      updates.updated_at = new Date().toISOString()

      const res = db.update(schema.conferencePapers).set(updates)
        .where(and(
          eq(schema.conferencePapers.conference_id, id),
          inArray(schema.conferencePapers.id, ids),
        ))
        .run()
      return { updated: res.changes }
    }
  )

  // PATCH /api/conferences/:id/papers/:cpId — single candidate update (topic/status, no ingest)
  app.patch<{ Params: { id: string; cpId: string }; Body: { status?: string; topic?: string | null } }>(
    '/api/conferences/:id/papers/:cpId',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const cpId = parseInt(request.params.cpId, 10)
      const row = db.select().from(schema.conferencePapers)
        .where(and(eq(schema.conferencePapers.conference_id, id), eq(schema.conferencePapers.id, cpId)))
        .get()
      if (!row) {
        reply.code(404).send({ error: { code: 'CANDIDATE_NOT_FOUND', message: `Candidate ${cpId} not found` } })
        return
      }
      const updates: Record<string, any> = {}
      if (request.body?.status !== undefined) {
        const next = normalizeStatus(request.body.status)
        if (!next) {
          reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: `invalid status` } })
          return
        }
        if (next === 'ingested') {
          reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'use POST /ingest to mark a candidate ingested' } })
          return
        }
        updates.status = next
      }
      if (request.body?.topic !== undefined) {
        updates.topic = request.body.topic && request.body.topic.toString().trim() ? request.body.topic.toString().trim() : null
      }
      if (Object.keys(updates).length === 0) return parseConferencePaper(row)
      updates.updated_at = new Date().toISOString()
      db.update(schema.conferencePapers).set(updates).where(eq(schema.conferencePapers.id, cpId)).run()
      const refetched = db.select().from(schema.conferencePapers).where(eq(schema.conferencePapers.id, cpId)).get()!
      return parseConferencePaper(refetched)
    }
  )

  // DELETE /api/conferences/:id/papers/:cpId — remove a candidate (never touches `papers`)
  app.delete<{ Params: { id: string; cpId: string } }>(
    '/api/conferences/:id/papers/:cpId',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const cpId = parseInt(request.params.cpId, 10)
      const row = db.select().from(schema.conferencePapers)
        .where(and(eq(schema.conferencePapers.conference_id, id), eq(schema.conferencePapers.id, cpId)))
        .get()
      if (!row) {
        reply.code(404).send({ error: { code: 'CANDIDATE_NOT_FOUND', message: `Candidate ${cpId} not found` } })
        return
      }
      db.delete(schema.conferencePapers).where(eq(schema.conferencePapers.id, cpId)).run()
      return { success: true, deleted_id: cpId }
    }
  )

  // Internal: add a candidate to the library, keeping a STABLE paper id.
  //  - already resolved/linked → promote that same paper (no new id, no duplicate)
  //  - otherwise → resolve ids (cached S2 match → source → live S2 title match) and ingest
  async function ingestOne(row: typeof schema.conferencePapers.$inferSelect): Promise<number> {
    const db = getDatabase()

    // Already linked (e.g. via resolve): promote the SAME paper rather than create a duplicate.
    if (row.paper_id) {
      const existing = db.select().from(schema.papers).where(eq(schema.papers.id, row.paper_id)).get()
      if (existing) {
        if (existing.listed === 0) {
          db.update(schema.papers).set({ listed: 1 }).where(eq(schema.papers.id, existing.id)).run()
          serviceRunner.triggerForPaper(existing.id).catch(() => {})
        }
        db.update(schema.conferencePapers).set({ status: 'ingested', updated_at: new Date().toISOString() }).where(eq(schema.conferencePapers.id, row.id)).run()
        return existing.id
      }
    }

    // Not linked yet → resolve ids before ingesting so the paper keeps its arxiv/corpus id.
    let arxiv_id: string | null = null
    let corpus_id: string | null = null
    try {
      const meta = row.metadata ? JSON.parse(row.metadata) : {}
      if (meta?.s2_match?.matched) { arxiv_id = meta.s2_match.arxiv_id || null; corpus_id = meta.s2_match.corpus_id || null }
    } catch {}
    if (!arxiv_id && row.source === 'arxiv') arxiv_id = row.external_id
    if (!corpus_id && row.source === 'semantic_scholar') corpus_id = row.external_id
    if (!arxiv_id && !corpus_id) {
      const m = await matchPaperByTitle(row.title)
      if (m) { arxiv_id = m.arxiv_id; corpus_id = m.corpus_id }
    }

    const authors = row.authors ? JSON.parse(row.authors) as string[] : []
    // OpenReview link is NOT written to papers.link — it stays on this conference_papers row.
    const { paper } = await ingestPaper({ arxiv_id, corpus_id, title: row.title, authors })
    db.update(schema.conferencePapers).set({
      status: 'ingested',
      paper_id: paper.id,
      updated_at: new Date().toISOString(),
    }).where(eq(schema.conferencePapers.id, row.id)).run()
    return paper.id
  }

  // POST /api/conferences/:id/ingest — one-click ingest of all `candidate` rows.
  app.post<{ Params: { id: string } }>(
    '/api/conferences/:id/ingest',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
      if (!conf) {
        reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } })
        return
      }
      const rows = db.select().from(schema.conferencePapers)
        .where(and(eq(schema.conferencePapers.conference_id, id), eq(schema.conferencePapers.status, 'candidate')))
        .all()

      let ingested = 0
      let skipped = 0
      const errors: Array<{ candidate_id: number; message: string }> = []
      for (const row of rows) {
        try {
          await ingestOne(row)
          ingested++
        } catch (e: any) {
          errors.push({ candidate_id: row.id, message: e?.message || 'ingest failed' })
          skipped++
        }
      }
      return { ingested, skipped, errors }
    }
  )

  // POST /api/conferences/:id/papers/:cpId/ingest — single-candidate ingest
  app.post<{ Params: { id: string; cpId: string } }>(
    '/api/conferences/:id/papers/:cpId/ingest',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const cpId = parseInt(request.params.cpId, 10)
      const row = db.select().from(schema.conferencePapers)
        .where(and(eq(schema.conferencePapers.conference_id, id), eq(schema.conferencePapers.id, cpId)))
        .get()
      if (!row) {
        reply.code(404).send({ error: { code: 'CANDIDATE_NOT_FOUND', message: `Candidate ${cpId} not found` } })
        return
      }
      if (row.status === 'ingested') {
        // Idempotent: already ingested — return current state.
        return parseConferencePaper(row)
      }
      try {
        await ingestOne(row)
      } catch (e: any) {
        reply.code(500).send({ error: { code: 'INGEST_FAILED', message: e?.message || 'ingest failed' } })
        return
      }
      const refetched = db.select().from(schema.conferencePapers).where(eq(schema.conferencePapers.id, cpId)).get()!
      return parseConferencePaper(refetched)
    }
  )

  // Internal: resolve one candidate's title → S2 ids, ingest as a metadata-only
  // (listed=0) paper, link it, and cache the match for review.
  async function resolveOne(row: typeof schema.conferencePapers.$inferSelect): Promise<'matched' | 'unmatched'> {
    const db = getDatabase()
    if (row.paper_id) return 'matched' // already linked
    const match = await matchPaperByTitle(row.title)
    const meta = row.metadata ? JSON.parse(row.metadata) : {}
    if (!match) {
      meta.s2_match = { matched: false, at: new Date().toISOString() }
      db.update(schema.conferencePapers).set({ metadata: JSON.stringify(meta), updated_at: new Date().toISOString() }).where(eq(schema.conferencePapers.id, row.id)).run()
      return 'unmatched'
    }
    const authors = row.authors ? JSON.parse(row.authors) as string[] : []
    const { paper } = await ingestPaper({
      arxiv_id: match.arxiv_id,
      corpus_id: match.corpus_id,
      title: row.title,
      authors,
      // NOTE: do not write the OpenReview link to papers.link — a paper's OpenReview
      // link(s) live on its conference_papers rows (one per submission). papers.link
      // is left for the canonical (arxiv) source.
      listed: false, // metadata-only until the user adds it to the library
    })
    meta.s2_match = {
      matched: true,
      matched_title: match.matched_title,
      match_score: match.match_score,
      corpus_id: match.corpus_id,
      arxiv_id: match.arxiv_id,
      at: new Date().toISOString(),
    }
    db.update(schema.conferencePapers).set({ paper_id: paper.id, metadata: JSON.stringify(meta), updated_at: new Date().toISOString() }).where(eq(schema.conferencePapers.id, row.id)).run()
    return 'matched'
  }

  // POST /api/conferences/:id/resolve — resolve all unlinked candidates via S2 title match.
  // Runs in the background (rate-limited ~1 RPS); the client polls GET papers for `paper_id`.
  app.post<{ Params: { id: string } }>(
    '/api/conferences/:id/resolve',
    { preHandler: requireUser },
    async (request, reply) => {
      const db = getDatabase()
      const id = parseInt(request.params.id, 10)
      const conf = db.select().from(schema.conferences).where(eq(schema.conferences.id, id)).get()
      if (!conf) { reply.code(404).send({ error: { code: 'CONFERENCE_NOT_FOUND', message: `Conference ${id} not found` } }); return }
      const rows = db.select().from(schema.conferencePapers)
        .where(and(eq(schema.conferencePapers.conference_id, id), sql`${schema.conferencePapers.paper_id} IS NULL`))
        .all()
      ;(async () => {
        let matched = 0, unmatched = 0
        for (const row of rows) {
          try {
            if ((await resolveOne(row)) === 'matched') matched++; else unmatched++
          } catch (e: any) {
            console.warn(`Conference ${id} resolve candidate ${row.id} failed: ${e?.message || e}`)
          }
        }
        console.log(`Conference ${id} resolve done: ${matched} matched, ${unmatched} unmatched of ${rows.length}`)
      })()
      return { started: true, pending: rows.length }
    }
  )
}

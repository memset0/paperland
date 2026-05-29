import type { FastifyInstance } from 'fastify'
import { eq, desc, isNotNull } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { serviceRunner } from '../services/service_runner.js'
import { requireUser, requireAdmin } from '../auth/guards.js'

export async function serviceRoutes(app: FastifyInstance): Promise<void> {
  // List registered services (admin-only global dashboard)
  app.get('/api/services', { preHandler: requireAdmin }, async () => {
    return { data: serviceRunner.getServiceInfo() }
  })

  // List service executions with pagination
  app.get<{ Querystring: { page?: string; page_size?: string; service_name?: string; status?: string } }>(
    '/api/services/executions',
    { preHandler: requireAdmin },
    async (request) => {
      const db = getDatabase()
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = parseInt(request.query.page_size || '20', 10)

      let query = db.select().from(schema.serviceExecutions)

      const allResults = query.orderBy(desc(schema.serviceExecutions.created_at)).all()

      // Filter in JS (simple approach for SQLite)
      let filtered = allResults
      if (request.query.service_name) {
        filtered = filtered.filter((e) => e.service_name === request.query.service_name)
      }
      if (request.query.status) {
        filtered = filtered.filter((e) => e.status === request.query.status)
      }

      const total = filtered.length
      const data = filtered.slice((page - 1) * pageSize, page * pageSize)

      return {
        data,
        pagination: {
          page,
          page_size: pageSize,
          total,
          total_pages: Math.ceil(total / pageSize),
        },
      }
    }
  )

  // Get service executions for a specific paper
  app.get<{ Params: { id: string } }>(
    '/api/papers/:id/services',
    { preHandler: requireUser },
    async (request) => {
      const db = getDatabase()
      const paperId = parseInt(request.params.id, 10)

      const executions = db.select()
        .from(schema.serviceExecutions)
        .where(eq(schema.serviceExecutions.paper_id, paperId))
        .orderBy(desc(schema.serviceExecutions.created_at))
        .all()

      return { data: executions }
    }
  )

  // Manually trigger all services for a paper
  app.post<{ Params: { id: string } }>(
    '/api/papers/:id/services/trigger',
    { preHandler: requireUser },
    async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const db = getDatabase()
      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (!paper) {
        reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${paperId} not found` } })
        return
      }

      await serviceRunner.triggerForPaper(paperId)
      return { success: true, message: 'Services triggered' }
    }
  )

  // Trigger a single service for a paper (useful for retrying failed services)
  app.post<{ Params: { id: string; serviceName: string } }>(
    '/api/papers/:id/services/:serviceName/trigger',
    { preHandler: requireUser },
    async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const serviceName = request.params.serviceName
      const db = getDatabase()
      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (!paper) {
        reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${paperId} not found` } })
        return
      }

      const info = serviceRunner.getServiceInfo()
      if (!info.find((s) => s.name === serviceName)) {
        reply.code(404).send({ error: { code: 'SERVICE_NOT_FOUND', message: `Service ${serviceName} not found` } })
        return
      }

      serviceRunner.executeServiceForPaper(serviceName, paperId).catch(() => {})
      return { success: true, message: `Service ${serviceName} triggered for paper ${paperId}` }
    }
  )

  // One-time backfill: run semantic_scholar_service for existing papers that
  // have an arxiv_id but no corpus_id yet. Each run goes through the runner so
  // the configured rate limit serializes the S2 requests. Progress is visible
  // in service_executions.
  app.post('/api/services/backfill/semantic_scholar_service', { preHandler: requireAdmin }, async () => {
    const db = getDatabase()
    // Eligible = has arxiv_id and is missing S2 enrichment (no citation_count in
    // metadata). Keying on citation_count (not just corpus_id) also re-processes
    // papers that were only partially enriched.
    const rows = db.select({ id: schema.papers.id, metadata: schema.papers.metadata })
      .from(schema.papers)
      .where(isNotNull(schema.papers.arxiv_id))
      .all()
    // Papers that already have citation-graph rows captured.
    const withGraph = new Set(
      db.select({ pid: schema.paperCitations.paper_id }).from(schema.paperCitations).all().map((r) => r.pid)
    )
    const eligible = rows.filter((p) => {
      let meta: any = {}
      try { meta = p.metadata ? JSON.parse(p.metadata) : {} } catch {}
      // Needs (re)processing if enrichment OR the citation graph is missing.
      return meta.citation_count === undefined || !withGraph.has(p.id)
    })

    for (const p of eligible) {
      serviceRunner.executeServiceForPaper('semantic_scholar_service', p.id).catch(() => {})
    }

    return { success: true, queued: eligible.length }
  })
}

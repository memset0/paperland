import type { FastifyInstance } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import type { Doc2xParseStatus, Doc2xStatus, Doc2xTranslateStatus } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { requireUser } from '../auth/guards.js'
import { serviceRunner } from '../services/service_runner.js'

type PaperRow = typeof schema.papers.$inferSelect
type RunService = (serviceName: 'doc2x_parse' | 'doc2x_translate', paperId: number) => void

function parseJson(value: string | null | undefined): Record<string, any> {
  if (!value) return {}
  try { return JSON.parse(value) } catch { return {} }
}

function latestExecution(paperId: number, serviceName: string) {
  return getDatabase().select().from(schema.serviceExecutions)
    .where(and(eq(schema.serviceExecutions.paper_id, paperId), eq(schema.serviceExecutions.service_name, serviceName)))
    .orderBy(desc(schema.serviceExecutions.id))
    .get()
}

/** Aggregate doc2x parse/translate state for one paper (see design D6). */
export function computeDoc2xStatus(paper: PaperRow): Doc2xStatus {
  const config = getConfig()
  const contents = parseJson(paper.contents)
  const metadata = parseJson(paper.metadata)
  const enabled = config.doc2x.enabled
  const hasPdf = !!paper.pdf_path

  // Parse
  const parseExec = latestExecution(paper.id, 'doc2x_parse')
  let parseStatus: Doc2xParseStatus = 'none'
  let parseError: string | null = null
  if (contents.doc2x_parsed) parseStatus = 'done'
  else if (parseExec && (parseExec.status === 'pending' || parseExec.status === 'running')) parseStatus = parseExec.status
  else if (parseExec?.status === 'failed') {
    parseStatus = 'failed'
    parseError = parseExec.error ?? null
  }

  // Translate
  const translation = metadata.doc2x_translation ?? null
  const requestedAt: string | null = metadata.doc2x_translate_requested ?? null
  const translateExec = latestExecution(paper.id, 'doc2x_translate')
  let translateStatus: Doc2xTranslateStatus = 'idle'
  let translateError: string | null = null
  if (translation?.bilingual_pdf_path) translateStatus = 'done'
  else if (translateExec && (translateExec.status === 'pending' || translateExec.status === 'running')) translateStatus = translateExec.status
  else if (translateExec?.status === 'failed' && !(requestedAt && requestedAt > (translateExec.finished_at ?? translateExec.created_at))) {
    translateStatus = 'failed'
    translateError = translateExec.error ?? null
  } else if (requestedAt) translateStatus = 'queued'

  const qaSource = (config.content_priority || []).find((key) => !!contents[key]) ?? null
  return {
    enabled,
    has_pdf: hasPdf,
    parse: {
      status: parseStatus,
      error: parseError,
      finished_at: parseStatus === 'done' || parseStatus === 'failed' ? parseExec?.finished_at ?? null : null,
    },
    translate: {
      status: translateStatus,
      error: translateError,
      requested_at: requestedAt,
      bilingual_pdf_path: translation?.bilingual_pdf_path ?? null,
      translated_pdf_path: translation?.translated_pdf_path ?? null,
    },
    text_sources: { pdf_parsed: !!contents.pdf_parsed, doc2x_parsed: !!contents.doc2x_parsed },
    qa_source: qaSource,
    qa_needs_confirm: enabled && hasPdf && qaSource !== 'user_input' && qaSource !== 'doc2x_parsed',
  }
}

function setMetadataFlag(paperId: number, key: string, value: string): void {
  const db = getDatabase()
  const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
  if (!paper) return
  const metadata = parseJson(paper.metadata)
  metadata[key] = value
  db.update(schema.papers).set({ metadata: JSON.stringify(metadata) }).where(eq(schema.papers.id, paperId)).run()
}

const defaultRunService: RunService = (serviceName, paperId) => {
  serviceRunner.executeServiceForPaper(serviceName, paperId).catch(() => {})
}

export async function doc2xRoutes(app: FastifyInstance, options: { runService?: RunService } = {}) {
  const runService = options.runService ?? defaultRunService

  function loadPaper(idParam: string, reply: any): PaperRow | null {
    const id = parseInt(idParam, 10)
    const paper = getDatabase().select().from(schema.papers).where(eq(schema.papers.id, id)).get()
    if (!paper) {
      reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: `Paper ${idParam} not found` } })
      return null
    }
    return paper
  }

  function rejectUnavailable(status: Doc2xStatus, reply: any): boolean {
    if (!status.enabled) {
      reply.code(422).send({ error: { code: 'DOC2X_DISABLED', message: 'doc2x 未启用' } })
      return true
    }
    if (!status.has_pdf) {
      reply.code(422).send({ error: { code: 'NO_PDF', message: '论文还没有 PDF' } })
      return true
    }
    return false
  }

  app.get<{ Params: { id: string } }>('/api/papers/:id/doc2x', async (request, reply) => {
    const paper = loadPaper(request.params.id, reply)
    if (!paper) return
    return computeDoc2xStatus(paper)
  })

  app.post<{ Params: { id: string } }>('/api/papers/:id/doc2x/parse', { preHandler: requireUser }, async (request, reply) => {
    const paper = loadPaper(request.params.id, reply)
    if (!paper) return
    const status = computeDoc2xStatus(paper)
    if (rejectUnavailable(status, reply)) return
    if (status.parse.status !== 'none' && status.parse.status !== 'failed') {
      reply.code(409).send({ error: { code: 'DOC2X_PARSE_EXISTS', message: status.parse.status === 'done' ? 'doc2x 解析已完成' : 'doc2x 解析已在进行中' } })
      return
    }
    setMetadataFlag(paper.id, 'doc2x_parse_requested', new Date().toISOString())
    runService('doc2x_parse', paper.id)
    reply.code(202)
    return computeDoc2xStatus(getDatabase().select().from(schema.papers).where(eq(schema.papers.id, paper.id)).get()!)
  })

  app.post<{ Params: { id: string } }>('/api/papers/:id/doc2x/translate', { preHandler: requireUser }, async (request, reply) => {
    const paper = loadPaper(request.params.id, reply)
    if (!paper) return
    const status = computeDoc2xStatus(paper)
    if (rejectUnavailable(status, reply)) return
    // A request stuck behind a failed parse may be re-submitted: it restarts the parse.
    const stuckBehindFailedParse = status.translate.status === 'queued' && status.parse.status === 'failed'
    if (status.translate.status !== 'idle' && status.translate.status !== 'failed' && !stuckBehindFailedParse) {
      const message = status.translate.status === 'done' ? '翻译已完成' : '翻译已在队列中或正在进行'
      reply.code(409).send({ error: { code: 'DOC2X_TRANSLATE_EXISTS', message } })
      return
    }

    const now = new Date().toISOString()
    setMetadataFlag(paper.id, 'doc2x_translate_requested', now)
    if (status.parse.status === 'done') {
      runService('doc2x_translate', paper.id)
    } else if (status.parse.status === 'none' || status.parse.status === 'failed') {
      // Never parsed (old paper) or parse failed: start it; translation follows on completion.
      setMetadataFlag(paper.id, 'doc2x_parse_requested', now)
      runService('doc2x_parse', paper.id)
    }
    // pending/running parse: stay queued — the dependency graph starts translation afterwards.
    reply.code(202)
    return computeDoc2xStatus(getDatabase().select().from(schema.papers).where(eq(schema.papers.id, paper.id)).get()!)
  })
}

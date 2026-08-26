import type { FastifyInstance } from 'fastify'
import { once } from 'events'
import { eq, and, desc, inArray, or, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { loadTemplates, loadTemplate } from '../services/template_loader.js'
import { askQuestion, resolveContent } from '../services/qa_service.js'
import { getModelCapabilities } from '../services/model_invoke.js'
import { serviceRunner } from '../services/service_runner.js'
import { touchPaperUpdatedAt } from '../db/utils.js'
import { requireUser } from '../auth/guards.js'
import { resolveRegenerationPrompt } from '../services/qa_prompt.js'
import { markdownContentHash } from '../services/content_hash.js'
import { loadQAReadingIndicators } from '../services/qa_reading.js'
import {
  deriveThinkingDurationMs,
  isActiveQAResultStatus,
  recomputeQAEntryState,
  serializeQAResult,
} from '../services/qa_runtime.js'
import { qaResultStreamBroker } from '../services/qa_result_stream.js'

function uniqueNumbers(values: Array<number | null>): number[] {
  return [...new Set(values.filter((value): value is number => value != null))]
}

function loadUsernames(db: ReturnType<typeof getDatabase>, userIds: Array<number | null>): Map<number, string> {
  const ids = uniqueNumbers(userIds)
  if (ids.length === 0) return new Map()
  return new Map(
    db.select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(inArray(schema.users.id, ids))
      .all()
      .map((row) => [row.id, row.username]),
  )
}

function loadResultsByEntry(db: ReturnType<typeof getDatabase>, entryIds: number[]): Map<number, any[]> {
  if (entryIds.length === 0) return new Map()
  const map = new Map<number, any[]>()
  for (const result of db.select().from(schema.qaResults)
    .where(inArray(schema.qaResults.qa_entry_id, entryIds))
    .orderBy(desc(schema.qaResults.created_at), desc(schema.qaResults.id))
    .all()) {
    const rows = map.get(result.qa_entry_id) || []
    rows.push(result)
    map.set(result.qa_entry_id, rows)
  }
  return map
}

function canManageEntry(entry: { type: string; user_id: number | null }, user: { id: number; role: string } | null | undefined): boolean {
  if (!user) return false
  if (entry.type === 'template') return true
  return user.role === 'admin' || entry.user_id === user.id
}

function canManageResultCancellation(
  entry: { type: string; user_id: number | null },
  result: { requested_by_user_id: number | null },
  user: { id: number; role: string } | null | undefined,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (entry.type === 'free') return entry.user_id === user.id
  return result.requested_by_user_id === user.id
}

function canCancelResult(
  entry: { type: string; user_id: number | null },
  result: { status: string; execution_id: number | null; requested_by_user_id: number | null },
  user: { id: number; role: string } | null | undefined,
): boolean {
  return result.execution_id != null
    && isActiveQAResultStatus(result.status)
    && canManageResultCancellation(entry, result, user)
}

function serializeResultsForEntry(
  results: Array<typeof schema.qaResults.$inferSelect>,
  entry: { type: string; user_id: number | null },
  user: { id: number; role: string } | null | undefined,
) {
  const nowMs = Date.now()
  return results.map((result) => serializeQAResult(result, {
    canCancel: canCancelResult(entry, result, user),
    nowMs,
  }))
}

const QA_BACKGROUND_COLORS = new Set([
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
])

function loadBackgroundPreferences(
  db: ReturnType<typeof getDatabase>,
  userId: number | null,
  entryIds: number[],
): Map<number, string> {
  if (userId == null || entryIds.length === 0) return new Map()
  return new Map(
    db.select({ entry_id: schema.qaUserPreferences.qa_entry_id, color: schema.qaUserPreferences.background_color })
      .from(schema.qaUserPreferences)
      .where(and(
        eq(schema.qaUserPreferences.user_id, userId),
        inArray(schema.qaUserPreferences.qa_entry_id, entryIds),
      ))
      .all()
      .map((row) => [row.entry_id, row.color]),
  )
}

type AskQuestionFn = typeof askQuestion

export interface RunQAOptions {
  requestedByUserId?: number | null
  askFn?: AskQuestionFn
  capabilitiesFn?: typeof getModelCapabilities
  batchMs?: number
}

export interface ScheduledQARun {
  result_id: number
  execution_id: number
  model_name: string
}

function normalizeRunQAOptions(optionsOrAsk?: RunQAOptions | AskQuestionFn): RunQAOptions {
  if (typeof optionsOrAsk === 'function') {
    return { askFn: optionsOrAsk, capabilitiesFn: () => ({ streaming: false }) }
  }
  return optionsOrAsk ?? {}
}

function updateResultIfActive(
  db: ReturnType<typeof getDatabase>,
  resultId: number,
  values: Partial<typeof schema.qaResults.$inferInsert>,
) {
  return db.update(schema.qaResults)
    .set(values)
    .where(and(
      eq(schema.qaResults.id, resultId),
      inArray(schema.qaResults.status, ['queued', 'awaiting_output', 'streaming']),
    ))
    .returning()
    .get()
}

function createPartialAnswerWriter(options: {
  db: ReturnType<typeof getDatabase>
  entryId: number
  resultId: number
  batchMs: number
}) {
  const { db, entryId, resultId, batchMs } = options
  let pending = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstChunkAt: string | null = null

  const flush = () => {
    if (!pending) return
    const delta = pending
    pending = ''
    const now = new Date().toISOString()
    const updated = db.update(schema.qaResults)
      .set({
        answer: sql`${schema.qaResults.answer} || ${delta}`,
        updated_at: now,
      })
      .where(and(
        eq(schema.qaResults.id, resultId),
        inArray(schema.qaResults.status, ['awaiting_output', 'streaming']),
      ))
      .returning()
      .get()
    if (!updated) return
    qaResultStreamBroker.publish(resultId, {
      event: 'delta',
      result_id: resultId,
      delta,
      answer_length: updated.answer.length,
      first_chunk_at: updated.first_chunk_at,
      thinking_duration_ms: deriveThinkingDurationMs(updated),
    })
  }

  const onChunk = (delta: string) => {
    if (!delta) return
    if (!firstChunkAt) {
      firstChunkAt = new Date().toISOString()
      const transitioned = db.update(schema.qaResults)
        .set({ status: 'streaming', first_chunk_at: firstChunkAt, updated_at: firstChunkAt })
        .where(and(eq(schema.qaResults.id, resultId), eq(schema.qaResults.status, 'awaiting_output')))
        .returning()
        .get()
      if (!transitioned) return
      qaResultStreamBroker.publish(resultId, { event: 'start', result: transitioned })
      recomputeQAEntryState(db, entryId)
    }
    pending += delta
    if (!timer) {
      timer = setTimeout(() => {
        timer = null
        flush()
      }, batchMs)
      timer.unref?.()
    }
  }

  const flushNow = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    flush()
  }

  return { onChunk, flushNow }
}

export async function runQA(
  entryId: number,
  paperId: number,
  prompt: string,
  modelName: string,
  optionsOrAsk?: RunQAOptions | AskQuestionFn,
): Promise<ScheduledQARun> {
  const options = normalizeRunQAOptions(optionsOrAsk)
  const askFn = options.askFn ?? askQuestion
  const capabilitiesFn = options.capabilitiesFn ?? getModelCapabilities
  const batchMs = options.batchMs ?? 200
  const db = getDatabase()
  db.update(schema.qaEntries)
    // Persist the question before the async service starts. If the first model
    // attempt fails or the process restarts, regeneration still has a prompt.
    .set({ prompt, error: null })
    .where(eq(schema.qaEntries.id, entryId))
    .run()

  let streamingCapable = false
  try {
    streamingCapable = capabilitiesFn(modelName).streaming
  } catch {
    // Keep invalid/unavailable model attempts durable; the invocation records its error.
  }

  let preparedResult: typeof schema.qaResults.$inferSelect | null = null
  const scheduled = await serviceRunner.executePureService('qa', paperId, async ({ signal }) => {
    const result = preparedResult!
    const startedAt = new Date().toISOString()
    const awaiting = updateResultIfActive(db, result.id, {
      status: 'awaiting_output',
      started_at: startedAt,
      updated_at: startedAt,
    })
    if (!awaiting) return
    qaResultStreamBroker.publish(result.id, { event: 'start', result: awaiting })
    recomputeQAEntryState(db, entryId)

    const writer = createPartialAnswerWriter({ db, entryId, resultId: result.id, batchMs })
    try {
      const res = await askFn(paperId, prompt, modelName, { onChunk: writer.onChunk, signal })
      writer.flushNow()
      const finishedAt = new Date().toISOString()
      const completed = updateResultIfActive(db, result.id, {
        status: 'done',
        answer: res.answer,
        model_name: res.model_name,
        completed_at: finishedAt,
        content_hash: markdownContentHash(res.answer),
        error: null,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      if (completed) qaResultStreamBroker.publish(result.id, { event: 'done', result: completed })
      recomputeQAEntryState(db, entryId)
    } catch (reason: unknown) {
      writer.flushNow()
      const err = reason instanceof Error ? reason : new Error(String(reason))
      const cancelled = signal.aborted || err.name === 'AbortError'
      const finishedAt = new Date().toISOString()
      const failed = updateResultIfActive(db, result.id, {
        status: cancelled ? 'cancelled' : 'failed',
        error: cancelled ? 'cancelled by user' : err.message,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      console.error(`QA failed (entry ${entryId}):`, err.message)
      if (failed) qaResultStreamBroker.publish(result.id, { event: 'error', result: failed })
      recomputeQAEntryState(db, entryId)
      throw err // re-throw so executePureService also marks service_executions as failed
    }
  }, {
    onCreated: ({ executionId }) => {
      const now = new Date().toISOString()
      preparedResult = db.insert(schema.qaResults).values({
        qa_entry_id: entryId,
        prompt,
        answer: '',
        model_name: modelName,
        completed_at: now,
        execution_id: executionId,
        content_hash: null,
        status: 'queued',
        error: null,
        requested_by_user_id: options.requestedByUserId ?? null,
        streaming_capable: streamingCapable ? 1 : 0,
        created_at: now,
        updated_at: now,
      }).returning().get()
      recomputeQAEntryState(db, entryId)
    },
  })

  return {
    result_id: preparedResult!.id,
    execution_id: scheduled.executionId,
    model_name: modelName,
  }
}

export async function qaRoutes(app: FastifyInstance): Promise<void> {
  // List available templates
  app.get('/api/templates', async () => {
    return { data: loadTemplates().map((t) => ({ name: t.name, prompt: t.prompt })) }
  })

  // Get available models from config (login required — only used by the asking UI)
  app.get('/api/config/models', { preHandler: requireUser }, async () => {
    const config = getConfig()
    return { models: { default: config.models.default, available: config.models.available } }
  })

  // Expose PDF viewer settings to the frontend (login required). Only the safe fields are
  // returned — never the whole config, which holds secrets. Currently just the screenshot DPI.
  app.get('/api/config/pdf', { preHandler: requireUser }, async () => {
    const config = getConfig()
    return { screenshot_dpi: config.pdf_viewer.screenshot_dpi }
  })

  // Expose note-image width tiers (px max-width for the `w=sm|md|lg` alt-text directive) to the
  // frontend (login required). Anonymous/public-note views rely on the CSS fallbacks instead.
  app.get('/api/config/notes', { preHandler: requireUser }, async () => {
    const config = getConfig()
    return { image_width_tiers: config.notes.image_width_tiers }
  })

  // List free QA entries across all papers (for /qa feed page), paginated. Every authenticated
  // user may explicitly request all users' entries; mine remains the default.
  app.get<{ Querystring: { page?: string; page_size?: string; scope?: string } }>('/api/qa/free', { preHandler: requireUser }, async (request) => {
    const db = getDatabase()
    const userId = request.user!.id
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(request.query.page_size || '20', 10) || 20))
    const allScope = request.query.scope === 'all'

    const where = allScope
      ? eq(schema.qaEntries.type, 'free')
      : and(eq(schema.qaEntries.type, 'free'), eq(schema.qaEntries.user_id, userId))
    const total = Number(db.select({ value: sql<number>`count(*)` }).from(schema.qaEntries)
      .where(where)
      .get()?.value || 0)
    const pageEntries = db.select().from(schema.qaEntries)
      .where(where)
      .orderBy(desc(schema.qaEntries.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all()

    const usernameById = loadUsernames(db, pageEntries.map((entry) => entry.user_id))
    const resultsByEntry = loadResultsByEntry(db, pageEntries.map((entry) => entry.id))
    const preferenceByEntry = loadBackgroundPreferences(db, userId, pageEntries.map((entry) => entry.id))
    const indicators = loadQAReadingIndicators(db, userId, pageEntries, resultsByEntry)
    const paperIds = uniqueNumbers(pageEntries.map((entry) => entry.paper_id))
    const paperTitleById = new Map(
      (paperIds.length === 0 ? [] : db.select({ id: schema.papers.id, title: schema.papers.title })
        .from(schema.papers).where(inArray(schema.papers.id, paperIds)).all())
        .map((paper) => [paper.id, paper.title]),
    )

    const data = []
    for (const entry of pageEntries) {
      const rawResults = resultsByEntry.get(entry.id) || []
      const results = serializeResultsForEntry(rawResults, entry, request.user)

      data.push({
        entry_id: entry.id,
        paper_id: entry.paper_id,
        paper_title: paperTitleById.get(entry.paper_id) || 'Unknown',
        status: entry.status,
        error: entry.error,
        prompt: entry.prompt || results[0]?.prompt || null,
        created_at: entry.created_at,
        user_id: entry.user_id ?? null,
        username: entry.user_id != null ? (usernameById.get(entry.user_id) ?? null) : null,
        can_manage: canManageEntry(entry, request.user),
        background_color: preferenceByEntry.get(entry.id) ?? null,
        highlight_count: indicators.highlightByEntry.get(entry.id) || 0,
        note_anchor_count: indicators.noteByEntry.get(entry.id) || 0,
        results,
      })
    }

    return {
      data,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    }
  })

  // List QA entries for a paper. Template QA is public; authenticated users can explicitly
  // request all free QA, while mine remains the default.
  app.get<{ Params: { id: string }; Querystring: { scope?: string } }>('/api/papers/:id/qa', async (request) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const userId = request.user?.id ?? null
    const allScope = request.query.scope === 'all' && userId != null

    const entryWhere = allScope
      ? eq(schema.qaEntries.paper_id, paperId)
      : userId == null
        ? and(eq(schema.qaEntries.paper_id, paperId), eq(schema.qaEntries.type, 'template'))
        : and(
            eq(schema.qaEntries.paper_id, paperId),
            or(
              eq(schema.qaEntries.type, 'template'),
              and(eq(schema.qaEntries.type, 'free'), eq(schema.qaEntries.user_id, userId)),
            ),
          )

    const entries = db.select().from(schema.qaEntries)
      .where(entryWhere)
      .orderBy(desc(schema.qaEntries.created_at))
      .all()
    const resultsByEntry = loadResultsByEntry(db, entries.map((entry) => entry.id))
    const usernameById = loadUsernames(db, entries.map((entry) => entry.user_id))
    const preferenceByEntry = loadBackgroundPreferences(db, userId, entries.map((entry) => entry.id))
    const indicators = loadQAReadingIndicators(db, userId, entries, resultsByEntry)

    const templateEntries: Record<string, any> = {}
    const freeEntries: any[] = []

    for (const entry of entries) {
      const rawResults = resultsByEntry.get(entry.id) || []
      const results = serializeResultsForEntry(rawResults, entry, request.user)
      if (entry.type === 'template' && entry.template_name) {
        templateEntries[entry.template_name] = {
          entry_id: entry.id,
          status: entry.status,
          error: entry.error,
          can_manage: canManageEntry(entry, request.user),
          background_color: preferenceByEntry.get(entry.id) ?? null,
          highlight_count: indicators.highlightByEntry.get(entry.id) || 0,
          note_anchor_count: indicators.noteByEntry.get(entry.id) || 0,
          results,
        }
      } else if (entry.type === 'free') {
        freeEntries.push({
          entry_id: entry.id,
          status: entry.status,
          error: entry.error,
          prompt: entry.prompt || results[0]?.prompt || null,
          user_id: entry.user_id ?? null,
          username: entry.user_id != null ? (usernameById.get(entry.user_id) ?? null) : null,
          can_manage: canManageEntry(entry, request.user),
          background_color: preferenceByEntry.get(entry.id) ?? null,
          highlight_count: indicators.highlightByEntry.get(entry.id) || 0,
          note_anchor_count: indicators.noteByEntry.get(entry.id) || 0,
          results,
        })
      }
    }

    return { template: templateEntries, free: freeEntries }
  })

  // Set or clear the current viewer's presentation preference for any visible QA entry.
  app.put<{ Params: { entryId: string }; Body: { background_color: string | null } }>(
    '/api/qa/:entryId/preferences', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const entryId = parseInt(request.params.entryId, 10)
      const color = request.body?.background_color ?? null
      const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, entryId)).get()
      if (!entry) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA entry not found' } })
        return
      }
      if (color !== null && !QA_BACKGROUND_COLORS.has(color)) {
        reply.code(422).send({ error: { code: 'INVALID_BACKGROUND_COLOR', message: 'Unsupported QA background color' } })
        return
      }

      if (color === null) {
        db.delete(schema.qaUserPreferences).where(and(
          eq(schema.qaUserPreferences.user_id, request.user!.id),
          eq(schema.qaUserPreferences.qa_entry_id, entryId),
        )).run()
      } else {
        const now = new Date().toISOString()
        db.insert(schema.qaUserPreferences).values({
          user_id: request.user!.id,
          qa_entry_id: entryId,
          background_color: color,
          created_at: now,
          updated_at: now,
        }).onConflictDoUpdate({
          target: [schema.qaUserPreferences.user_id, schema.qaUserPreferences.qa_entry_id],
          set: { background_color: color, updated_at: now },
        }).run()
      }

      return { entry_id: entryId, background_color: color }
    },
  )

  // Trigger all missing template Q&A
  app.post<{ Params: { id: string } }>('/api/papers/:id/qa/template', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const config = getConfig()
    const defaultModel = config.models.default

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) {
      reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } })
      return
    }

    const content = resolveContent(paper)
    if (!content) {
      reply.code(422).send({ error: { code: 'NO_CONTENT', message: 'No content available for this paper' } })
      return
    }

    const templates = loadTemplates()
    const triggered: string[] = []
    const runs: ScheduledQARun[] = []

    for (const tmpl of templates) {
      const existing = db.select().from(schema.qaEntries)
        .where(and(eq(schema.qaEntries.paper_id, paperId), eq(schema.qaEntries.type, 'template'), eq(schema.qaEntries.template_name, tmpl.name)))
        .get()

      if (existing) {
        // Skip if already has results or is currently running/pending
        if (existing.status === 'pending' || existing.status === 'running') continue
        const completed = db.select({ id: schema.qaResults.id }).from(schema.qaResults)
          .where(and(eq(schema.qaResults.qa_entry_id, existing.id), eq(schema.qaResults.status, 'done')))
          .get()
        if (completed) continue
      }

      let entryId: number
      if (existing) {
        entryId = existing.id
      } else {
        const entry = db.insert(schema.qaEntries).values({
          paper_id: paperId, type: 'template', template_name: tmpl.name, prompt: tmpl.prompt,
          status: 'pending', created_at: new Date().toISOString(),
        }).returning().get()
        entryId = entry.id
      }

      triggered.push(tmpl.name)
      runs.push(await runQA(entryId, paperId, tmpl.prompt, defaultModel, {
        requestedByUserId: request.user!.id,
      }))
    }

    if (triggered.length > 0) {
      touchPaperUpdatedAt(db, paperId)
    }

    return { triggered, runs, message: `Triggered ${triggered.length} template questions` }
  })

  // Regenerate a specific template
  app.post<{ Params: { id: string; name: string }; Body: { model?: string } }>('/api/papers/:id/qa/template/:name/regenerate', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const templateName = request.params.name
    const config = getConfig()
    const modelName = (request.body as any)?.model || config.models.default

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

    const tmpl = loadTemplate(templateName)
    if (!tmpl) { reply.code(404).send({ error: { code: 'TEMPLATE_NOT_FOUND', message: `Template ${templateName} not found` } }); return }

    let entry = db.select().from(schema.qaEntries)
      .where(and(eq(schema.qaEntries.paper_id, paperId), eq(schema.qaEntries.type, 'template'), eq(schema.qaEntries.template_name, templateName)))
      .get()

    if (!entry) {
      entry = db.insert(schema.qaEntries).values({
        paper_id: paperId, type: 'template', template_name: templateName, prompt: tmpl.prompt,
        status: 'pending', created_at: new Date().toISOString(),
      }).returning().get()
    }

    touchPaperUpdatedAt(db, paperId)
    const run = await runQA(entry.id, paperId, tmpl.prompt, modelName, {
      requestedByUserId: request.user!.id,
    })
    return { runs: [run], message: `Regenerating ${templateName}` }
  })

  // Submit free question
  app.post<{ Params: { id: string }; Body: { question: string; models: string[] } }>('/api/papers/:id/qa/free', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const { question, models } = request.body || {}

    if (!question) { reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Question is required' } }); return }

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

    const config = getConfig()
    const modelNames = models && models.length > 0 ? models : [config.models.default]

    const entry = db.insert(schema.qaEntries).values({
      paper_id: paperId, type: 'free', user_id: request.user!.id, prompt: question,
      status: 'pending', created_at: new Date().toISOString(),
    }).returning().get()

    touchPaperUpdatedAt(db, paperId)

    const runs: ScheduledQARun[] = []
    for (const modelName of modelNames) runs.push(await runQA(entry.id, paperId, question, modelName, {
      requestedByUserId: request.user!.id,
    }))

    return { entry_id: entry.id, models: modelNames, runs, message: 'Question submitted' }
  })

  // Regenerate an existing QA entry
  app.post<{ Params: { entryId: string }; Body: { models?: string[] } }>('/api/qa/:entryId/regenerate', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const entryId = parseInt(request.params.entryId, 10)
    const { models } = request.body || {}

    const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, entryId)).get()
    if (!entry) { reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA entry not found' } }); return }
    // Free QA can only be regenerated by its owner; template QA is shared.
    if (entry.type === 'free' && entry.user_id !== request.user!.id && request.user!.role !== 'admin') {
      reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA entry not found' } }); return
    }

    const config = getConfig()
    const modelNames = models && models.length > 0 ? models : [config.models.default]

    let prompt: string
    if (entry.type === 'template' && entry.template_name) {
      const tmpl = loadTemplate(entry.template_name)
      if (!tmpl) { reply.code(404).send({ error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' } }); return }
      prompt = resolveRegenerationPrompt({
        type: 'template', entry_prompt: entry.prompt, template_prompt: tmpl.prompt,
      })!
    } else {
      // New entries always persist their immutable question on qa_entries.
      // Fall back only for pre-migration legacy entries and repair them in place.
      let legacyResultPrompt: string | null = null
      if (!entry.prompt) {
        const lastResult = db.select().from(schema.qaResults)
          .where(eq(schema.qaResults.qa_entry_id, entryId))
          .orderBy(desc(schema.qaResults.completed_at))
          .get()
        legacyResultPrompt = lastResult?.prompt ?? null
      }
      prompt = resolveRegenerationPrompt({
        type: 'free', entry_prompt: entry.prompt, legacy_result_prompt: legacyResultPrompt,
      }) || ''
      if (!prompt) {
        reply.code(422).send({ error: { code: 'NO_PROMPT', message: 'No persisted question text' } })
        return
      }
      if (!entry.prompt) {
        db.update(schema.qaEntries).set({ prompt }).where(eq(schema.qaEntries.id, entryId)).run()
      }
    }

    touchPaperUpdatedAt(db, entry.paper_id)

    const runs: ScheduledQARun[] = []
    for (const modelName of modelNames) runs.push(await runQA(entryId, entry.paper_id, prompt, modelName, {
      requestedByUserId: request.user!.id,
    }))

    return { runs, message: `Regenerating with ${modelNames.length} model(s)` }
  })

  // Observe one durable background QA Result. Disconnecting this SSE request only
  // unsubscribes the viewer; it never owns or aborts the underlying model call.
  app.get<{ Params: { resultId: string } }>(
    '/api/qa/results/:resultId/stream', { preHandler: requireUser }, async (request, reply) => {
      // Defensive return for Fastify/light-my-request combinations that continue
      // the handler after an async preHandler has already sent the 401 reply.
      if (!request.user) return
      const db = getDatabase()
      const resultId = parseInt(request.params.resultId, 10)
      const initial = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, resultId)).get()
      if (!initial) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } })
        return
      }
      const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, initial.qa_entry_id)).get()
      if (!entry) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } })
        return
      }

      const raw = reply.raw
      raw.statusCode = 200
      raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      raw.setHeader('Cache-Control', 'no-cache, no-transform')
      raw.setHeader('Connection', 'keep-alive')
      raw.setHeader('X-Accel-Buffering', 'no')
      reply.hijack()

      let closed = false
      let writeQueue = Promise.resolve()
      let resolveClosed!: () => void
      const closedPromise = new Promise<void>((resolve) => { resolveClosed = resolve })
      const writeEvent = async (event: string, data: unknown) => {
        if (closed || raw.destroyed || raw.writableEnded) return
        if (!raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) await once(raw, 'drain')
      }
      const enqueue = (event: string, data: unknown) => {
        writeQueue = writeQueue.then(() => writeEvent(event, data))
        return writeQueue
      }
      const serialize = (result: typeof schema.qaResults.$inferSelect) => serializeQAResult(result, {
        canCancel: canCancelResult(entry, result, request.user),
      })

      const initialResult = serialize(initial)
      if (initial.status === 'done' || initial.status === 'failed' || initial.status === 'cancelled') {
        try {
          await writeEvent('start', {
            result: initialResult,
            streaming_capable: initialResult.streaming_capable,
            thinking_duration_ms: initialResult.thinking_duration_ms,
          })
          if (initial.status === 'done') {
            await writeEvent('done', { result: initialResult })
          } else {
            await writeEvent('error', {
              result: initialResult,
              error: {
                code: initial.status === 'cancelled' ? 'QA_CANCELLED' : 'QA_FAILED',
                message: initial.error || 'QA generation failed',
              },
            })
          }
        } catch {
          // The observer disconnected after headers were committed.
        } finally {
          closed = true
          if (!raw.destroyed && !raw.writableEnded) raw.end()
        }
        return
      }

      let unsubscribe = () => {}
      const heartbeat = setInterval(() => {
        if (!closed && !raw.destroyed && !raw.writableEnded) raw.write(': heartbeat\n\n')
      }, 15_000)
      heartbeat.unref?.()

      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        resolveClosed()
      }
      const finish = async () => {
        await writeQueue.catch(() => {})
        if (!raw.destroyed && !raw.writableEnded) raw.end()
        cleanup()
      }

      unsubscribe = qaResultStreamBroker.subscribe(resultId, (event) => {
        if (closed) return
        if (event.event === 'start') {
          const result = serialize(event.result)
          void enqueue('start', {
            result,
            streaming_capable: result.streaming_capable,
            thinking_duration_ms: result.thinking_duration_ms,
          })
        } else if (event.event === 'delta') {
          void enqueue('delta', event)
        } else {
          const result = serialize(event.result)
          const payload = event.event === 'error'
            ? { result, error: { code: result.status === 'cancelled' ? 'QA_CANCELLED' : 'QA_FAILED', message: result.error || 'QA generation failed' } }
            : { result }
          void enqueue(event.event, payload).then(finish)
        }
      })

      raw.once('close', cleanup)
      request.raw.once('aborted', cleanup)

      try {
        await enqueue('start', {
          result: initialResult,
          streaming_capable: initialResult.streaming_capable,
          thinking_duration_ms: initialResult.thinking_duration_ms,
        })
        await closedPromise
      } catch {
        // The response is already hijacked. A client/proxy closing during a write
        // must only end this observer and must not enter Fastify's HTTP error path.
        if (!raw.destroyed && !raw.writableEnded) raw.end()
        cleanup()
      }
    },
  )

  app.post<{ Params: { resultId: string } }>(
    '/api/qa/results/:resultId/cancel', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const resultId = parseInt(request.params.resultId, 10)
      const result = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, resultId)).get()
      if (!result) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } })
        return
      }
      const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get()
      if (!entry || !canManageResultCancellation(entry, result, request.user)) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } })
        return
      }
      if (!isActiveQAResultStatus(result.status) || result.execution_id == null) {
        reply.code(409).send({ error: { code: 'NOT_ACTIVE', message: 'QA result is not active' } })
        return
      }
      if (!serviceRunner.cancelPureExecution(result.execution_id)) {
        reply.code(409).send({ error: { code: 'NOT_ACTIVE', message: 'QA execution is no longer active' } })
        return
      }

      // A queued execution never enters the QA callback, so finalize it here.
      if (result.status === 'queued') {
        const now = new Date().toISOString()
        const cancelled = db.update(schema.qaResults)
          .set({ status: 'cancelled', error: 'cancelled by user', finished_at: now, updated_at: now })
          .where(and(eq(schema.qaResults.id, resultId), eq(schema.qaResults.status, 'queued')))
          .returning()
          .get()
        if (cancelled) {
          recomputeQAEntryState(db, entry.id)
          qaResultStreamBroker.publish(resultId, { event: 'error', result: cancelled })
        }
      }
      return { result_id: resultId, cancelled: true }
    },
  )

  // Delete a specific QA result
  app.delete<{ Params: { resultId: string } }>('/api/qa/results/:resultId', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const resultId = parseInt(request.params.resultId, 10)

    const result = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, resultId)).get()
    if (!result) { reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } }); return }
    if (isActiveQAResultStatus(result.status)) {
      reply.code(409).send({ error: { code: 'RESULT_ACTIVE', message: 'Cancel the active result before deleting it' } })
      return
    }

    // For free QA, only the owner may delete a result; template QA is shared.
    const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get()
    if (entry && entry.type === 'free' && entry.user_id !== request.user!.id && request.user!.role !== 'admin') {
      reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } }); return
    }

    db.update(schema.highlights).set({ qa_result_id: null })
      .where(eq(schema.highlights.qa_result_id, resultId)).run()
    db.delete(schema.qaResults).where(eq(schema.qaResults.id, resultId)).run()
    return { message: 'Result deleted' }
  })
}

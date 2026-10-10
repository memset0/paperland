import type { FastifyInstance } from 'fastify'
import { once } from 'events'
import { eq, and, desc, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { loadTemplates, loadTemplate } from '../services/template_loader.js'
import { askQuestion, resolveContent } from '../services/qa_service.js'
import { recordModelUsage } from '../services/model_usage.js'
import type { ModelUsage } from '../services/model_invoke.js'
import { getModelCapabilities } from '../services/model_invoke.js'
import { serviceRunner } from '../services/service_runner.js'
import { touchPaperUpdatedAt } from '../db/utils.js'
import { requireUser } from '../auth/guards.js'
import { canViewOwnedRow, ownerVisibilityFilter, parseScope, sharedFlagsFor } from '../auth/visibility.js'
import { displayName } from '../auth/nickname.js'
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
import { modelSupportsVision } from '../services/model_invoke.js'
import { buildQAInput, chainContentInputs, loadAncestorChain, QANoContentError, resolvePaperContent } from '../services/qa_formatter.js'
import { assignLabels, contentInputs, parseStoredInputs, qaInputRequestSchema, type QAInputRequestParsed } from '../services/qa_inputs.js'
import { warmCites } from '../services/s2_paper_cache.js'
import { existsSync } from 'fs'
import { systemPromptPath } from '../config.js'
import type { QAInput } from '@paperland/shared'

/** Soft-deleted Results are hidden from every user-facing read. */
const resultNotDeleted = isNull(schema.qaResults.deleted_at)

function noContentReply(reply: any) {
  reply.code(409).send({ error: { code: 'NO_CONTENT', message: 'No content available for this paper' } })
}

function uniqueNumbers(values: Array<number | null>): number[] {
  return [...new Set(values.filter((value): value is number => value != null))]
}

function loadUsernames(
  db: ReturnType<typeof getDatabase>,
  userIds: Array<number | null>,
): Map<number, { username: string; display_name: string }> {
  const ids = uniqueNumbers(userIds)
  if (ids.length === 0) return new Map()
  return new Map(
    db.select({ id: schema.users.id, username: schema.users.username, nickname: schema.users.nickname })
      .from(schema.users)
      .where(inArray(schema.users.id, ids))
      .all()
      .map((row) => [row.id, { username: row.username, display_name: displayName(row)! }]),
  )
}

function loadResultsByEntry(db: ReturnType<typeof getDatabase>, entryIds: number[]): Map<number, any[]> {
  if (entryIds.length === 0) return new Map()
  const map = new Map<number, any[]>()
  for (const result of db.select().from(schema.qaResults)
    .where(and(inArray(schema.qaResults.qa_entry_id, entryIds), resultNotDeleted))
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

/** Read visibility of a QA entry: preset is public; free follows the owner's `qa` sharing switch. */
function canViewEntry(entry: { type: string; user_id: number | null }, user: { id: number; role: string } | null | undefined): boolean {
  if (entry.type === 'template') return true
  return canViewOwnedRow(user, entry.user_id, 'qa')
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

/** Number of follow-ups of each entry that the viewer can see. */
function loadFollowupCounts(
  db: ReturnType<typeof getDatabase>,
  user: { id: number; role: string } | null | undefined,
  entryIds: number[],
): Map<number, number> {
  if (entryIds.length === 0 || !user) return new Map()
  return new Map(
    db.select({ parent: schema.qaEntries.parent_entry_id, count: sql<number>`count(*)` })
      .from(schema.qaEntries)
      .where(and(
        inArray(schema.qaEntries.parent_entry_id, entryIds),
        ownerVisibilityFilter(user, 'qa', schema.qaEntries.user_id, 'all'),
      ))
      .groupBy(schema.qaEntries.parent_entry_id)
      .all()
      .map((row) => [row.parent!, Number(row.count)]),
  )
}

/** Contextual fields every serialized entry carries. */
function entryContextFields(entry: typeof schema.qaEntries.$inferSelect, followups: Map<number, number>) {
  return {
    instruction: entry.instruction ?? null,
    inputs: parseStoredInputs(entry.inputs),
    parent_entry_id: entry.parent_entry_id ?? null,
    followup_count: followups.get(entry.id) || 0,
  }
}

/** Serialize free entries in the `/api/qa/free` feed shape (paper title, owner, results, context). */
function serializeFeedEntries(
  db: ReturnType<typeof getDatabase>,
  user: { id: number; role: string } | null | undefined,
  entries: Array<typeof schema.qaEntries.$inferSelect>,
) {
  const userId = user?.id ?? null
  const entryIds = entries.map((entry) => entry.id)
  const usernameById = loadUsernames(db, entries.map((entry) => entry.user_id))
  const sharedByOwner = sharedFlagsFor('qa', entries.map((entry) => entry.user_id))
  const resultsByEntry = loadResultsByEntry(db, entryIds)
  const preferenceByEntry = loadBackgroundPreferences(db, userId, entryIds)
  const indicators = loadQAReadingIndicators(db, userId, entries, resultsByEntry)
  const followups = loadFollowupCounts(db, user, entryIds)
  const paperIds = uniqueNumbers(entries.map((entry) => entry.paper_id))
  const paperTitleById = new Map(
    (paperIds.length === 0 ? [] : db.select({ id: schema.papers.id, title: schema.papers.title })
      .from(schema.papers).where(inArray(schema.papers.id, paperIds)).all())
      .map((paper) => [paper.id, paper.title]),
  )

  return entries.map((entry) => {
    const results = serializeResultsForEntry(resultsByEntry.get(entry.id) || [], entry, user)
    return {
      entry_id: entry.id,
      paper_id: entry.paper_id,
      paper_title: paperTitleById.get(entry.paper_id) || 'Unknown',
      status: entry.status,
      error: entry.error,
      prompt: entry.prompt || results[0]?.prompt || null,
      created_at: entry.created_at,
      user_id: entry.user_id ?? null,
      username: entry.user_id != null ? (usernameById.get(entry.user_id)?.username ?? null) : null,
      display_name: entry.user_id != null ? (usernameById.get(entry.user_id)?.display_name ?? null) : null,
      shared: entry.user_id != null ? (sharedByOwner.get(entry.user_id) ?? false) : false,
      can_manage: canManageEntry(entry, user),
      background_color: preferenceByEntry.get(entry.id) ?? null,
      highlight_count: indicators.highlightByEntry.get(entry.id) || 0,
      note_anchor_count: indicators.noteByEntry.get(entry.id) || 0,
      results,
      ...entryContextFields(entry, followups),
    }
  })
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
      const onUsage = (usage: ModelUsage) => recordModelUsage({
        category: 'qa', userId: options.requestedByUserId, sourceId: result.id, modelName, usage,
      })
      const res = await askFn(paperId, prompt, modelName, { onChunk: writer.onChunk, onUsage, signal, entryId, agentUserId: options.requestedByUserId })
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
      if (completed) {
        qaResultStreamBroker.publish(result.id, { event: 'done', result: completed })
        // Cache S2 metadata for the cited papers in the background; never affects completion.
        warmCites(res.answer).catch((error) => {
          console.warn(`Failed to warm S2 cache for #cite links (result ${result.id}):`, error)
        })
      }
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

/**
 * Start one run per model, creating Results in reverse list order so the first-listed (usually
 * strongest) model's Result is the most recently created — the default "latest" answer.
 * Runs are returned in the original list order.
 */
async function runModelsLatestFirst(
  entryId: number, paperId: number, prompt: string, modelNames: string[], userId: number,
): Promise<ScheduledQARun[]> {
  const runs: ScheduledQARun[] = []
  for (const modelName of [...modelNames].reverse()) {
    runs.unshift(await runQA(entryId, paperId, prompt, modelName, { requestedByUserId: userId }))
  }
  return runs
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

  // List free QA entries across all papers (for /qa feed page), paginated. mine (default) = own;
  // all = own + entries of users who share Q&A (admin: every user's) — see auth/visibility.ts.
  app.get<{ Querystring: { page?: string; page_size?: string; scope?: string } }>('/api/qa/free', { preHandler: requireUser }, async (request) => {
    const db = getDatabase()
    const userId = request.user!.id
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(request.query.page_size || '20', 10) || 20))
    const scope = parseScope(request.query.scope)

    const where = and(
      eq(schema.qaEntries.type, 'free'),
      ownerVisibilityFilter(request.user, 'qa', schema.qaEntries.user_id, scope),
    )
    const total = Number(db.select({ value: sql<number>`count(*)` }).from(schema.qaEntries)
      .where(where)
      .get()?.value || 0)
    const pageEntries = db.select().from(schema.qaEntries)
      .where(where)
      .orderBy(desc(schema.qaEntries.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all()

    const data = serializeFeedEntries(db, request.user, pageEntries)

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

  // List QA entries for a paper. Template QA is always public; free QA follows the uniform
  // mine/all visibility (all = own + sharing users' entries; admin: every user's).
  app.get<{ Params: { id: string }; Querystring: { scope?: string } }>('/api/papers/:id/qa', async (request) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const userId = request.user?.id ?? null
    const scope = parseScope(request.query.scope)

    const entryWhere = userId == null
      ? and(eq(schema.qaEntries.paper_id, paperId), eq(schema.qaEntries.type, 'template'))
      : and(
          eq(schema.qaEntries.paper_id, paperId),
          or(
            eq(schema.qaEntries.type, 'template'),
            and(
              eq(schema.qaEntries.type, 'free'),
              ownerVisibilityFilter(request.user, 'qa', schema.qaEntries.user_id, scope),
            ),
          ),
        )

    const entries = db.select().from(schema.qaEntries)
      .where(entryWhere)
      .orderBy(desc(schema.qaEntries.created_at))
      .all()
    const resultsByEntry = loadResultsByEntry(db, entries.map((entry) => entry.id))
    const usernameById = loadUsernames(db, entries.map((entry) => entry.user_id))
    const sharedByOwner = sharedFlagsFor('qa', entries.map((entry) => entry.user_id))
    const preferenceByEntry = loadBackgroundPreferences(db, userId, entries.map((entry) => entry.id))
    const indicators = loadQAReadingIndicators(db, userId, entries, resultsByEntry)
    const followups = loadFollowupCounts(db, request.user, entries.map((entry) => entry.id))

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
          ...entryContextFields(entry, followups),
        }
      } else if (entry.type === 'free') {
        freeEntries.push({
          entry_id: entry.id,
          status: entry.status,
          error: entry.error,
          prompt: entry.prompt || results[0]?.prompt || null,
          user_id: entry.user_id ?? null,
          username: entry.user_id != null ? (usernameById.get(entry.user_id)?.username ?? null) : null,
          display_name: entry.user_id != null ? (usernameById.get(entry.user_id)?.display_name ?? null) : null,
          shared: entry.user_id != null ? (sharedByOwner.get(entry.user_id) ?? false) : false,
          can_manage: canManageEntry(entry, request.user),
          background_color: preferenceByEntry.get(entry.id) ?? null,
          highlight_count: indicators.highlightByEntry.get(entry.id) || 0,
          note_anchor_count: indicators.noteByEntry.get(entry.id) || 0,
          results,
          ...entryContextFields(entry, followups),
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
      if (!entry || !canViewEntry(entry, request.user)) {
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
      noContentReply(reply)
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
          .where(and(eq(schema.qaResults.qa_entry_id, existing.id), eq(schema.qaResults.status, 'done'), resultNotDeleted))
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
    if (!resolvePaperContent(paper)) { noContentReply(reply); return }

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

  // Submit a free question. Optional `instruction` (system prompt name) and `inputs` (passages,
  // image-host screenshots, and at most one `history` reference to the answer a follow-up continues)
  // make it a contextual question; a body with only question/models behaves as before.
  // `direct_ask: true` (asking straight from a PDF passage/screenshot) takes exactly one passage or
  // image input; the question becomes `@<label> <qa_prompt.direct_ask.question>`, answered by
  // models.default with qa_prompt.direct_ask.system_prompt.
  app.post<{ Params: { id: string }; Body: { question?: string; models?: string[]; instruction?: string | null; inputs?: unknown[]; direct_ask?: boolean } }>(
    '/api/papers/:id/qa/free', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const { models: requestedModels, direct_ask: directAsk } = request.body || {}
    const fail = (code: number, errorCode: string, message: string) => {
      reply.code(code).send({ error: { code: errorCode, message } })
    }
    const config = getConfig()
    const rawQuestion = directAsk ? config.qa_prompt.direct_ask.question : request.body?.question
    const requestedInstruction = directAsk ? config.qa_prompt.direct_ask.system_prompt : request.body?.instruction
    const models = directAsk ? [config.models.default] : requestedModels

    if (!rawQuestion) { fail(422, 'VALIDATION_ERROR', 'Question is required'); return }

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) { fail(404, 'PAPER_NOT_FOUND', 'Paper not found'); return }
    if (!resolvePaperContent(paper)) { noContentReply(reply); return }

    const modelNames = models && models.length > 0 ? models : [config.models.default]
    const unknownModel = modelNames.find((name) => !config.models.available.some((model) => model.name === name))
    if (unknownModel) { fail(400, 'UNKNOWN_MODEL', `Unknown model: ${unknownModel}`); return }

    const parsedInputs: QAInputRequestParsed[] = []
    for (const raw of request.body?.inputs ?? []) {
      const parsed = qaInputRequestSchema.safeParse(raw)
      if (!parsed.success) { fail(400, 'INVALID_INPUT', parsed.error.issues.map((issue) => issue.message).join('; ')); return }
      parsedInputs.push(parsed.data)
    }
    const histories = parsedInputs.filter((input) => input.kind === 'history')
    if (directAsk && (parsedInputs.length !== 1 || histories.length > 0)) {
      fail(400, 'INVALID_INPUT', 'A direct ask takes exactly one passage or image input'); return
    }
    if (histories.length > 1) { fail(400, 'INVALID_INPUT', 'At most one history input is allowed'); return }

    // A follow-up continues one specific, finished, visible answer of the same paper.
    let parentEntry: typeof schema.qaEntries.$inferSelect | null = null
    if (histories[0]) {
      const parentResult = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, histories[0].result_id)).get()
      parentEntry = parentResult
        ? db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, parentResult.qa_entry_id)).get() ?? null
        : null
      if (!parentResult || !parentEntry || parentResult.deleted_at || !canViewEntry(parentEntry, request.user)) {
        fail(404, 'PARENT_NOT_FOUND', 'The answer to follow up on was not found'); return
      }
      if (parentEntry.paper_id !== paperId) { fail(400, 'INVALID_INPUT', 'A follow-up must belong to the same paper'); return }
      if (parentResult.status !== 'done') { fail(409, 'PARENT_NOT_DONE', 'Only a completed answer can be followed up'); return }
    }

    const instruction = requestedInstruction || parentEntry?.instruction || null
    if (instruction && !existsSync(systemPromptPath(config.qa_prompt.system_prompts_dir!, instruction))) {
      fail(400, 'UNKNOWN_INSTRUCTION', `Unknown system prompt: ${instruction}`); return
    }

    // Images must already live in the built-in image host; the stored URL comes from its record.
    const imageRows = new Map<string, typeof schema.images.$inferSelect>()
    for (const input of parsedInputs) {
      if (input.kind !== 'image') continue
      const image = db.select().from(schema.images).where(eq(schema.images.hash, input.image_hash)).get()
      if (!image) { fail(400, 'IMAGE_NOT_IN_HOST', `Image ${input.image_hash} is not in the image host`); return }
      imageRows.set(input.image_hash, image)
    }

    const chain = parentEntry ? [...loadAncestorChain(db, parentEntry), { entry: parentEntry }] : []
    const ancestorInputs = chain.flatMap((turn) => contentInputs(parseStoredInputs(turn.entry.inputs)))
    const labelled = assignLabels(ancestorInputs, parsedInputs.filter((input) => input.kind !== 'history') as any[])
    const ancestorLabels = new Set(ancestorInputs.map((input) => input.label))
    let question = rawQuestion
    const inputs: QAInput[] = []
    if (histories[0]) inputs.push({ kind: 'history', result_id: histories[0].result_id })
    labelled.forEach((input: any, index) => {
      const original = (parsedInputs.filter((item) => item.kind !== 'history')[index] as any).label?.replace(/^@/, '')
      // Retarget the question's tokens to a relabelled input, unless the old label names an
      // ancestor input (then the tokens already mean that earlier input).
      if (original && original !== input.label && !ancestorLabels.has(original)) {
        question = question.replace(new RegExp(`@${original}\\b`, 'g'), `@${input.label}`)
      }
      if (input.kind === 'image') {
        inputs.push({ kind: 'image', label: input.label, image_hash: input.image_hash, url: `/image/${imageRows.get(input.image_hash)!.path}`, pdf: input.pdf ?? null })
      } else {
        inputs.push({ kind: 'text_selection', label: input.label, text: input.text, pdf: input.pdf })
      }
    })

    if (directAsk) {
      const label = (inputs.find((input) => input.kind !== 'history') as { label: string }).label
      question = `@${label} ${rawQuestion}`
    }

    // Every chain image is sent to the model, so all selected models must accept images.
    const hasImage = [...ancestorInputs, ...inputs].some((input) => input.kind === 'image')
    const nonVision = hasImage ? modelNames.find((name) => !modelSupportsVision(name)) : undefined
    if (nonVision) { fail(400, 'MODEL_NOT_VISION', `Model ${nonVision} does not accept image input`); return }

    const entry = db.insert(schema.qaEntries).values({
      paper_id: paperId, type: 'free', user_id: request.user!.id, prompt: question,
      status: 'pending', created_at: new Date().toISOString(),
      instruction,
      inputs: inputs.length > 0 ? JSON.stringify(inputs) : null,
      parent_entry_id: parentEntry?.id ?? null,
    }).returning().get()

    touchPaperUpdatedAt(db, paperId)

    const runs = await runModelsLatestFirst(entry.id, paperId, question, modelNames, request.user!.id)
    return { entry_id: entry.id, models: modelNames, runs, inputs, question, message: 'Question submitted' }
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
    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, entry.paper_id)).get()
    if (!paper || !resolvePaperContent(paper)) { noContentReply(reply); return }
    const chainHasImage = chainContentInputs(loadAncestorChain(db, entry), parseStoredInputs(entry.inputs))
      .some((input) => input.kind === 'image')
    const nonVision = chainHasImage ? modelNames.find((name) => {
      try { return !modelSupportsVision(name) } catch { return true }
    }) : undefined
    if (nonVision) {
      reply.code(400).send({ error: { code: 'MODEL_NOT_VISION', message: `Model ${nonVision} does not accept image input` } })
      return
    }

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
          .orderBy(desc(schema.qaResults.created_at), desc(schema.qaResults.id))
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

    const runs = await runModelsLatestFirst(entryId, entry.paper_id, prompt, modelNames, request.user!.id)

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
      const initial = db.select().from(schema.qaResults)
        .where(and(eq(schema.qaResults.id, resultId), resultNotDeleted)).get()
      if (!initial) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } })
        return
      }
      const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, initial.qa_entry_id)).get()
      // A non-shared Result is indistinguishable from a missing one.
      if (!entry || !canViewEntry(entry, request.user)) {
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
      const result = db.select().from(schema.qaResults)
        .where(and(eq(schema.qaResults.id, resultId), resultNotDeleted)).get()
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

  // The whole follow-up tree containing an entry, from its root. Nodes the viewer cannot see, or
  // whose answers were all deleted, are placeholders without content.
  app.get<{ Params: { entryId: string } }>('/api/qa/entries/:entryId/tree', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const start = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, parseInt(request.params.entryId, 10))).get()
    if (!start || !canViewEntry(start, request.user)) {
      reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA entry not found' } }); return
    }
    let root = start
    const seen = new Set([root.id])
    while (root.parent_entry_id != null) {
      const parent = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, root.parent_entry_id)).get()
      if (!parent || seen.has(parent.id)) break
      seen.add(parent.id)
      root = parent
    }

    const all = [root]
    const collected = new Set([root.id])
    let frontier = [root.id]
    while (frontier.length > 0) {
      const children = db.select().from(schema.qaEntries)
        .where(inArray(schema.qaEntries.parent_entry_id, frontier))
        .orderBy(schema.qaEntries.created_at, schema.qaEntries.id).all()
        .filter((child) => !collected.has(child.id))
      children.forEach((child) => collected.add(child.id))
      all.push(...children)
      frontier = children.map((child) => child.id)
    }

    const visible = all.filter((entry) => canViewEntry(entry, request.user))
    const serialized = new Map(serializeFeedEntries(db, request.user, visible).map((entry) => [entry.entry_id, entry]))
    const allResultsDeleted = new Set(
      db.select({ entry_id: schema.qaResults.qa_entry_id, live: sql<number>`sum(case when ${schema.qaResults.deleted_at} is null then 1 else 0 end)` })
        .from(schema.qaResults).where(inArray(schema.qaResults.qa_entry_id, all.map((entry) => entry.id)))
        .groupBy(schema.qaResults.qa_entry_id).all()
        .filter((row) => Number(row.live) === 0).map((row) => row.entry_id),
    )
    const build = (entry: typeof schema.qaEntries.$inferSelect): any => {
      const state = !canViewEntry(entry, request.user) ? 'hidden' : allResultsDeleted.has(entry.id) ? 'deleted' : 'visible'
      const history = parseStoredInputs(entry.inputs).find((input) => input.kind === 'history')
      return {
        entry_id: entry.id,
        parent_result_id: history && history.kind === 'history' ? history.result_id : null,
        state,
        entry: state === 'visible' ? serialized.get(entry.id) ?? null : null,
        children: all.filter((child) => child.parent_entry_id === entry.id && child.id !== root.id).map(build),
      }
    }
    return { data: build(root) }
  })

  // Resolve a `paperland://paper/<pid>?qa=<entryId>[&result=<resultId>]` link by the entry alone.
  app.get<{ Params: { entryId: string }; Querystring: { result?: string } }>('/api/qa/entries/:entryId/locate', async (request) => {
    const db = getDatabase()
    const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, parseInt(request.params.entryId, 10))).get()
    if (!entry) return { state: 'deleted' }
    if (!canViewEntry(entry, request.user)) return { state: 'hidden' }
    const resultId = request.query.result ? parseInt(request.query.result, 10) : null
    if (resultId != null) {
      const result = db.select({ id: schema.qaResults.id, deleted_at: schema.qaResults.deleted_at })
        .from(schema.qaResults)
        .where(and(eq(schema.qaResults.id, resultId), eq(schema.qaResults.qa_entry_id, entry.id))).get()
      if (!result || result.deleted_at) return { state: 'deleted', entry_id: entry.id, paper_id: entry.paper_id, type: entry.type, template_name: entry.template_name }
    }
    return { state: 'visible', entry_id: entry.id, result_id: resultId, paper_id: entry.paper_id, type: entry.type, template_name: entry.template_name }
  })

  // Rebuild (never stored) what a model would receive for this answer with the current system
  // prompt, paper content, references, inputs, and history. The paper text is only summarized.
  app.get<{ Params: { resultId: string } }>('/api/qa/results/:resultId/model-input', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const result = db.select().from(schema.qaResults)
      .where(and(eq(schema.qaResults.id, parseInt(request.params.resultId, 10)), resultNotDeleted)).get()
    const entry = result ? db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get() : null
    if (!result || !entry || !canViewEntry(entry, request.user)) {
      reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } }); return
    }
    const question = entry.type === 'template' && entry.template_name
      ? (loadTemplate(entry.template_name)?.prompt ?? entry.prompt ?? result.prompt)
      : (entry.prompt || result.prompt)
    try {
      return { data: buildQAInput(db, entry, question).view }
    } catch (error) {
      if (error instanceof QANoContentError) { noContentReply(reply); return }
      throw error
    }
  })

  // Delete a specific QA result
  app.delete<{ Params: { resultId: string } }>('/api/qa/results/:resultId', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const resultId = parseInt(request.params.resultId, 10)

    const result = db.select().from(schema.qaResults)
      .where(and(eq(schema.qaResults.id, resultId), resultNotDeleted)).get()
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

    // Soft delete: the row stays so follow-ups keep their history; every user-facing read skips it.
    const now = new Date().toISOString()
    db.update(schema.highlights).set({ qa_result_id: null })
      .where(eq(schema.highlights.qa_result_id, resultId)).run()
    db.update(schema.qaResults).set({ deleted_at: now, updated_at: now })
      .where(eq(schema.qaResults.id, resultId)).run()
    recomputeQAEntryState(db, result.qa_entry_id)
    return { message: 'Result deleted' }
  })
}

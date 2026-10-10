import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import type { ResearchPaperList, ResearchSeed, ResearchStep, ResearchStepStatus } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { Semaphore } from './semaphore.js'
import { RateLimiter } from './rate_limiter.js'
import { QAResultStreamBroker } from './qa_result_stream.js'
import { callModel, type ModelInput, type ModelInvokeOptions, type ModelUsage } from './model_invoke.js'
import { recordModelUsage } from './model_usage.js'
import { buildRepairInput, buildResearchInput, type HistoryStep } from './research_prompt.js'
import { attachAgentTools } from './agent_attach.js'
import { mergeRepairedAnswer, parseRoundAnswer, type ParsedRoundAnswer } from './research_list.js'

// Deep Research rounds run like QA Results (see api/qa.ts `runQA`): lifecycle queued →
// awaiting_output → streaming → done | failed | cancelled, partial output persisted in 200 ms batches
// and broadcast to SSE observers. They are scheduled here rather than via
// `serviceRunner.executePureService`, whose `service_executions` rows require a paper; concurrency
// and spacing still come from `services.research` (max_concurrency / rate_limit_interval). The list in a finished answer
// is parsed/verified BEFORE the step is marked done, so observers never see a done step without
// its list.

type Database = ReturnType<typeof getDatabase>
type StepRow = typeof schema.researchSteps.$inferSelect

export const RESEARCH_ACTIVE_STATUSES: ResearchStepStatus[] = ['queued', 'awaiting_output', 'streaming']
export const RESEARCH_SERVICE_NAME = 'research'

/** SSE broadcast for research steps (own instance: step ids must not collide with QA result ids). */
export const researchStepStreamBroker = new QAResultStreamBroker()

export function isActiveStatus(status: string): boolean {
  return (RESEARCH_ACTIVE_STATUSES as string[]).includes(status)
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export function serializeStep(row: StepRow): ResearchStep {
  return {
    id: row.id,
    session_id: row.session_id,
    step_index: row.step_index,
    kind: row.kind as ResearchStep['kind'],
    user_text: row.user_text,
    model_name: row.model_name,
    status: row.status as ResearchStepStatus,
    answer: row.answer,
    report: row.report,
    changes_note: row.changes_note,
    paper_list: parseJson<ResearchPaperList>(row.paper_list),
    parse_error: row.parse_error,
    repaired: row.repaired === 1,
    error: row.error,
    created_at: row.created_at,
    started_at: row.started_at,
    first_chunk_at: row.first_chunk_at,
    finished_at: row.finished_at,
    updated_at: row.updated_at,
  }
}

function touchSession(db: Database, sessionId: number, now: string) {
  db.update(schema.researchSessions).set({ updated_at: now }).where(eq(schema.researchSessions.id, sessionId)).run()
}

function updateStepIfActive(db: Database, stepId: number, values: Partial<typeof schema.researchSteps.$inferInsert>) {
  return db.update(schema.researchSteps)
    .set(values)
    .where(and(eq(schema.researchSteps.id, stepId), inArray(schema.researchSteps.status, RESEARCH_ACTIVE_STATUSES)))
    .returning()
    .get()
}

function createPartialWriter(db: Database, stepId: number, batchMs: number) {
  let pending = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false

  const flush = () => {
    if (!pending) return
    const delta = pending
    pending = ''
    const updated = db.update(schema.researchSteps)
      .set({ answer: sql`${schema.researchSteps.answer} || ${delta}`, updated_at: new Date().toISOString() })
      .where(and(eq(schema.researchSteps.id, stepId), inArray(schema.researchSteps.status, ['awaiting_output', 'streaming'])))
      .returning()
      .get()
    if (!updated) return
    researchStepStreamBroker.publish(stepId, {
      event: 'delta',
      result_id: stepId,
      delta,
      answer_length: updated.answer.length,
      first_chunk_at: updated.first_chunk_at,
      thinking_duration_ms: null,
    })
  }

  const onChunk = (delta: string) => {
    if (!delta) return
    if (!started) {
      started = true
      const now = new Date().toISOString()
      const transitioned = db.update(schema.researchSteps)
        .set({ status: 'streaming', first_chunk_at: now, updated_at: now })
        .where(and(eq(schema.researchSteps.id, stepId), eq(schema.researchSteps.status, 'awaiting_output')))
        .returning()
        .get()
      if (!transitioned) return
      researchStepStreamBroker.publish(stepId, { event: 'start', result: serializeStep(transitioned) })
    }
    pending += delta
    if (!timer) {
      timer = setTimeout(() => { timer = null; flush() }, batchMs)
      timer.unref?.()
    }
  }

  const flushNow = () => {
    if (timer) { clearTimeout(timer); timer = null }
    flush()
  }

  return { onChunk, flushNow }
}

/** Model input for a step: topic, seed, every earlier step, and the version current before it. */
export function buildStepInput(db: Database, step: StepRow): Promise<ModelInput> {
  const session = db.select().from(schema.researchSessions).where(eq(schema.researchSessions.id, step.session_id)).get()
  if (!session) throw new Error(`Research session ${step.session_id} not found`)
  const earlier = db.select().from(schema.researchSteps)
    .where(and(eq(schema.researchSteps.session_id, step.session_id), lt(schema.researchSteps.step_index, step.step_index)))
    .orderBy(asc(schema.researchSteps.step_index))
    .all()
  const history: HistoryStep[] = earlier
    .filter((s) => s.kind === 'title_edit' || !isActiveStatus(s.status))
    .map((s) => ({
      step_index: s.step_index,
      kind: s.kind as HistoryStep['kind'],
      user_text: s.user_text,
      changes_note: s.changes_note,
      status: s.status as NonNullable<HistoryStep['status']>,
    }))
  const versions = earlier.filter((s) => s.paper_list && s.report)
  const latest = versions[versions.length - 1]
  const list = latest ? parseJson<ResearchPaperList>(latest.paper_list) : null
  return buildResearchInput({
    topic: session.topic,
    seed: parseJson<ResearchSeed>(session.seed),
    history,
    current: latest && list ? { report: latest.report!, list } : null,
    request: step.user_text ?? '',
  })
}

/** Attach every Paperland agent tool and the skill directory to a round (see `agent_attach.ts`). */
export function attachResearchTools(input: ModelInput, ownerId: number): void {
  attachAgentTools(input, ownerId, { skills: true })
}

// Scheduler state: one semaphore + rate limiter for all research rounds (created on first use from
// `services.research`), and the abort controller of every queued/running step.
let semaphore: Semaphore | null = null
let rateLimiter: RateLimiter | null = null
const controllers = new Map<number, AbortController>()

function scheduler(): { sem: Semaphore; rl: RateLimiter } {
  if (!semaphore || !rateLimiter) {
    const svc = getConfig().services[RESEARCH_SERVICE_NAME]
    semaphore = new Semaphore(svc?.max_concurrency ?? 1)
    rateLimiter = new RateLimiter((svc?.rate_limit_interval ?? 0) * 1000)
  }
  return { sem: semaphore, rl: rateLimiter }
}

/** Test hook: drop the scheduler so the next round re-reads `services.research`. */
export function resetResearchSchedulerForTesting(): void {
  semaphore = null
  rateLimiter = null
  controllers.clear()
}

export interface RunStepOptions {
  callModelFn?: (input: ModelInput, modelName: string, options: ModelInvokeOptions) => Promise<string>
  parseFn?: (answer: string) => Promise<ParsedRoundAnswer>
  batchMs?: number
}

/**
 * Schedule a queued agent step in the background. The step row must already exist (status
 * `queued`, answer empty). Returns immediately.
 */
export function scheduleAgentStep(stepId: number, options: RunStepOptions = {}): void {
  const controller = new AbortController()
  controllers.set(stepId, controller)
  void runAgentStep(stepId, controller.signal, options)
    .catch(() => {}) // outcome is recorded on the step row
    .finally(() => {
      if (controllers.get(stepId) === controller) controllers.delete(stepId)
      // The round has ended (done / failed / cancelled): send what the owner queued meanwhile.
      const row = getDatabase().select({ session_id: schema.researchSteps.session_id }).from(schema.researchSteps)
        .where(eq(schema.researchSteps.id, stepId)).get()
      if (row) {
        try { dispatchQueuedMessages(row.session_id, options) } catch (err) {
          console.error(`Research session ${row.session_id}: failed to dispatch queued messages:`, err)
        }
      }
    })
}

/**
 * If the session has queued messages and no active round, merge them (in enqueue order, joined by
 * newlines) into one new agent round using `modelName` or else the latest message's model, delete
 * them, and start the round. The round is created now; enqueue times are dropped. Returns the new
 * step id, or null.
 */
export function dispatchQueuedMessages(sessionId: number, options: RunStepOptions = {}, modelName?: string): number | null {
  const db = getDatabase()
  const stepId = db.transaction((tx) => {
    const active = tx.select({ id: schema.researchSteps.id }).from(schema.researchSteps)
      .where(and(eq(schema.researchSteps.session_id, sessionId), inArray(schema.researchSteps.status, RESEARCH_ACTIVE_STATUSES)))
      .get()
    if (active) return null
    const queued = tx.select().from(schema.researchQueuedMessages)
      .where(eq(schema.researchQueuedMessages.session_id, sessionId))
      .orderBy(asc(schema.researchQueuedMessages.id)).all()
    if (queued.length === 0) return null
    const last = tx.select({ step_index: schema.researchSteps.step_index }).from(schema.researchSteps)
      .where(eq(schema.researchSteps.session_id, sessionId))
      .orderBy(desc(schema.researchSteps.step_index)).limit(1).get()
    const now = new Date().toISOString()
    const step = tx.insert(schema.researchSteps).values({
      session_id: sessionId,
      step_index: (last?.step_index ?? 0) + 1,
      kind: 'agent',
      user_text: queued.map((m) => m.text).join('\n'),
      model_name: modelName ?? queued[queued.length - 1].model_name,
      status: 'queued',
      answer: '',
      created_at: now,
      updated_at: now,
    }).returning().get()
    tx.delete(schema.researchQueuedMessages)
      .where(inArray(schema.researchQueuedMessages.id, queued.map((m) => m.id))).run()
    tx.update(schema.researchSessions).set({ updated_at: now }).where(eq(schema.researchSessions.id, sessionId)).run()
    return step.id
  })
  if (stepId != null) scheduleAgentStep(stepId, options)
  return stepId
}

/** On startup: send the queues of the sessions whose round the restart interrupted (idle queues wait). */
export function dispatchQueuedMessagesFor(sessionIds: number[], options: RunStepOptions = {}): number {
  return [...new Set(sessionIds)].filter((id) => dispatchQueuedMessages(id, options) != null).length
}

async function runAgentStep(stepId: number, signal: AbortSignal, options: RunStepOptions): Promise<void> {
  const db = getDatabase()
  const callModelFn = options.callModelFn ?? callModel
  const parseFn = options.parseFn ?? parseRoundAnswer
  const batchMs = options.batchMs ?? 200
  const { sem, rl } = scheduler()

  const step = db.select().from(schema.researchSteps).where(eq(schema.researchSteps.id, stepId)).get()
  if (!step) return
  let acquired = false
  try {
    await sem.acquire(signal)
    acquired = true
    await rl.waitIfNeeded(signal)
    const startedAt = new Date().toISOString()
    const awaiting = updateStepIfActive(db, stepId, { status: 'awaiting_output', started_at: startedAt, updated_at: startedAt })
    if (!awaiting) return
    researchStepStreamBroker.publish(stepId, { event: 'start', result: serializeStep(awaiting) })

    const writer = createPartialWriter(db, stepId, batchMs)
    try {
      const input = await buildStepInput(db, step)
      const session = db.select({ user_id: schema.researchSessions.user_id }).from(schema.researchSessions)
        .where(eq(schema.researchSessions.id, step.session_id)).get()
      if (session) attachResearchTools(input, session.user_id)
      // Round and repair calls each record their own usage row for this step.
      const onUsage = (usage: ModelUsage) => recordModelUsage({
        category: 'research', userId: session?.user_id, sourceId: stepId, modelName: step.model_name!, usage,
      })
      const answer = await callModelFn(input, step.model_name!, {
        onChunk: writer.onChunk,
        onUsage,
        onToolCall: (e) => researchStepStreamBroker.publish(stepId, { event: 'tool', result_id: stepId, ...e }),
        signal,
      })
      writer.flushNow()
      // Parse + verify while still active (observers keep showing the list placeholder).
      let parsed = await parseFn(answer)
      let repaired = false
      if (parsed.failure && !signal.aborted) {
        // One automatic repair with the same model (no streaming, no web search). Errors from the
        // repair request leave the original failure in place; cancellation still aborts the round.
        const repairing = db.select().from(schema.researchSteps).where(eq(schema.researchSteps.id, stepId)).get()
        if (repairing) researchStepStreamBroker.publish(stepId, { event: 'repairing', result: serializeStep(repairing) })
        try {
          const fixed = await callModelFn(buildRepairInput(answer, parsed.failure, parsed.parse_error ?? ''), step.model_name!, { signal, onUsage })
          const second = await parseFn(mergeRepairedAnswer(answer, fixed, parsed.failure))
          if (!second.failure) {
            parsed = second
            repaired = true
          }
        } catch (err: any) {
          if (signal.aborted || err?.name === 'AbortError') throw err
          console.warn(`Research step ${stepId}: repair request failed:`, err?.message || err)
        }
      }
      if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
      const finishedAt = new Date().toISOString()
      const done = updateStepIfActive(db, stepId, {
        status: 'done',
        answer,
        report: parsed.report,
        changes_note: parsed.changes_note,
        paper_list: parsed.paper_list ? JSON.stringify(parsed.paper_list) : null,
        parse_error: parsed.parse_error,
        repaired: repaired ? 1 : 0,
        error: null,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      touchSession(db, step.session_id, finishedAt)
      if (done) researchStepStreamBroker.publish(stepId, { event: 'done', result: serializeStep(done) })
    } catch (reason: unknown) {
      writer.flushNow()
      const err = reason instanceof Error ? reason : new Error(String(reason))
      const cancelled = signal.aborted || err.name === 'AbortError'
      const finishedAt = new Date().toISOString()
      const failed = updateStepIfActive(db, stepId, {
        status: cancelled ? 'cancelled' : 'failed',
        error: cancelled ? 'cancelled by user' : err.message,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      touchSession(db, step.session_id, finishedAt)
      console.error(`Research step ${stepId} ${cancelled ? 'cancelled' : 'failed'}:`, err.message)
      if (failed) researchStepStreamBroker.publish(stepId, { event: 'error', result: serializeStep(failed) })
    }
  } catch (reason: unknown) {
    // Cancelled (or failed) before the model call started, e.g. while waiting for a slot.
    const err = reason instanceof Error ? reason : new Error(String(reason))
    const cancelled = signal.aborted || err.name === 'AbortError'
    const finishedAt = new Date().toISOString()
    const ended = updateStepIfActive(db, stepId, {
      status: cancelled ? 'cancelled' : 'failed',
      error: cancelled ? 'cancelled by user' : err.message,
      finished_at: finishedAt,
      updated_at: finishedAt,
    })
    if (ended) researchStepStreamBroker.publish(stepId, { event: 'error', result: serializeStep(ended) })
  } finally {
    if (acquired) sem.release()
  }
}

/** Cancel an active step. Returns false when it is not active (anymore). */
export function cancelStep(step: StepRow): boolean {
  if (!isActiveStatus(step.status)) return false
  const controller = controllers.get(step.id)
  if (controller) {
    controller.abort()
    return true
  }
  // No live run (should not happen outside a restart race): mark the row directly.
  const now = new Date().toISOString()
  const cancelled = updateStepIfActive(getDatabase(), step.id, { status: 'cancelled', error: 'cancelled by user', finished_at: now, updated_at: now })
  if (cancelled) researchStepStreamBroker.publish(step.id, { event: 'error', result: serializeStep(cancelled) })
  return !!cancelled
}

/**
 * On startup: steps left active by a restart can never finish; mark them failed. Returns the ids of
 * the sessions they belong to (their queued messages are sent once the server is up).
 */
export function recoverInterruptedResearchSteps(db: Database, now = new Date().toISOString()): number[] {
  const stale = db.select({ id: schema.researchSteps.id, session_id: schema.researchSteps.session_id }).from(schema.researchSteps)
    .where(inArray(schema.researchSteps.status, RESEARCH_ACTIVE_STATUSES)).all()
  if (stale.length === 0) return []
  db.update(schema.researchSteps)
    .set({ status: 'failed', error: 'interrupted by server restart', finished_at: now, updated_at: now })
    .where(inArray(schema.researchSteps.id, stale.map((s) => s.id)))
    .run()
  return [...new Set(stale.map((s) => s.session_id))]
}

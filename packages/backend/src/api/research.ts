import type { FastifyInstance, FastifyReply } from 'fastify'
import { once } from 'events'
import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm'
import type { ResearchPaperList, ResearchSeed, ResearchSessionDetail, ResearchSessionSummary, ResearchStepStatus } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { requireUser } from '../auth/guards.js'
import { canViewOwnedRow, ownerVisibilityFilter, parseScope } from '../auth/visibility.js'
import { displayName } from '../auth/nickname.js'
import {
  cancelStep,
  dispatchQueuedMessages,
  isActiveStatus,
  RESEARCH_ACTIVE_STATUSES,
  researchStepStreamBroker,
  scheduleAgentStep,
  serializeStep,
  type RunStepOptions,
} from '../services/research_runtime.js'
import { applyTitleEdit, describeTitleEdit, listTitle, TitleEditError } from '../services/research_list.js'

// Deep Research sessions (/research). A session's history is a linear sequence of steps — agent
// rounds and owner title edits — each step with a list producing a new version. Visibility uses the
// optionally-shared `research` type (private by default); only the owner changes a session, and the
// owner or an admin may delete it.

type Db = ReturnType<typeof getDatabase>
type SessionRow = typeof schema.researchSessions.$inferSelect
type StepRow = typeof schema.researchSteps.$inferSelect
type Viewer = { id: number; role: string }

const TOPIC_TITLE_LENGTH = 80

// Test hook: model calls / list parsing are injected in tests.
let runOptions: RunStepOptions = {}
export function setResearchRunOptionsForTesting(options: RunStepOptions): void {
  runOptions = options
}

function errorReply(reply: FastifyReply, code: number, errCode: string, message: string) {
  return reply.code(code).send({ error: { code: errCode, message } })
}

function parseList(raw: string | null): ResearchPaperList | null {
  if (!raw) return null
  try { return JSON.parse(raw) as ResearchPaperList } catch { return null }
}

function topicTitle(topic: string): string {
  const oneLine = topic.replace(/\s+/g, ' ').trim()
  return oneLine.length > TOPIC_TITLE_LENGTH ? `${oneLine.slice(0, TOPIC_TITLE_LENGTH - 1)}…` : oneLine
}

function loadSteps(db: Db, sessionIds: number[]): Map<number, StepRow[]> {
  const map = new Map<number, StepRow[]>()
  if (sessionIds.length === 0) return map
  for (const step of db.select().from(schema.researchSteps)
    .where(inArray(schema.researchSteps.session_id, sessionIds))
    .orderBy(asc(schema.researchSteps.step_index)).all()) {
    const list = map.get(step.session_id) ?? []
    list.push(step)
    map.set(step.session_id, list)
  }
  return map
}

function ownerNames(db: Db, ids: number[]): Map<number, string> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  return new Map(db.select({ id: schema.users.id, username: schema.users.username, nickname: schema.users.nickname })
    .from(schema.users).where(inArray(schema.users.id, unique)).all()
    .map((row) => [row.id, displayName(row) ?? row.username]))
}

/** Last step that produced a list (the current version), if any. */
function currentVersionStep(steps: StepRow[]): StepRow | null {
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i].paper_list) return steps[i]
  return null
}

function summarize(session: SessionRow, steps: StepRow[], owner: string): ResearchSessionSummary {
  const current = currentVersionStep(steps)
  const list = current ? parseList(current.paper_list) : null
  return {
    id: session.id,
    user_id: session.user_id,
    owner_name: owner,
    topic: session.topic,
    title: list ? listTitle(list) : topicTitle(session.topic),
    step_count: steps.length,
    version_count: steps.filter((s) => s.paper_list).length,
    latest_status: (steps[steps.length - 1]?.status as ResearchStepStatus | undefined) ?? null,
    created_at: session.created_at,
    updated_at: session.updated_at,
  }
}

function detail(db: Db, session: SessionRow, viewer: Viewer): ResearchSessionDetail {
  const steps = loadSteps(db, [session.id]).get(session.id) ?? []
  const owner = ownerNames(db, [session.user_id]).get(session.user_id) ?? ''
  let seed: ResearchSeed | null = null
  try { seed = session.seed ? JSON.parse(session.seed) : null } catch { seed = null }
  return {
    ...summarize(session, steps, owner),
    seed,
    steps: steps.map(serializeStep),
    can_edit: session.user_id === viewer.id,
    can_delete: session.user_id === viewer.id || viewer.role === 'admin',
    queued_messages: session.user_id === viewer.id
      ? db.select({
        id: schema.researchQueuedMessages.id,
        text: schema.researchQueuedMessages.text,
        model_name: schema.researchQueuedMessages.model_name,
        created_at: schema.researchQueuedMessages.created_at,
      }).from(schema.researchQueuedMessages)
        .where(eq(schema.researchQueuedMessages.session_id, session.id))
        .orderBy(asc(schema.researchQueuedMessages.id)).all()
      : [],
  }
}

/** The session if the viewer may see it (owner, admin, or owner shares `research`); else null. */
function loadVisibleSession(db: Db, id: number, viewer: Viewer): SessionRow | null {
  if (!Number.isInteger(id)) return null
  const session = db.select().from(schema.researchSessions).where(eq(schema.researchSessions.id, id)).get()
  if (!session || !canViewOwnedRow(viewer, session.user_id, 'research')) return null
  return session
}

function hasActiveStep(db: Db, sessionId: number): boolean {
  return !!db.select({ id: schema.researchSteps.id }).from(schema.researchSteps)
    .where(and(eq(schema.researchSteps.session_id, sessionId), inArray(schema.researchSteps.status, RESEARCH_ACTIVE_STATUSES)))
    .get()
}

function lastStep(db: Db, sessionId: number): StepRow | undefined {
  return db.select().from(schema.researchSteps).where(eq(schema.researchSteps.session_id, sessionId))
    .orderBy(desc(schema.researchSteps.step_index)).limit(1).get()
}

/** Validate a research model name: must be configured with `type: codex`. Returns an error message. */
export function codexModelError(modelName: unknown): string | null {
  const models = getConfig().models.available
  if (!models.some((m) => m.type === 'codex')) return 'No Codex model is configured; Deep Research requires a Codex model'
  if (typeof modelName !== 'string' || !modelName) return 'model_name is required'
  const model = models.find((m) => m.name === modelName)
  if (!model) return `Unknown model: ${modelName}`
  if (model.type !== 'codex') return `Deep Research only supports Codex models (${modelName} is ${model.type})`
  return null
}

function textField(body: any, key: string): string | null {
  const value = body?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Snapshot of a QA Result the viewer can see, for a session seed. Null when not visible/missing. */
function seedFromQAResult(db: Db, resultId: number, viewer: Viewer): ResearchSeed | null {
  const result = db.select().from(schema.qaResults)
    .where(and(eq(schema.qaResults.id, resultId), isNull(schema.qaResults.deleted_at))).get()
  if (!result || result.status !== 'done') return null
  const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get()
  if (!entry) return null
  if (entry.type !== 'template' && !canViewOwnedRow(viewer, entry.user_id, 'qa')) return null
  const paper = db.select({ id: schema.papers.id, title: schema.papers.title }).from(schema.papers)
    .where(eq(schema.papers.id, entry.paper_id)).get()
  return {
    qa_result_id: result.id,
    qa_entry_id: entry.id,
    paper_id: entry.paper_id,
    paper_title: paper?.title ?? '',
    question: entry.prompt ?? result.prompt,
    answer: result.answer,
    model_name: result.model_name,
  }
}

function insertAgentStep(db: Db, sessionId: number, stepIndex: number, userText: string, modelName: string): StepRow {
  const now = new Date().toISOString()
  return db.insert(schema.researchSteps).values({
    session_id: sessionId,
    step_index: stepIndex,
    kind: 'agent',
    user_text: userText,
    model_name: modelName,
    status: 'queued',
    answer: '',
    created_at: now,
    updated_at: now,
  }).returning().get()
}

export async function researchRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/research?scope=mine|all — session summaries, newest activity first
  app.get<{ Querystring: { scope?: string } }>('/api/research', { preHandler: requireUser }, async (request) => {
    const db = getDatabase()
    const viewer = request.user!
    const filter = ownerVisibilityFilter(viewer, 'research', schema.researchSessions.user_id, parseScope(request.query.scope))
    const sessions = db.select().from(schema.researchSessions).where(filter)
      .orderBy(desc(schema.researchSessions.updated_at), desc(schema.researchSessions.id)).all()
    const steps = loadSteps(db, sessions.map((s) => s.id))
    const owners = ownerNames(db, sessions.map((s) => s.user_id))
    return { data: sessions.map((s) => summarize(s, steps.get(s.id) ?? [], owners.get(s.user_id) ?? '')) }
  })

  // GET /api/research/seed-preview?result_id= — what a session started from this QA answer would copy
  app.get<{ Querystring: { result_id?: string } }>('/api/research/seed-preview', { preHandler: requireUser }, async (request, reply) => {
    const seed = seedFromQAResult(getDatabase(), Number(request.query.result_id), request.user!)
    if (!seed) return errorReply(reply, 404, 'NOT_FOUND', 'QA answer not found')
    return { data: seed }
  })

  // POST /api/research — create a session and start its first round with the topic
  app.post<{ Body: { topic?: string; model_name?: string; seed_result_id?: number } }>(
    '/api/research', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const viewer = request.user!
      const topic = textField(request.body, 'topic')
      if (!topic) return errorReply(reply, 400, 'VALIDATION_ERROR', 'topic is required')
      const modelError = codexModelError(request.body?.model_name)
      if (modelError) return errorReply(reply, 400, 'VALIDATION_ERROR', modelError)
      let seed: ResearchSeed | null = null
      if (request.body?.seed_result_id != null) {
        seed = seedFromQAResult(db, Number(request.body.seed_result_id), viewer)
        if (!seed) return errorReply(reply, 404, 'NOT_FOUND', 'QA answer not found')
      }
      const now = new Date().toISOString()
      const session = db.insert(schema.researchSessions).values({
        user_id: viewer.id,
        topic,
        seed: seed ? JSON.stringify(seed) : null,
        created_at: now,
        updated_at: now,
      }).returning().get()
      const step = insertAgentStep(db, session.id, 1, topic, request.body!.model_name!)
      await scheduleAgentStep(step.id, runOptions)
      return reply.code(201).send({ data: detail(db, session, viewer) })
    })

  // GET /api/research/:id — session detail with every step
  app.get<{ Params: { id: string } }>('/api/research/:id', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const session = loadVisibleSession(db, Number(request.params.id), request.user!)
    if (!session) return errorReply(reply, 404, 'NOT_FOUND', 'Research session not found')
    return { data: detail(db, session, request.user!) }
  })

  // DELETE /api/research/:id — owner or admin; cancels an active round first
  app.delete<{ Params: { id: string } }>('/api/research/:id', { preHandler: requireUser }, async (request, reply) => {
    const db = getDatabase()
    const viewer = request.user!
    const session = loadVisibleSession(db, Number(request.params.id), viewer)
    if (!session) return errorReply(reply, 404, 'NOT_FOUND', 'Research session not found')
    if (session.user_id !== viewer.id && viewer.role !== 'admin') return errorReply(reply, 403, 'FORBIDDEN', 'Only the owner or an admin can delete this session')
    for (const step of db.select().from(schema.researchSteps)
      .where(and(eq(schema.researchSteps.session_id, session.id), inArray(schema.researchSteps.status, RESEARCH_ACTIVE_STATUSES))).all()) {
      cancelStep(step)
    }
    db.delete(schema.researchSessions).where(eq(schema.researchSessions.id, session.id)).run()
    return { success: true }
  })

  /** Owner-only mutation guard: returns the session or sends 404/403. */
  function ownedSession(request: any, reply: FastifyReply): SessionRow | null {
    const db = getDatabase()
    const session = loadVisibleSession(db, Number(request.params.id), request.user!)
    if (!session) { errorReply(reply, 404, 'NOT_FOUND', 'Research session not found'); return null }
    if (session.user_id !== request.user!.id) { errorReply(reply, 403, 'FORBIDDEN', 'Only the owner can change this session'); return null }
    return session
  }

  // POST /api/research/:id/steps — submit a message. `queue_only` adds it to the queue without
  // starting a round (to write an instruction in parts). Otherwise, when idle, a round starts now
  // with every queued message plus this text (201; the text may be empty when the queue is not);
  // while a round is active the message is queued (202) and sent when the round ends.
  app.post<{ Params: { id: string }; Body: { user_text?: string; model_name?: string; queue_only?: boolean } }>(
    '/api/research/:id/steps', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const session = ownedSession(request, reply)
      if (!session) return
      const userText = textField(request.body, 'user_text')
      const queueOnly = request.body?.queue_only === true
      const modelError = codexModelError(request.body?.model_name)
      if (modelError) return errorReply(reply, 400, 'VALIDATION_ERROR', modelError)
      const queuedCount = db.select({ id: schema.researchQueuedMessages.id }).from(schema.researchQueuedMessages)
        .where(eq(schema.researchQueuedMessages.session_id, session.id)).all().length
      if (!userText && (queueOnly || queuedCount === 0)) return errorReply(reply, 400, 'VALIDATION_ERROR', 'user_text is required')
      if (userText) {
        db.insert(schema.researchQueuedMessages).values({
          session_id: session.id,
          user_id: request.user!.id,
          text: userText,
          model_name: request.body!.model_name!,
          created_at: new Date().toISOString(),
        }).run()
      }
      // Dispatch starts a round right away when none is active, merging the whole queue in order.
      const started = queueOnly ? null : dispatchQueuedMessages(session.id, runOptions, request.body!.model_name!)
      return reply.code(started != null ? 201 : 202).send({ data: detail(db, session, request.user!), queued: started == null })
    })

  // DELETE /api/research/:id/queue/:messageId — owner removes a message before it is sent
  app.delete<{ Params: { id: string; messageId: string } }>(
    '/api/research/:id/queue/:messageId', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const session = ownedSession(request, reply)
      if (!session) return
      const removed = db.delete(schema.researchQueuedMessages)
        .where(and(
          eq(schema.researchQueuedMessages.id, Number(request.params.messageId)),
          eq(schema.researchQueuedMessages.session_id, session.id),
        ))
        .returning({ id: schema.researchQueuedMessages.id }).get()
      if (!removed) return errorReply(reply, 404, 'NOT_FOUND', 'Queued message not found (it may have been sent already)')
      return { data: detail(db, session, request.user!) }
    })

  // POST /api/research/:id/steps/:stepId/retry — re-run the latest step (agent rounds only)
  app.post<{ Params: { id: string; stepId: string }; Body: { user_text?: string; model_name?: string } }>(
    '/api/research/:id/steps/:stepId/retry', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const session = ownedSession(request, reply)
      if (!session) return
      const latest = lastStep(db, session.id)
      const stepId = Number(request.params.stepId)
      if (!latest || latest.id !== stepId) return errorReply(reply, 409, 'NOT_LATEST', 'Only the latest step can be retried')
      if (latest.kind !== 'agent') return errorReply(reply, 409, 'NOT_AGENT_ROUND', 'Only agent rounds can be retried')
      if (isActiveStatus(latest.status)) return errorReply(reply, 409, 'ROUND_ACTIVE', 'The round is still running')
      const userText = request.body?.user_text !== undefined ? textField(request.body, 'user_text') : latest.user_text
      if (!userText) return errorReply(reply, 400, 'VALIDATION_ERROR', 'user_text must not be empty')
      const modelName = request.body?.model_name ?? latest.model_name
      const modelError = codexModelError(modelName)
      if (modelError) return errorReply(reply, 400, 'VALIDATION_ERROR', modelError)
      const now = new Date().toISOString()
      db.update(schema.researchSteps).set({
        user_text: userText,
        model_name: modelName,
        status: 'queued',
        answer: '',
        report: null,
        changes_note: null,
        paper_list: null,
        parse_error: null,
        repaired: 0,
        error: null,
        execution_id: null,
        started_at: null,
        first_chunk_at: null,
        finished_at: null,
        updated_at: now,
      }).where(eq(schema.researchSteps.id, latest.id)).run()
      db.update(schema.researchSessions).set({ updated_at: now }).where(eq(schema.researchSessions.id, session.id)).run()
      await scheduleAgentStep(latest.id, runOptions)
      return { data: detail(db, session, request.user!) }
    })

  // POST /api/research/:id/steps/:stepId/cancel — cancel an active round
  app.post<{ Params: { id: string; stepId: string } }>(
    '/api/research/:id/steps/:stepId/cancel', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const session = ownedSession(request, reply)
      if (!session) return
      const step = db.select().from(schema.researchSteps)
        .where(and(eq(schema.researchSteps.id, Number(request.params.stepId)), eq(schema.researchSteps.session_id, session.id))).get()
      if (!step) return errorReply(reply, 404, 'NOT_FOUND', 'Step not found')
      if (!cancelStep(step)) return errorReply(reply, 409, 'NOT_ACTIVE', 'The round is not active')
      return { success: true }
    })

  // PUT /api/research/:id/titles — owner edits the current version's titles → new title-edit step
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/research/:id/titles', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const session = ownedSession(request, reply)
      if (!session) return
      const body = request.body
      if (!body || typeof body !== 'object' || Array.isArray(body)) return errorReply(reply, 400, 'VALIDATION_ERROR', 'Expected { title, section_titles }')
      const extra = Object.keys(body).filter((k) => k !== 'title' && k !== 'section_titles')
      if (extra.length) return errorReply(reply, 400, 'VALIDATION_ERROR', `Only titles can be edited (unexpected: ${extra.join(', ')})`)
      if (typeof body.title !== 'string' || !Array.isArray(body.section_titles) || !body.section_titles.every((t) => typeof t === 'string')) {
        return errorReply(reply, 400, 'VALIDATION_ERROR', 'Expected { title: string, section_titles: string[] }')
      }
      if (hasActiveStep(db, session.id)) return errorReply(reply, 409, 'ROUND_ACTIVE', 'A round is still running')
      const steps = loadSteps(db, [session.id]).get(session.id) ?? []
      const current = currentVersionStep(steps)
      const before = current ? parseList(current.paper_list) : null
      if (!before) return errorReply(reply, 409, 'NO_LIST', 'There is no list to edit yet')
      let after: ResearchPaperList
      try {
        after = applyTitleEdit(before, body.title, body.section_titles as string[])
      } catch (err) {
        if (err instanceof TitleEditError) return errorReply(reply, 400, 'VALIDATION_ERROR', err.message)
        throw err
      }
      const now = new Date().toISOString()
      db.insert(schema.researchSteps).values({
        session_id: session.id,
        step_index: (steps[steps.length - 1]?.step_index ?? 0) + 1,
        kind: 'title_edit',
        user_text: describeTitleEdit(before, after),
        model_name: null,
        status: 'done',
        answer: '',
        report: current!.report,
        paper_list: JSON.stringify(after),
        created_at: now,
        finished_at: now,
        updated_at: now,
      }).run()
      db.update(schema.researchSessions).set({ updated_at: now }).where(eq(schema.researchSessions.id, session.id)).run()
      return reply.code(201).send({ data: detail(db, session, request.user!) })
    })

  // POST /api/research/:id/truncate — continue from an earlier version: delete every later step
  app.post<{ Params: { id: string }; Body: { after_step_index?: number } }>(
    '/api/research/:id/truncate', { preHandler: requireUser }, async (request, reply) => {
      const db = getDatabase()
      const session = ownedSession(request, reply)
      if (!session) return
      const index = Number(request.body?.after_step_index)
      if (!Number.isInteger(index)) return errorReply(reply, 400, 'VALIDATION_ERROR', 'after_step_index is required')
      const target = db.select().from(schema.researchSteps)
        .where(and(eq(schema.researchSteps.session_id, session.id), eq(schema.researchSteps.step_index, index))).get()
      if (!target || !target.paper_list) return errorReply(reply, 400, 'VALIDATION_ERROR', 'after_step_index must be a step that produced a list version')
      if (hasActiveStep(db, session.id)) return errorReply(reply, 409, 'ROUND_ACTIVE', 'A round is still running')
      const now = new Date().toISOString()
      const removed = db.transaction((tx) => {
        const deleted = tx.delete(schema.researchSteps)
          .where(and(eq(schema.researchSteps.session_id, session.id), gt(schema.researchSteps.step_index, index)))
          .returning({ id: schema.researchSteps.id }).all()
        tx.update(schema.researchSessions).set({ updated_at: now }).where(eq(schema.researchSessions.id, session.id)).run()
        return deleted.length
      })
      return { data: detail(db, session, request.user!), removed_steps: removed }
    })

  // GET /api/research/steps/:stepId/stream — SSE for one step; disconnecting never cancels the run
  app.get<{ Params: { stepId: string } }>('/api/research/steps/:stepId/stream', { preHandler: requireUser }, async (request, reply) => {
    if (!request.user) return
    const db = getDatabase()
    const stepId = Number(request.params.stepId)
    const initial = Number.isInteger(stepId)
      ? db.select().from(schema.researchSteps).where(eq(schema.researchSteps.id, stepId)).get()
      : undefined
    if (!initial || !loadVisibleSession(db, initial.session_id, request.user)) {
      return errorReply(reply, 404, 'NOT_FOUND', 'Research step not found')
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
    const errorPayload = (step: any) => ({
      step,
      error: { code: step.status === 'cancelled' ? 'RESEARCH_CANCELLED' : 'RESEARCH_FAILED', message: step.error || 'Research round failed' },
    })

    const first = serializeStep(initial)
    if (!isActiveStatus(initial.status)) {
      try {
        await writeEvent('start', { step: first })
        if (initial.status === 'done') await writeEvent('done', { step: first })
        else await writeEvent('error', errorPayload(first))
      } catch {
        // observer disconnected
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

    unsubscribe = researchStepStreamBroker.subscribe(stepId, (event) => {
      if (closed) return
      if (event.event === 'start') void enqueue('start', { step: event.result })
      else if (event.event === 'delta') void enqueue('delta', { step_id: stepId, delta: event.delta, answer_length: event.answer_length, first_chunk_at: event.first_chunk_at })
      else if (event.event === 'repairing') void enqueue('repairing', { step: event.result })
      else if (event.event === 'tool') void enqueue('tool', { step_id: stepId, server: event.server, tool: event.tool, status: event.status })
      else if (event.event === 'done') void enqueue('done', { step: event.result }).then(finish)
      else void enqueue('error', errorPayload(event.result)).then(finish)
    })
    raw.once('close', cleanup)
    request.raw.once('aborted', cleanup)

    try {
      await enqueue('start', { step: first })
      await closedPromise
    } catch {
      if (!raw.destroyed && !raw.writableEnded) raw.end()
      cleanup()
    }
  })
}

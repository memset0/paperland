import type { FastifyInstance } from 'fastify'
import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm'
import type { CompletionItem, CompletionsResponse } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'
import { loadSteps, researchSessionTitle } from './research.js'

// Completion notifications: the signed-in user's own Q&A answers and Deep Research rounds that
// finished after a server-time cursor. The client polls this and announces each item once
// (de-duplicating by id, since consecutive cursors overlap).

const ANNOUNCED = ['done', 'failed'] as const
const MAX_ITEMS = 50
// The returned cursor lags the server clock a little so a row whose finish time was taken just
// before a poll but written just after it is still caught next time; clients de-duplicate.
const CURSOR_OVERLAP_MS = 5000

function isISODate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/notifications/completions', { preHandler: requireUser }, async (request) => {
    const db = getDatabase()
    const userId = request.user!.id
    const now = new Date(Date.now() - CURSOR_OVERLAP_MS).toISOString()
    const since = (request.query as { since?: unknown }).since
    // No cursor yet: hand one out without announcing anything older.
    if (!isISODate(since)) return { now, items: [] } satisfies CompletionsResponse
    const cursor = new Date(since).toISOString()

    const qaRows = db.select({
      result_id: schema.qaResults.id,
      entry_id: schema.qaEntries.id,
      paper_id: schema.qaEntries.paper_id,
      paper_title: schema.papers.title,
      prompt: schema.qaEntries.prompt,
      template_name: schema.qaEntries.template_name,
      model_name: schema.qaResults.model_name,
      status: schema.qaResults.status,
      finished_at: schema.qaResults.finished_at,
    })
      .from(schema.qaResults)
      .innerJoin(schema.qaEntries, eq(schema.qaResults.qa_entry_id, schema.qaEntries.id))
      .innerJoin(schema.papers, eq(schema.qaEntries.paper_id, schema.papers.id))
      .where(and(
        eq(schema.qaResults.requested_by_user_id, userId),
        isNull(schema.qaResults.deleted_at),
        inArray(schema.qaResults.status, [...ANNOUNCED]),
        gt(schema.qaResults.finished_at, cursor),
      ))
      .orderBy(asc(schema.qaResults.finished_at))
      .limit(MAX_ITEMS)
      .all()

    const stepRows = db.select({
      step_id: schema.researchSteps.id,
      session_id: schema.researchSteps.session_id,
      status: schema.researchSteps.status,
      finished_at: schema.researchSteps.finished_at,
    })
      .from(schema.researchSteps)
      .innerJoin(schema.researchSessions, eq(schema.researchSteps.session_id, schema.researchSessions.id))
      .where(and(
        eq(schema.researchSessions.user_id, userId),
        eq(schema.researchSteps.kind, 'agent'),
        inArray(schema.researchSteps.status, [...ANNOUNCED]),
        gt(schema.researchSteps.finished_at, cursor),
      ))
      .orderBy(asc(schema.researchSteps.finished_at))
      .limit(MAX_ITEMS)
      .all()

    const sessionIds = [...new Set(stepRows.map((row) => row.session_id))]
    const sessions = sessionIds.length
      ? db.select().from(schema.researchSessions).where(inArray(schema.researchSessions.id, sessionIds)).all()
      : []
    const steps = loadSteps(db, sessionIds)
    const titles = new Map(sessions.map((session) => [session.id, researchSessionTitle(session, steps.get(session.id) ?? [])]))

    const items: CompletionItem[] = [
      ...qaRows.map((row): CompletionItem => ({
        kind: 'qa',
        result_id: row.result_id,
        entry_id: row.entry_id,
        paper_id: row.paper_id,
        paper_title: row.paper_title,
        title: row.prompt || row.template_name || `QA-${row.entry_id}`,
        model_name: row.model_name,
        status: row.status as 'done' | 'failed',
        finished_at: row.finished_at!,
      })),
      ...stepRows.map((row): CompletionItem => ({
        kind: 'research',
        step_id: row.step_id,
        session_id: row.session_id,
        title: titles.get(row.session_id) ?? `Research ${row.session_id}`,
        status: row.status as 'done' | 'failed',
        finished_at: row.finished_at!,
      })),
    ].sort((a, b) => a.finished_at.localeCompare(b.finished_at))

    return { now, items } satisfies CompletionsResponse
  })
}

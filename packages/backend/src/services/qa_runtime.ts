import { desc, eq, inArray } from 'drizzle-orm'
import type { getDatabase } from '../db/index.js'
import * as schema from '../db/schema.js'

export const QA_RESULT_ACTIVE_STATUSES = ['queued', 'awaiting_output', 'streaming'] as const
export const QA_RESULT_TERMINAL_STATUSES = ['done', 'failed', 'cancelled'] as const

export type QAResultStatus =
  | (typeof QA_RESULT_ACTIVE_STATUSES)[number]
  | (typeof QA_RESULT_TERMINAL_STATUSES)[number]

type Database = ReturnType<typeof getDatabase>
type QAResultRow = typeof schema.qaResults.$inferSelect

export function isActiveQAResultStatus(status: string): status is (typeof QA_RESULT_ACTIVE_STATUSES)[number] {
  return (QA_RESULT_ACTIVE_STATUSES as readonly string[]).includes(status)
}

export function isTerminalQAResultStatus(status: string): status is (typeof QA_RESULT_TERMINAL_STATUSES)[number] {
  return (QA_RESULT_TERMINAL_STATUSES as readonly string[]).includes(status)
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

export function deriveThinkingDurationMs(
  result: Pick<QAResultRow, 'status' | 'started_at' | 'first_chunk_at' | 'finished_at'>,
  nowMs = Date.now(),
): number | null {
  const startedAt = parseTime(result.started_at)
  if (startedAt == null) return null
  const firstChunkAt = parseTime(result.first_chunk_at)
  const finishedAt = parseTime(result.finished_at)
  const end = firstChunkAt ?? finishedAt ?? (result.status === 'awaiting_output' ? nowMs : null)
  return end == null ? null : Math.max(0, end - startedAt)
}

export function serializeQAResult(
  result: QAResultRow,
  options: { canCancel?: boolean; nowMs?: number } = {},
) {
  return {
    ...result,
    streaming_capable: result.streaming_capable === 1,
    thinking_duration_ms: deriveThinkingDurationMs(result, options.nowMs),
    can_cancel: options.canCancel ?? false,
  }
}

export function recomputeQAEntryState(db: Database, entryId: number): { status: string; error: string | null } {
  const results = db.select({
    id: schema.qaResults.id,
    status: schema.qaResults.status,
    error: schema.qaResults.error,
    updated_at: schema.qaResults.updated_at,
  }).from(schema.qaResults)
    .where(eq(schema.qaResults.qa_entry_id, entryId))
    .orderBy(desc(schema.qaResults.updated_at), desc(schema.qaResults.id))
    .all()

  let status = 'pending'
  let error: string | null = null
  if (results.some((result) => result.status === 'awaiting_output' || result.status === 'streaming')) {
    status = 'running'
  } else if (results.some((result) => result.status === 'queued')) {
    status = 'pending'
  } else if (results.some((result) => result.status === 'done')) {
    status = 'done'
  } else if (results.length > 0) {
    status = 'failed'
    error = results.find((result) => result.error)?.error ?? 'QA generation failed'
  }

  db.update(schema.qaEntries)
    .set({ status, error })
    .where(eq(schema.qaEntries.id, entryId))
    .run()
  return { status, error }
}

export function recoverInterruptedQAResults(
  db: Database,
  now = new Date().toISOString(),
): { resultCount: number; entryIds: number[] } {
  const stale = db.select({ id: schema.qaResults.id, entry_id: schema.qaResults.qa_entry_id })
    .from(schema.qaResults)
    .where(inArray(schema.qaResults.status, [...QA_RESULT_ACTIVE_STATUSES]))
    .all()
  if (stale.length === 0) return { resultCount: 0, entryIds: [] }

  db.update(schema.qaResults)
    .set({
      status: 'failed',
      error: 'interrupted by server restart',
      finished_at: now,
      updated_at: now,
    })
    .where(inArray(schema.qaResults.id, stale.map((result) => result.id)))
    .run()

  const entryIds = [...new Set(stale.map((result) => result.entry_id))]
  for (const entryId of entryIds) recomputeQAEntryState(db, entryId)
  return { resultCount: stale.length, entryIds }
}

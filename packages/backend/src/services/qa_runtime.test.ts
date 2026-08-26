import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import {
  deriveThinkingDurationMs,
  recomputeQAEntryState,
  recoverInterruptedQAResults,
} from './qa_runtime.js'

let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE qa_entries (
      id INTEGER PRIMARY KEY, paper_id INTEGER NOT NULL, user_id INTEGER, type TEXT NOT NULL,
      template_name TEXT, prompt TEXT, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE qa_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT, qa_entry_id INTEGER NOT NULL, prompt TEXT NOT NULL,
      answer TEXT NOT NULL, model_name TEXT NOT NULL, completed_at TEXT NOT NULL,
      execution_id INTEGER, content_hash TEXT, status TEXT NOT NULL DEFAULT 'done', error TEXT,
      requested_by_user_id INTEGER, streaming_capable INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT '', started_at TEXT, first_chunk_at TEXT,
      finished_at TEXT, updated_at TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO qa_entries VALUES (1,42,1,'free',NULL,'question','pending',NULL,'2026-08-26T00:00:00Z');
  `)
  db = drizzle(sqlite, { schema })
  setDatabaseForTesting(db)
})

afterEach(() => sqlite.close())

function addResult(status: string, id: number, error: string | null = null) {
  sqlite.query(`
    INSERT INTO qa_results (
      id, qa_entry_id, prompt, answer, model_name, completed_at, status, error, created_at, updated_at
    ) VALUES (?,1,'question','','mock','2026-08-26T00:00:00Z',?,?,?,?)
  `).run(id, status, error, `2026-08-26T00:00:0${id}Z`, `2026-08-26T00:00:0${id}Z`)
}

describe('QA Result runtime state', () => {
  test('entry aggregate gives active work precedence and preserves successful history', () => {
    expect(recomputeQAEntryState(db, 1)).toEqual({ status: 'pending', error: null })

    addResult('done', 1)
    addResult('streaming', 2)
    expect(recomputeQAEntryState(db, 1)).toEqual({ status: 'running', error: null })

    sqlite.query("UPDATE qa_results SET status='failed', error='new failure' WHERE id=2").run()
    expect(recomputeQAEntryState(db, 1)).toEqual({ status: 'done', error: null })

    sqlite.query('DELETE FROM qa_results').run()
    addResult('queued', 3)
    expect(recomputeQAEntryState(db, 1)).toEqual({ status: 'pending', error: null })
    sqlite.query("UPDATE qa_results SET status='awaiting_output' WHERE id=3").run()
    expect(recomputeQAEntryState(db, 1)).toEqual({ status: 'running', error: null })
  })

  test('all terminal unsuccessful attempts aggregate to failed with newest error', () => {
    addResult('failed', 1, 'older')
    addResult('cancelled', 2, 'newer')
    expect(recomputeQAEntryState(db, 1)).toEqual({ status: 'failed', error: 'newer' })
  })

  test('thinking duration advances, freezes on first chunk, and uses terminal time without output', () => {
    const started_at = '2026-08-26T00:00:00.000Z'
    expect(deriveThinkingDurationMs({
      status: 'awaiting_output', started_at, first_chunk_at: null, finished_at: null,
    } as any, Date.parse('2026-08-26T00:00:03.250Z'))).toBe(3250)
    expect(deriveThinkingDurationMs({
      status: 'streaming', started_at, first_chunk_at: '2026-08-26T00:00:02.100Z', finished_at: null,
    } as any)).toBe(2100)
    expect(deriveThinkingDurationMs({
      status: 'failed', started_at, first_chunk_at: null, finished_at: '2026-08-26T00:00:04.500Z',
    } as any)).toBe(4500)
  })

  test('startup recovery preserves partial output and recomputes only affected entries', () => {
    addResult('streaming', 1)
    sqlite.query("UPDATE qa_results SET answer='partial', started_at='2026-08-26T00:00:01Z' WHERE id=1").run()
    const recovered = recoverInterruptedQAResults(db, '2026-08-26T00:01:00Z')
    expect(recovered).toEqual({ resultCount: 1, entryIds: [1] })
    expect(sqlite.query('SELECT status,answer,error,finished_at FROM qa_results WHERE id=1').get()).toEqual({
      status: 'failed', answer: 'partial', error: 'interrupted by server restart', finished_at: '2026-08-26T00:01:00Z',
    })
    expect(sqlite.query('SELECT status,error FROM qa_entries WHERE id=1').get()).toEqual({
      status: 'failed', error: 'interrupted by server restart',
    })
  })
})

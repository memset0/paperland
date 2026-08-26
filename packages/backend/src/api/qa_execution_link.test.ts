import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { runQA } from './qa.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'

let sqlite: Database | null = null

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for QA result')
    await Bun.sleep(5)
  }
}

afterEach(() => {
  sqlite?.close()
  sqlite = null
})

describe('QA result execution identity', () => {
  test('concurrent same-paper runs link each result to its own service execution', async () => {
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
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
      INSERT INTO qa_entries VALUES (7,42,1,'free',NULL,'question','pending',NULL,'2026-08-25T00:00:00Z');
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))

    const ask = async (_paperId: number, _prompt: string, modelName: string) => {
      if (modelName === 'slow') await Bun.sleep(20)
      return { answer: `answer-${modelName}`, model_name: modelName }
    }
    await runQA(7, 42, 'question', 'slow', ask)
    await runQA(7, 42, 'question', 'fast', ask)

    await waitFor(() => (sqlite!.query("SELECT COUNT(*) AS c FROM qa_results WHERE status='done'").get() as any).c === 2)
    const rows = sqlite.query(`
      SELECT r.model_name, r.execution_id, s.service_name, s.paper_id
      FROM qa_results r JOIN service_executions s ON s.id = r.execution_id
      ORDER BY r.model_name
    `).all() as any[]
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.execution_id)).toEqual([...new Set(rows.map((row) => row.execution_id))])
    expect(rows.every((row) => row.service_name === 'qa' && row.paper_id === 42)).toBe(true)
  })
})

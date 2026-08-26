import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { runQA } from './qa.js'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { serviceRunner } from '../services/service_runner.js'
import { qaResultStreamBroker } from '../services/qa_result_stream.js'
import { markdownContentHash } from '../services/content_hash.js'

let sqlite: Database

async function waitFor(predicate: () => boolean, timeoutMs = 1500) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for QA stream state')
    await Bun.sleep(5)
  }
}

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
    CREATE TABLE service_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
      status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
      finished_at TEXT, result TEXT, error TEXT
    );
    INSERT INTO qa_entries VALUES (7,42,1,'free',NULL,'question','pending',NULL,'2026-08-26T00:00:00Z');
  `)
  setDatabaseForTesting(drizzle(sqlite, { schema }))
})

afterEach(() => {
  qaResultStreamBroker.clear()
  sqlite.close()
})

describe('durable QA streaming runs', () => {
  test('coalesces ordered chunks, publishes persisted delta, and commits authoritative final text', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const ask = async (_paperId: number, _prompt: string, modelName: string, options: any) => {
      await gate
      await options.onChunk('first ')
      await options.onChunk('second ')
      await options.onChunk('preview')
      return { answer: 'authoritative final', model_name: modelName }
    }
    const run = await runQA(7, 42, 'question', 'stream-model', {
      requestedByUserId: 1,
      askFn: ask,
      capabilitiesFn: () => ({ streaming: true }),
      batchMs: 25,
    })
    const events: any[] = []
    qaResultStreamBroker.subscribe(run.result_id, (event) => events.push(event))
    release()

    await waitFor(() => (sqlite.query('SELECT status FROM qa_results WHERE id=?').get(run.result_id) as any)?.status === 'done')
    const row = sqlite.query(`
      SELECT prompt,answer,model_name,execution_id,status,requested_by_user_id,streaming_capable,
             started_at,first_chunk_at,finished_at,content_hash
      FROM qa_results WHERE id=?
    `).get(run.result_id) as any
    expect(row).toMatchObject({
      prompt: 'question', answer: 'authoritative final', model_name: 'stream-model',
      execution_id: run.execution_id, status: 'done', requested_by_user_id: 1, streaming_capable: 1,
      content_hash: markdownContentHash('authoritative final'),
    })
    expect(row.started_at).toBeTruthy()
    expect(row.first_chunk_at).toBeTruthy()
    expect(row.finished_at).toBeTruthy()
    expect(events.filter((event) => event.event === 'delta')).toHaveLength(1)
    expect(events.find((event) => event.event === 'delta')?.delta).toBe('first second preview')
    expect(events.at(-1)).toMatchObject({ event: 'done', result: { answer: 'authoritative final' } })
  })

  test('failure after output preserves partial answer and terminal error', async () => {
    const ask = async (_paperId: number, _prompt: string, _modelName: string, options: any): Promise<any> => {
      await options.onChunk('durable partial')
      throw new Error('provider exploded')
    }
    const run = await runQA(7, 42, 'question', 'failing-model', {
      askFn: ask,
      capabilitiesFn: () => ({ streaming: true }),
      batchMs: 100,
    })
    await waitFor(() => (sqlite.query('SELECT status FROM qa_results WHERE id=?').get(run.result_id) as any)?.status === 'failed')
    expect(sqlite.query('SELECT answer,error,content_hash FROM qa_results WHERE id=?').get(run.result_id)).toEqual({
      answer: 'durable partial', error: 'provider exploded', content_hash: null,
    })
  })

  test('exact execution cancellation preserves partial output and cannot be applied twice', async () => {
    let started!: () => void
    const startedPromise = new Promise<void>((resolve) => { started = resolve })
    const ask = async (_paperId: number, _prompt: string, _modelName: string, options: any): Promise<any> => {
      await options.onChunk('before cancel')
      started()
      await new Promise<void>((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('cancelled')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    }
    const run = await runQA(7, 42, 'question', 'cancel-model', {
      askFn: ask,
      capabilitiesFn: () => ({ streaming: true }),
      batchMs: 100,
    })
    await startedPromise
    expect(serviceRunner.cancelPureExecution(run.execution_id)).toBe(true)
    expect(serviceRunner.cancelPureExecution(run.execution_id)).toBe(false)
    await waitFor(() => (sqlite.query('SELECT status FROM qa_results WHERE id=?').get(run.result_id) as any)?.status === 'cancelled')
    expect(sqlite.query('SELECT answer,error FROM qa_results WHERE id=?').get(run.result_id)).toEqual({
      answer: 'before cancel', error: 'cancelled by user',
    })
  })
})

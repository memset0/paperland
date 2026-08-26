import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { serviceRunner } from './service_runner.js'

let sqlite: Database | null = null

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for pure service')
    await Bun.sleep(5)
  }
}

afterEach(() => {
  sqlite?.close()
  sqlite = null
})

describe('ServiceRunner pure execution context', () => {
  test('concurrent callbacks receive their own exact execution ids', async () => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))

    const callbackIds: number[] = []
    const first = await serviceRunner.executePureService('qa-test', 42, async ({ executionId }) => {
      callbackIds.push(executionId)
      await Bun.sleep(15)
    })
    const second = await serviceRunner.executePureService('qa-test', 42, async ({ executionId }) => {
      callbackIds.push(executionId)
    })

    expect(first.executionId).not.toBe(second.executionId)
    await waitFor(() => callbackIds.length === 2)
    expect(new Set(callbackIds)).toEqual(new Set([first.executionId, second.executionId]))
    await waitFor(() => (sqlite!.query("SELECT COUNT(*) AS c FROM service_executions WHERE status='done'").get() as any).c === 2)
  })

  test('preparation runs before the callback and receives the same signal and execution id', async () => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))

    const order: string[] = []
    let preparedId = 0
    let preparedSignal: AbortSignal | null = null
    const scheduled = await serviceRunner.executePureService('qa-prepare-test', 42, async (context) => {
      order.push('execute')
      expect(context.executionId).toBe(preparedId)
      expect(context.signal).toBe(preparedSignal)
    }, {
      onCreated: (context) => {
        order.push('prepare')
        preparedId = context.executionId
        preparedSignal = context.signal
      },
    })
    expect(scheduled.executionId).toBe(preparedId)
    await waitFor(() => order.includes('execute'))
    expect(order).toEqual(['prepare', 'execute'])
  })

  test('preparation failure prevents execution and records failure', async () => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))
    let called = false
    await expect(serviceRunner.executePureService('qa-prepare-failure', 42, async () => {
      called = true
    }, { onCreated: () => { throw new Error('prepare failed') } })).rejects.toThrow('prepare failed')
    expect(called).toBe(false)
    expect(sqlite.query('SELECT status,error FROM service_executions').get()).toEqual({
      status: 'failed', error: 'prepare failed',
    })
  })

  test('exact cancellation aborts one running callback while its sibling completes', async () => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))

    let firstStarted = false
    const first = await serviceRunner.executePureService('qa-cancel-test', 42, async ({ signal }) => {
      firstStarted = true
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('cancelled')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    })
    const second = await serviceRunner.executePureService('qa-cancel-test', 42, async () => {})
    await waitFor(() => firstStarted)
    expect(serviceRunner.cancelPureExecution(first.executionId)).toBe(true)
    expect(serviceRunner.cancelPureExecution(999999)).toBe(false)
    await waitFor(() => (sqlite!.query('SELECT status FROM service_executions WHERE id=?').get(first.executionId) as any)?.status === 'failed')
    await waitFor(() => (sqlite!.query('SELECT status FROM service_executions WHERE id=?').get(second.executionId) as any)?.status === 'done')
    expect(serviceRunner.cancelPureExecution(first.executionId)).toBe(false)
  })
})

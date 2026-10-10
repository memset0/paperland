import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { runQA } from '../api/qa.js'
import { usageRoutes } from '../api/usage.js'
import { estimateCost, recalculateCosts, recordModelUsage, usageLeaderboard, userUsage } from './model_usage.js'
import { translateText } from './translation_service.js'

const realFetch = globalThis.fetch
let fixtureDir = ''
let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance
const now = new Date().toISOString()
const alice = { id: 1, username: 'alice', role: 'user' }
const bob = { id: 2, username: 'bob', role: 'user' }
const admin = { id: 3, username: 'root', role: 'admin' }
const usage = (input: number, cached: number, output: number) => ({
  input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_tokens: 0, total_tokens: input + output,
})

beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-usage-test-'))
  const configPath = join(fixtureDir, 'config.yml')
  writeFileSync(configPath, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: false }
services:
  translation_service: { max_concurrency: 1, rate_limit_interval: 0 }
models:
  default: priced
  available:
    - name: priced
      type: openai_api
      endpoint: https://example.test/v1
      api_key_env: PAPERLAND_USAGE_TEST_KEY
      pricing: { input: 1.25, cached_input: 0.125, output: 10 }
    - name: unpriced
      type: openai_api
      endpoint: https://example.test/v1
      api_key_env: PAPERLAND_USAGE_TEST_KEY
content_priority: [user_input, pdf_parsed]
qa:
  - name: summary
    prompt: Summarize it.
translation:
  model: priced
  prompt: 'Translate: {TEXT}'
`, 'utf8')
  loadConfig(configPath)
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    request.user = ([alice, bob, admin].find((u) => u.id === id) as any) ?? null
  })
  await app.register(usageRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(fixtureDir, { recursive: true, force: true })
})

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  for (const u of [alice, bob, admin]) {
    db.insert(schema.users).values({ id: u.id, username: u.username, password_hash: 'x', role: u.role, created_at: now }).run()
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
  sqlite.close()
})

describe('estimateCost', () => {
  it('prices cached input separately and treats reasoning as output', () => {
    expect(estimateCost(usage(30000, 25000, 100), { input: 1.25, cached_input: 0.125, output: 10 })).toBeCloseTo(0.010375, 9)
    expect(estimateCost(usage(1000, 1000, 0), { input: 2, output: 8 })).toBeCloseTo(0.002, 9) // cached defaults to input
    expect(estimateCost(usage(1000, 0, 0), undefined)).toBeNull()
  })
})

describe('ledger', () => {
  function seedQAResult(): number {
    db.insert(schema.papers).values({ id: 42, title: 'P', authors: '[]', created_at: now, updated_at: now }).run()
    db.insert(schema.qaEntries).values({ id: 7, paper_id: 42, user_id: alice.id, type: 'free', prompt: 'q', status: 'pending', created_at: now }).run()
    return db.insert(schema.qaResults).values({ qa_entry_id: 7, prompt: 'q', answer: '', model_name: 'priced', completed_at: now }).returning().get().id
  }

  it('records cost from pricing (null without), and keeps rows when the source is deleted', () => {
    const resultId = seedQAResult()
    recordModelUsage({ category: 'qa', userId: alice.id, sourceId: resultId, modelName: 'priced', usage: usage(30000, 25000, 100) })
    recordModelUsage({ category: 'qa', userId: alice.id, sourceId: resultId, modelName: 'unpriced', usage: usage(10, 0, 1) })
    const rows = db.select().from(schema.modelUsage).all()
    expect(rows.map((r) => r.cost_usd)).toEqual([expect.closeTo(0.010375, 9), null])
    expect(rows.every((r) => r.qa_result_id === resultId && r.research_step_id === null)).toBe(true)

    db.delete(schema.qaResults).where(eq(schema.qaResults.id, resultId)).run()
    expect(db.select().from(schema.modelUsage).all().map((r) => r.qa_result_id)).toEqual([null, null])
  })

  it('never throws when the insert fails', () => {
    expect(() => recordModelUsage({ category: 'qa', userId: 999, sourceId: null, modelName: 'priced', usage: usage(1, 0, 1) })).not.toThrow()
    expect(db.select().from(schema.modelUsage).all()).toHaveLength(0)
  })

  it('aggregates per user and category, and ranks users by cost then tokens', () => {
    recordModelUsage({ category: 'qa', userId: alice.id, sourceId: null, modelName: 'priced', usage: usage(1000, 0, 100) })
    recordModelUsage({ category: 'translation', userId: alice.id, sourceId: null, modelName: 'unpriced', usage: usage(500, 0, 50) })
    recordModelUsage({ category: 'research', userId: bob.id, sourceId: null, modelName: 'priced', usage: usage(100000, 0, 1000) })
    recordModelUsage({ category: 'qa', userId: null, sourceId: null, modelName: 'unpriced', usage: usage(5, 0, 5) })
    db.insert(schema.modelUsage).values({ category: 'qa', user_id: alice.id, model_name: 'priced', input_tokens: 9, total_tokens: 9, cost_usd: 1, created_at: '2020-01-01T00:00:00.000Z' }).run()

    const mine = userUsage(alice.id)
    expect(mine.total).toMatchObject({ calls: 3, input_tokens: 1509, output_tokens: 150 })
    expect(mine.by_category.translation).toMatchObject({ calls: 1, total_tokens: 550, cost_usd: 0 })
    expect(mine.by_category.research.calls).toBe(0)
    expect(userUsage(alice.id, 30).total.calls).toBe(2) // old row outside the window

    const board = usageLeaderboard()
    expect(board.map((e) => e.username)).toEqual(['alice', 'bob', null])
    expect(board[0].cost_usd).toBeCloseTo(1 + 0.00225, 9)
    expect(usageLeaderboard(30).map((e) => e.username)).toEqual(['bob', 'alice', null])
  })
})

describe('attribution', () => {
  it('bills a Q&A run to the requesting user and its Result', async () => {
    db.insert(schema.papers).values({ id: 42, title: 'P', authors: '[]', created_at: now, updated_at: now }).run()
    db.insert(schema.qaEntries).values({ id: 7, paper_id: 42, user_id: bob.id, type: 'free', prompt: 'q', status: 'pending', created_at: now }).run()
    const run = await runQA(7, 42, 'q', 'priced', {
      requestedByUserId: bob.id,
      capabilitiesFn: () => ({ streaming: false }),
      askFn: async (_p, _q, model, opts: any) => {
        opts.onUsage(usage(2000, 1000, 20))
        return { answer: 'a', model_name: model }
      },
    })
    for (let i = 0; i < 100 && !db.select().from(schema.modelUsage).get(); i++) await Bun.sleep(5)
    expect(db.select().from(schema.modelUsage).all()).toEqual([expect.objectContaining({
      category: 'qa', user_id: bob.id, qa_result_id: run.result_id, model_name: 'priced', input_tokens: 2000, cached_input_tokens: 1000,
    })])
  })

  it('bills an uncached translation to the user with the translation id; cache hits record nothing', async () => {
    process.env.PAPERLAND_USAGE_TEST_KEY = 'k'
    globalThis.fetch = (async () => Response.json({
      choices: [{ message: { content: '译文' } }],
      usage: { prompt_tokens: 300, completion_tokens: 30, total_tokens: 330 },
    })) as unknown as typeof fetch
    const first = await translateText('Hello usage', { userId: alice.id })
    await translateText('Hello usage', { userId: bob.id })
    const rows = db.select().from(schema.modelUsage).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ category: 'translation', user_id: alice.id, translation_id: first.id, input_tokens: 300, output_tokens: 30 })
    expect(rows[0].cost_usd).toBeCloseTo((300 * 1.25 + 30 * 10) / 1e6, 12)
  })
})

describe('usage API', () => {
  it('returns own totals to users and the leaderboard to any signed-in user', async () => {
    recordModelUsage({ category: 'qa', userId: alice.id, sourceId: null, modelName: 'priced', usage: usage(100, 0, 10) })
    expect((await app.inject({ url: '/api/usage/me' })).statusCode).toBe(401)
    const mine = (await app.inject({ url: '/api/usage/me?days=30', headers: { 'x-test-user': '1' } })).json().data
    expect(mine.total.calls).toBe(1)
    expect((await app.inject({ url: '/api/usage/me', headers: { 'x-test-user': '2' } })).json().data.total.calls).toBe(0)
    expect((await app.inject({ url: '/api/usage/leaderboard' })).statusCode).toBe(401)
    const userBoard = await app.inject({ url: '/api/usage/leaderboard', headers: { 'x-test-user': '2' } })
    expect(userBoard.statusCode).toBe(200)
    expect(userBoard.json().data).toEqual([expect.objectContaining({ user_id: alice.id, calls: 1 })])
    const board = (await app.inject({ url: '/api/usage/leaderboard', headers: { 'x-test-user': '3' } })).json().data
    expect(board).toEqual([expect.objectContaining({ user_id: alice.id, username: 'alice', calls: 1 })])
  })
})

describe('cost recalculation', () => {
  function row(model: string, createdAt: string, cost: number | null) {
    return db.insert(schema.modelUsage).values({
      category: 'qa', user_id: alice.id, model_name: model, input_tokens: 30000, cached_input_tokens: 25000,
      output_tokens: 100, total_tokens: 30100, cost_usd: cost, created_at: createdAt,
    }).returning().get().id
  }
  const costOf = (id: number) => db.select().from(schema.modelUsage).where(eq(schema.modelUsage.id, id)).get()!.cost_usd

  it('recomputes from tokens and current pricing, within an inclusive UTC day range, skipping unpriced models', () => {
    const before = row('priced', '2026-10-09T23:59:59.000Z', null)
    const first = row('priced', '2026-10-10T00:00:00.000Z', null)
    const last = row('priced', '2026-10-10T23:59:59.999Z', 99)
    const after = row('priced', '2026-10-11T00:00:00.000Z', null)
    const unpriced = row('unpriced', '2026-10-10T12:00:00.000Z', 5)
    const removed = row('codex-removed-model', '2026-10-10T12:00:00.000Z', 7)

    expect(recalculateCosts({ from: '2026-10-10', to: '2026-10-10' })).toEqual({ updated: 2, skipped: 2, skipped_models: ['codex-removed-model', 'unpriced'] })
    expect(costOf(first)).toBeCloseTo(0.010375, 9)
    expect(costOf(last)).toBeCloseTo(0.010375, 9)
    expect(costOf(before)).toBeNull()
    expect(costOf(after)).toBeNull()
    expect(costOf(unpriced)).toBe(5)
    expect(costOf(removed)).toBe(7)

    expect(recalculateCosts({}).updated).toBe(4)
    expect(costOf(before)).toBeCloseTo(0.010375, 9)
    expect(recalculateCosts({ from: '2026-10-11' }).updated).toBe(1)
  })

  it('is admin-only and validates the range', async () => {
    const id = row('priced', '2026-10-10T12:00:00.000Z', null)
    const post = (user: string | null, payload: unknown) => app.inject({ method: 'POST', url: '/api/usage/recalculate', headers: user ? { 'x-test-user': user } : {}, payload: payload as any })
    expect((await post(null, {})).statusCode).toBe(401)
    expect((await post('1', {})).statusCode).toBe(403)
    expect(costOf(id)).toBeNull()
    expect((await post('3', { from: '2026-13-01' })).statusCode).toBe(400)
    expect((await post('3', { from: '2026-10-11', to: '2026-10-10' })).statusCode).toBe(400)
    const ok = await post('3', { from: '2026-10-10', to: '' })
    expect(ok.json().data).toEqual({ updated: 1, skipped: 0, skipped_models: [] })
    expect(costOf(id)).toBeCloseTo(0.010375, 9)
  })
})

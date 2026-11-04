import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import type { CompletionsResponse } from '@paperland/shared'
import { loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { notificationRoutes } from './notifications.js'

// In-memory database only; no model or external service is involved.
let fixtureDir = ''
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance
const alice = { id: 1, username: 'alice', role: 'user' }
const bob = { id: 2, username: 'bob', role: 'user' }
const as = (u: { id: number }) => ({ 'x-test-user': String(u.id) })

const CREATED = '2026-10-12T00:00:00.000Z'
const CURSOR = '2026-10-12T01:00:00.000Z'
const BEFORE = '2026-10-12T00:30:00.000Z'
const AFTER = '2026-10-12T01:30:00.000Z'

beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-notifications-test-'))
  const configPath = join(fixtureDir, 'config.yml')
  writeFileSync(configPath, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: false }
models:
  default: m
  available:
    - name: m
      type: openai_api
      endpoint: https://example.test/v1
      api_key_env: PAPERLAND_NOTIFICATIONS_TEST_KEY
qa:
  - name: summary
    prompt: Summarize it.
translation:
  prompt: 'Translate: {TEXT}'
`, 'utf8')
  loadConfig(configPath)
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    request.user = ([alice, bob].find((u) => u.id === id) as any) ?? null
  })
  await app.register(notificationRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(fixtureDir, { recursive: true, force: true })
})

let nextResultId = 1
function addResult(entryId: number, userId: number | null, status: string, finishedAt: string | null, deleted = false) {
  const id = nextResultId++
  db.insert(schema.qaResults).values({
    id, qa_entry_id: entryId, prompt: 'p', answer: 'a', model_name: 'm', completed_at: finishedAt ?? '',
    status, requested_by_user_id: userId, created_at: CREATED, updated_at: CREATED, finished_at: finishedAt,
    deleted_at: deleted ? AFTER : null,
  }).run()
  return id
}

let nextStepId = 1
function addStep(sessionId: number, kind: string, status: string, finishedAt: string | null) {
  const id = nextStepId++
  db.insert(schema.researchSteps).values({
    id, session_id: sessionId, step_index: id, kind, status, created_at: CREATED, updated_at: CREATED, finished_at: finishedAt,
  }).run()
  return id
}

beforeEach(() => {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  nextResultId = 1
  nextStepId = 1
  for (const u of [alice, bob]) {
    db.insert(schema.users).values({ id: u.id, username: u.username, password_hash: 'x', role: u.role, created_at: CREATED }).run()
  }
  db.insert(schema.papers).values({ id: 10, title: 'Paper Ten', authors: '[]', created_at: CREATED, updated_at: CREATED }).run()
  db.insert(schema.qaEntries).values([
    { id: 100, paper_id: 10, type: 'free', prompt: 'What is new?', user_id: alice.id, created_at: CREATED },
    { id: 101, paper_id: 10, type: 'template', template_name: 'summary', prompt: null, user_id: null, created_at: CREATED },
  ]).run()
  db.insert(schema.researchSessions).values([
    { id: 50, user_id: alice.id, topic: 'efficient attention', created_at: CREATED, updated_at: CREATED },
    { id: 51, user_id: bob.id, topic: 'bob topic', created_at: CREATED, updated_at: CREATED },
  ]).run()
})

async function poll(user: { id: number } | null, since?: string) {
  const url = since ? `/api/notifications/completions?since=${encodeURIComponent(since)}` : '/api/notifications/completions'
  return app.inject({ method: 'GET', url, headers: user ? as(user) : {} })
}

describe('GET /api/notifications/completions', () => {
  it('rejects signed-out requests', async () => {
    expect((await poll(null)).statusCode).toBe(401)
  })

  it('returns only a cursor on the first call', async () => {
    addResult(100, alice.id, 'done', AFTER)
    const body = (await poll(alice)).json() as CompletionsResponse
    expect(body.items).toEqual([])
    expect(Number.isNaN(Date.parse(body.now))).toBe(false)
  })

  it("lists the caller's finished answers and rounds after the cursor", async () => {
    const done = addResult(100, alice.id, 'done', AFTER)
    const failedTemplate = addResult(101, alice.id, 'failed', '2026-10-12T01:40:00.000Z')
    addResult(100, alice.id, 'done', BEFORE) // before the cursor
    addResult(100, alice.id, 'cancelled', AFTER) // cancelled: not announced
    addResult(100, alice.id, 'streaming', null) // still running
    addResult(100, alice.id, 'done', AFTER, true) // deleted
    addResult(100, bob.id, 'done', AFTER) // someone else's run
    const round = addStep(50, 'agent', 'done', '2026-10-12T01:20:00.000Z')
    addStep(50, 'title_edit', 'done', AFTER) // title edits are not rounds
    addStep(51, 'agent', 'done', AFTER) // bob's session

    const body = (await poll(alice, CURSOR)).json() as CompletionsResponse
    expect(body.items).toEqual([
      { kind: 'research', step_id: round, session_id: 50, title: 'efficient attention', status: 'done', finished_at: '2026-10-12T01:20:00.000Z' },
      { kind: 'qa', result_id: done, entry_id: 100, paper_id: 10, paper_title: 'Paper Ten', title: 'What is new?', model_name: 'm', status: 'done', finished_at: AFTER },
      { kind: 'qa', result_id: failedTemplate, entry_id: 101, paper_id: 10, paper_title: 'Paper Ten', title: 'summary', model_name: 'm', status: 'failed', finished_at: '2026-10-12T01:40:00.000Z' },
    ])
  })

  it('does not show one user the work of another', async () => {
    addResult(100, alice.id, 'done', AFTER)
    addStep(50, 'agent', 'done', AFTER)
    const body = (await poll(bob, CURSOR)).json() as CompletionsResponse
    expect(body.items).toEqual([])
  })
})

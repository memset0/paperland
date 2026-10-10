import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { and, eq } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import type { ResearchPaperList } from '@paperland/shared'
import { getConfig, loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { dispatchQueuedMessagesFor, recoverInterruptedResearchSteps, resetResearchSchedulerForTesting } from '../services/research_runtime.js'
import type { ModelInput } from '../services/model_invoke.js'
import { researchRoutes, setResearchRunOptionsForTesting } from './research.js'
import { checkBearerToken } from '../services/api_tokens.js'
import { researchStepStreamBroker } from '../services/research_runtime.js'

// Model calls and list parsing are injected and S2 is mocked (globalThis.fetch); this test never
// calls a real model or Semantic Scholar.
const realFetch = globalThis.fetch

const alice = { id: 1, username: 'alice', role: 'user' }
const bob = { id: 2, username: 'bob', role: 'user' }
const admin = { id: 3, username: 'admin', role: 'admin' }

let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance
let codexModel: string
let modelCalls: Array<{ input: ModelInput; model: string }>
let nextAnswer: (call: number) => Promise<string>

const LIST: ResearchPaperList = {
  title: 'Long-context attention',
  sections: [
    { title: 'Sparse attention', items: [{ kind: 'paper', s2_id: 'a'.repeat(40), comment: 'baseline', verification: 'verified' }] },
    { title: 'Benchmarks', items: [] },
  ],
}

/** Fake parser: answers containing "LIST" yield a version (list title suffixed by the call), else a parse error. */
async function fakeParse(answer: string) {
  if (answer.includes('LIST')) {
    const n = answer.match(/#(\d+)/)?.[1] ?? ''
    return {
      report: answer.replace('LIST', '').trim(),
      changes_note: `changes in ${n}`,
      paper_list: { ...LIST, title: `${LIST.title} ${n}`.trim() },
      parse_error: null,
    }
  }
  return { report: null, changes_note: null, paper_list: null, parse_error: 'No paperlist block in the answer' }
}

function as(user: { id: number } | null) {
  return user ? { 'x-test-user': String(user.id) } : {}
}

async function waitSettled(stepId: number) {
  for (let i = 0; i < 200; i++) {
    const row = db.select().from(schema.researchSteps).where(eq(schema.researchSteps.id, stepId)).get()
    if (row && !['queued', 'awaiting_output', 'streaming'].includes(row.status)) return row
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error(`step ${stepId} did not settle`)
}

async function create(user = alice, body: Record<string, unknown> = {}) {
  const res = await app.inject({ method: 'POST', url: '/api/research', headers: as(user), payload: { topic: 'efficient attention', model_name: codexModel, ...body } })
  return res
}

beforeAll(() => {
  loadConfig()
  codexModel = getConfig().models.available.find((m) => m.type === 'codex')!.name
  const svc = getConfig().services.semantic_scholar_service
  if (svc) svc.rate_limit_interval = 0
})

beforeEach(async () => {
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  const now = new Date().toISOString()
  for (const u of [alice, bob, admin]) {
    db.insert(schema.users).values({ id: u.id, username: u.username, password_hash: 'x', role: u.role, created_at: now }).run()
  }
  // S2 batch: every requested id resolves to a small record.
  globalThis.fetch = (async (_url: unknown, init: any) => {
    const ids: string[] = JSON.parse(init.body).ids
    return new Response(JSON.stringify(ids.map((id, i) => ({
      paperId: id, externalIds: { CorpusId: 1000 + i }, title: `Paper ${id.slice(0, 4)}`, authors: [{ name: 'A' }], year: 2020,
    }))), { status: 200 })
  }) as typeof fetch
  modelCalls = []
  nextAnswer = async (call) => `Round #${call} LIST`
  setResearchRunOptionsForTesting({
    callModelFn: async (input, model, opts) => {
      modelCalls.push({ input, model })
      const answer = await nextAnswer(modelCalls.length)
      await opts.onChunk?.(answer)
      return answer
    },
    parseFn: fakeParse,
    batchMs: 1,
  })
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    request.user = ([alice, bob, admin].find((u) => u.id === id) as any) ?? null
  })
  await app.register(researchRoutes)
})

afterEach(async () => {
  setResearchRunOptionsForTesting({})
  resetResearchSchedulerForTesting()
  globalThis.fetch = realFetch
  await app.close()
  sqlite.close()
})

afterAll(() => setResearchRunOptionsForTesting({}))

describe('sessions', () => {
  it('creates a session whose first round uses the topic, and runs it with web search on', async () => {
    const res = await create()
    expect(res.statusCode).toBe(201)
    const session = res.json().data
    expect(session.steps).toHaveLength(1)
    expect(session.steps[0]).toMatchObject({ kind: 'agent', user_text: 'efficient attention', model_name: codexModel, step_index: 1 })
    expect(session.title).toBe('efficient attention')
    const done = await waitSettled(session.steps[0].id)
    expect(done.status).toBe('done')
    expect(modelCalls[0].input.web_search).toBe(true)
    expect(modelCalls[0].input.system).toContain('paperlist')
    const detail = (await app.inject({ url: `/api/research/${session.id}`, headers: as(alice) })).json().data
    expect(detail.title).toBe('Long-context attention 1') // title follows the current list
    expect(detail.version_count).toBe(1)
    expect(detail.can_edit).toBe(true)
  })

  it('rejects anonymous, empty topics, and non-Codex models', async () => {
    expect((await create(null as any)).statusCode).toBe(401)
    expect((await create(alice, { topic: '  ' })).statusCode).toBe(400)
    const models = getConfig().models.available
    models.push({ name: 'fake-openai', type: 'openai_api', endpoint: 'https://x.test' } as any)
    try {
      const res = await create(alice, { model_name: 'fake-openai' })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).toContain('Codex')
    } finally {
      models.pop()
    }
  })

  it('errors clearly when no Codex model is configured', async () => {
    const models = getConfig().models.available
    const saved = models.splice(0, models.length, { name: 'only-openai', type: 'openai_api', endpoint: 'https://x.test' } as any)
    try {
      const res = await create(alice, { model_name: 'only-openai' })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.message).toContain('No Codex model')
    } finally {
      models.splice(0, models.length, ...saved)
    }
  })

  it('stores a seed snapshot that survives deleting the source QA', async () => {
    const now = new Date().toISOString()
    db.insert(schema.papers).values({ id: 7, title: 'Attention Is All You Need', authors: '[]', created_at: now, updated_at: now }).run()
    db.insert(schema.qaEntries).values({ id: 5, paper_id: 7, user_id: alice.id, type: 'free', prompt: 'What is new?', status: 'done', created_at: now }).run()
    db.insert(schema.qaResults).values({ id: 42, qa_entry_id: 5, prompt: 'What is new?', answer: 'Self-attention only.', model_name: codexModel, completed_at: now, status: 'done', created_at: now, updated_at: now }).run()
    // Bob cannot seed from Alice's private QA (qa sharing is on by default, so turn it off first).
    db.insert(schema.userSharingSettings).values({ user_id: alice.id, data_type: 'qa', shared: 0, updated_at: now }).run()
    expect((await create(bob, { seed_result_id: 42 })).statusCode).toBe(404)
    const res = await create(alice, { seed_result_id: 42 })
    expect(res.statusCode).toBe(201)
    await waitSettled(res.json().data.steps[0].id)
    db.update(schema.qaResults).set({ deleted_at: now, answer: 'changed' }).where(eq(schema.qaResults.id, 42)).run()
    const detail = (await app.inject({ url: `/api/research/${res.json().data.id}`, headers: as(alice) })).json().data
    expect(detail.seed).toMatchObject({ qa_result_id: 42, paper_id: 7, paper_title: 'Attention Is All You Need', question: 'What is new?', answer: 'Self-attention only.' })
    const text = (modelCalls[0].input.user[0] as { text: string }).text
    expect(text).toContain('<seed>')
    expect(text).toContain('Self-attention only.')
  })
})

describe('linear steps', () => {
  it('starts a round when idle; the second round sees the first list and explanation', async () => {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    const res = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: 'add benchmarks', model_name: codexModel } })
    expect(res.statusCode).toBe(201)
    expect(res.json().queued).toBe(false)
    const second = res.json().data.steps[1]
    expect(second.step_index).toBe(2)
    expect(res.json().data.queued_messages).toEqual([])
    await waitSettled(second.id)
    const text = (modelCalls[1].input.user[0] as { text: string }).text
    expect(text.indexOf('<history>')).toBeLessThan(text.indexOf('<current_version>'))
    expect(text).toContain('<changes>\nchanges in 1\n</changes>') // round 1 changes note in history
    expect(text).toMatch(/<report>\nRound #1\n<\/report>/) // round 1 report in the current version
    expect(text).toContain('Long-context attention 1') // round 1 list
    expect(text.trim().endsWith('<request>\nadd benchmarks\n</request>')).toBe(true)
  })

  it('queues messages sent during a round and sends them merged, with the latest model, when it ends', async () => {
    let release!: () => void
    nextAnswer = (call) => call === 1 ? new Promise((r) => { release = () => r('First #1 LIST') }) : Promise.resolve(`Next #${call} LIST`)
    const session = (await create()).json().data
    await new Promise((r) => setTimeout(r, 20))
    const send = (text: string, user = alice) => app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(user), payload: { user_text: text, model_name: codexModel } })
    const first = await send('add benchmarks')
    expect(first.statusCode).toBe(202)
    expect(first.json().queued).toBe(true)
    expect((await send('drop surveys')).json().data.queued_messages.map((m: any) => m.text)).toEqual(['add benchmarks', 'drop surveys'])
    const extra = (await send('temporary')).json().data.queued_messages.at(-1)
    expect((await app.inject({ method: 'DELETE', url: `/api/research/${session.id}/queue/${extra.id}`, headers: as(alice) })).statusCode).toBe(200)
    expect(db.select().from(schema.researchSteps).where(eq(schema.researchSteps.session_id, session.id)).all()).toHaveLength(1)
    // Other viewers neither queue nor see the queue.
    db.insert(schema.userSharingSettings).values({ user_id: alice.id, data_type: 'research', shared: 1, updated_at: new Date().toISOString() }).run()
    expect((await send('from bob', bob)).statusCode).toBe(403)
    const forBob = await app.inject({ url: `/api/research/${session.id}`, headers: as(bob) })
    expect(forBob.statusCode).toBe(200)
    expect(forBob.json().data.queued_messages).toEqual([])

    const before = new Date().toISOString()
    release()
    await waitSettled(session.steps[0].id)
    let steps: any[] = []
    for (let i = 0; i < 100 && steps.length < 2; i++) {
      steps = db.select().from(schema.researchSteps).where(eq(schema.researchSteps.session_id, session.id)).all()
      await new Promise((r) => setTimeout(r, 5))
    }
    expect(steps).toHaveLength(2)
    expect(steps[1].user_text).toBe('add benchmarks\ndrop surveys')
    expect(steps[1].created_at >= before).toBe(true) // sent time, not enqueue time
    await waitSettled(steps[1].id)
    expect(db.select().from(schema.researchQueuedMessages).all()).toEqual([])
    const text = (modelCalls[1].input.user[0] as { text: string }).text
    expect(text.trim().endsWith('<request>\nadd benchmarks\ndrop surveys\n</request>')).toBe(true)
  })

  it('sends the queue after a cancelled round, and deleting the session drops the queue', async () => {
    setResearchRunOptionsForTesting({
      callModelFn: (input, model, opts) => {
        modelCalls.push({ input, model })
        if (modelCalls.length > 1) return Promise.resolve('Again #2 LIST')
        return new Promise((_, reject) => {
          opts.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        })
      },
      parseFn: fakeParse,
      batchMs: 1,
    })
    const session = (await create()).json().data
    await new Promise((r) => setTimeout(r, 20))
    await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: 'after cancel', model_name: codexModel } })
    await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps/${session.steps[0].id}/cancel`, headers: as(alice) })
    expect((await waitSettled(session.steps[0].id)).status).toBe('cancelled')
    let second: any
    for (let i = 0; i < 100 && !second; i++) {
      second = db.select().from(schema.researchSteps).where(and(eq(schema.researchSteps.session_id, session.id), eq(schema.researchSteps.step_index, 2))).get()
      await new Promise((r) => setTimeout(r, 5))
    }
    expect(second.user_text).toBe('after cancel')
    expect((await waitSettled(second.id)).status).toBe('done')

    // A queue left behind (e.g. by a restart) is removed with its session.
    db.insert(schema.researchQueuedMessages).values({ session_id: session.id, user_id: alice.id, text: 'x', model_name: codexModel, created_at: new Date().toISOString() }).run()
    await app.inject({ method: 'DELETE', url: `/api/research/${session.id}`, headers: as(alice) })
    expect(db.select().from(schema.researchQueuedMessages).all()).toEqual([])
  })

  it('on startup sends only the queues of sessions whose round was interrupted', async () => {
    const now = new Date().toISOString()
    db.insert(schema.researchSessions).values({ id: 9, user_id: alice.id, topic: 't', created_at: now, updated_at: now }).run()
    db.insert(schema.researchSteps).values({ session_id: 9, step_index: 1, kind: 'agent', user_text: 't', model_name: codexModel, status: 'streaming', created_at: now, updated_at: now }).run()
    db.insert(schema.researchQueuedMessages).values({ session_id: 9, user_id: alice.id, text: 'queued before restart', model_name: codexModel, created_at: now }).run()
    // An idle session holding a queue (written in parts) must not be sent by the restart.
    db.insert(schema.researchSessions).values({ id: 10, user_id: alice.id, topic: 'idle', created_at: now, updated_at: now }).run()
    db.insert(schema.researchSteps).values({ session_id: 10, step_index: 1, kind: 'agent', user_text: 'idle', model_name: codexModel, status: 'done', created_at: now, updated_at: now }).run()
    db.insert(schema.researchQueuedMessages).values({ session_id: 10, user_id: alice.id, text: 'draft part', model_name: codexModel, created_at: now }).run()
    const interrupted = recoverInterruptedResearchSteps(db as any)
    expect(interrupted).toEqual([9])
    expect(dispatchQueuedMessagesFor(interrupted, { callModelFn: async () => 'Restart #1 LIST', parseFn: fakeParse, batchMs: 1 })).toBe(1)
    expect(db.select().from(schema.researchQueuedMessages).where(eq(schema.researchQueuedMessages.session_id, 10)).all()).toHaveLength(1)
    const step = db.select().from(schema.researchSteps).where(and(eq(schema.researchSteps.session_id, 9), eq(schema.researchSteps.step_index, 2))).get()!
    expect(step.user_text).toBe('queued before restart')
    expect((await waitSettled(step.id)).status).toBe('done')
  })

  it('holds messages added to the queue while idle until an explicit send', async () => {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    const post = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { model_name: codexModel, ...payload } })
    expect((await post({ queue_only: true })).statusCode).toBe(400) // queue_only needs text
    expect((await post({})).statusCode).toBe(400) // nothing to send
    const first = await post({ user_text: 'part 1', queue_only: true })
    expect(first.statusCode).toBe(202)
    await post({ user_text: 'part 2', queue_only: true })
    await new Promise((r) => setTimeout(r, 20))
    expect(db.select().from(schema.researchSteps).where(eq(schema.researchSteps.session_id, session.id)).all()).toHaveLength(1)
    const sent = await post({ user_text: 'part 3' })
    expect(sent.statusCode).toBe(201)
    const second = sent.json().data.steps[1]
    expect(second.user_text).toBe('part 1\npart 2\npart 3')
    expect(sent.json().data.queued_messages).toEqual([])
    await waitSettled(second.id)

    // Sending with an empty input sends the queue alone.
    await post({ user_text: 'only queued', queue_only: true })
    const flushed = await post({ user_text: '' })
    expect(flushed.statusCode).toBe(201)
    expect(flushed.json().data.steps[2].user_text).toBe('only queued')
    await waitSettled(flushed.json().data.steps[2].id)
  })

  it('retries only the latest agent round, replacing it in place', async () => {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: 'r2', model_name: codexModel } })
    const steps = db.select().from(schema.researchSteps).where(eq(schema.researchSteps.session_id, session.id)).all()
    await waitSettled(steps[1].id)
    const old = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps/${steps[0].id}/retry`, headers: as(alice), payload: {} })
    expect(old.statusCode).toBe(409)
    const res = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps/${steps[1].id}/retry`, headers: as(alice), payload: { user_text: 'r2 edited' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.steps).toHaveLength(2)
    const done = await waitSettled(steps[1].id)
    expect(done.user_text).toBe('r2 edited')
    expect(done.status).toBe('done')
  })

  it('keeps the previous version when a round has no valid list', async () => {
    nextAnswer = async (call) => call === 1 ? 'Round #1 LIST' : 'no list here'
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    const res = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: 'r2', model_name: codexModel } })
    const done = await waitSettled(res.json().data.steps[1].id)
    expect(done.status).toBe('done')
    expect(done.parse_error).toContain('paperlist')
    expect(done.paper_list).toBeNull()
    expect(done.report).toBeNull()
    const detail = (await app.inject({ url: `/api/research/${session.id}`, headers: as(alice) })).json().data
    expect(detail.version_count).toBe(1)
    expect(detail.title).toBe('Long-context attention 1')
  })

  it('records failures and cancellations', async () => {
    nextAnswer = async () => { throw new Error('model exploded') }
    const failed = (await create()).json().data
    expect((await waitSettled(failed.steps[0].id))).toMatchObject({ status: 'failed', error: 'model exploded' })

    setResearchRunOptionsForTesting({
      callModelFn: (_input, _model, opts) => new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      }),
      parseFn: fakeParse,
      batchMs: 1,
    })
    const running = (await create()).json().data
    await new Promise((r) => setTimeout(r, 30))
    const cancel = await app.inject({ method: 'POST', url: `/api/research/${running.id}/steps/${running.steps[0].id}/cancel`, headers: as(alice) })
    expect(cancel.statusCode).toBe(200)
    expect((await waitSettled(running.steps[0].id)).status).toBe('cancelled')
  })

  it('replays failed and cancelled rounds in the history with their user message and a note', async () => {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    const submit = (text: string) => app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: text, model_name: codexModel } })
    nextAnswer = async () => { throw new Error('model exploded') }
    const failed = (await submit('second message')).json().data.steps[1]
    await waitSettled(failed.id)
    nextAnswer = (call) => new Promise((_, reject) => { void call; setTimeout(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), 5) })
    const cancelled = (await submit('third message')).json().data.steps[2]
    expect((await waitSettled(cancelled.id)).status).toBe('cancelled')
    nextAnswer = async (call) => `Round #${call} LIST`
    const fourth = (await submit('fourth message')).json().data.steps[3]
    await waitSettled(fourth.id)
    const text = (modelCalls[modelCalls.length - 1].input.user[0] as { text: string }).text
    const history = text.slice(text.indexOf('<history>'), text.indexOf('</history>'))
    expect(history).toContain('<step index="1" kind="agent" status="done">\n<user_message>\nefficient attention\n</user_message>\n<changes>')
    expect(history).toContain('<step index="2" kind="agent" status="failed">\n<user_message>\nsecond message\n</user_message>\n<note>The round run after this user message failed')
    expect(history).toContain('<step index="3" kind="agent" status="cancelled">\n<user_message>\nthird message\n</user_message>\n<note>The round run after this user message was cancelled')
    expect(history).not.toContain('fourth message')
    expect(history).not.toContain('Round #1') // earlier raw outputs are not replayed
  })

  it('marks steps left active by a restart as failed', () => {
    const now = new Date().toISOString()
    db.insert(schema.researchSessions).values({ id: 9, user_id: alice.id, topic: 't', created_at: now, updated_at: now }).run()
    db.insert(schema.researchSteps).values({ session_id: 9, step_index: 1, kind: 'agent', user_text: 't', model_name: codexModel, status: 'streaming', created_at: now, updated_at: now }).run()
    expect(recoverInterruptedResearchSteps(db as any)).toEqual([9])
    const row = db.select().from(schema.researchSteps).where(eq(schema.researchSteps.session_id, 9)).get()!
    expect(row).toMatchObject({ status: 'failed', error: 'interrupted by server restart' })
  })
})

describe('title edits and continuing from a version', () => {
  async function sessionWithVersions(n: number) {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    for (let i = 2; i <= n; i++) {
      const res = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: `r${i}`, model_name: codexModel } })
      await waitSettled(res.json().data.steps[i - 1].id)
    }
    return session.id as number
  }

  it('creates a new version with only titles changed', async () => {
    const id = await sessionWithVersions(1)
    const res = await app.inject({ method: 'PUT', url: `/api/research/${id}/titles`, headers: as(alice), payload: { title: 'My survey', section_titles: ['Sparse & linear attention', 'Benchmarks'] } })
    expect(res.statusCode).toBe(201)
    const detail = res.json().data
    expect(detail.steps).toHaveLength(2)
    const edit = detail.steps[1]
    expect(edit).toMatchObject({ kind: 'title_edit', status: 'done', model_name: null })
    expect(edit.paper_list.title).toBe('My survey')
    expect(edit.paper_list.sections[0].title).toBe('Sparse & linear attention')
    expect(edit.paper_list.sections[0].items).toEqual(detail.steps[0].paper_list.sections[0].items)
    expect(edit.report).toBe(detail.steps[0].report)
    expect(edit.report).toBe('Round #1')
    expect(edit.user_text).toContain('Sparse & linear attention')
    expect(detail.title).toBe('My survey')
  })

  it('rejects edits that touch anything but titles, empty titles, and edits by others', async () => {
    const id = await sessionWithVersions(1)
    const bad = [
      { title: 'x', section_titles: ['a', 'b'], sections: [] },
      { title: ' ', section_titles: ['a', 'b'] },
      { title: 'x', section_titles: ['a'] },
      { title: 'x', section_titles: ['a', ''] },
    ]
    for (const payload of bad) {
      expect((await app.inject({ method: 'PUT', url: `/api/research/${id}/titles`, headers: as(alice), payload })).statusCode).toBe(400)
    }
    db.insert(schema.userSharingSettings).values({ user_id: alice.id, data_type: 'research', shared: 1, updated_at: new Date().toISOString() }).run()
    expect((await app.inject({ method: 'PUT', url: `/api/research/${id}/titles`, headers: as(bob), payload: { title: 'x', section_titles: ['a', 'b'] } })).statusCode).toBe(403)
    expect(db.select().from(schema.researchSteps).where(eq(schema.researchSteps.session_id, id)).all()).toHaveLength(1)
  })

  it('continuing from an earlier version deletes every later step', async () => {
    const id = await sessionWithVersions(3)
    const res = await app.inject({ method: 'POST', url: `/api/research/${id}/truncate`, headers: as(alice), payload: { after_step_index: 1 } })
    expect(res.statusCode).toBe(200)
    expect(res.json().removed_steps).toBe(2)
    expect(res.json().data.steps).toHaveLength(1)
    const next = await app.inject({ method: 'POST', url: `/api/research/${id}/steps`, headers: as(alice), payload: { user_text: 'again', model_name: codexModel } })
    const step = next.json().data.steps[1]
    expect(step.step_index).toBe(2)
    await waitSettled(step.id)
    const text = (modelCalls[modelCalls.length - 1].input.user[0] as { text: string }).text
    expect(text).toContain('Long-context attention 1')
    expect(text).not.toContain('Long-context attention 3')
  })

  it('blocks edits and truncation while a round is running', async () => {
    const id = await sessionWithVersions(2)
    let release!: () => void
    nextAnswer = () => new Promise((r) => { release = () => r('late #9 LIST') })
    const res = await app.inject({ method: 'POST', url: `/api/research/${id}/steps`, headers: as(alice), payload: { user_text: 'r3', model_name: codexModel } })
    await new Promise((r) => setTimeout(r, 20))
    expect((await app.inject({ method: 'POST', url: `/api/research/${id}/truncate`, headers: as(alice), payload: { after_step_index: 1 } })).statusCode).toBe(409)
    expect((await app.inject({ method: 'PUT', url: `/api/research/${id}/titles`, headers: as(alice), payload: { title: 'x', section_titles: ['a', 'b'] } })).statusCode).toBe(409)
    release()
    await waitSettled(res.json().data.steps[2].id)
  })
})

describe('visibility', () => {
  it('is private by default; sharing makes it readable but not writable; admin may delete', async () => {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    expect((await app.inject({ url: `/api/research/${session.id}`, headers: as(bob) })).statusCode).toBe(404)
    expect((await app.inject({ url: '/api/research?scope=all', headers: as(bob) })).json().data).toHaveLength(0)
    expect((await app.inject({ url: '/api/research?scope=all', headers: as(admin) })).json().data).toHaveLength(1)

    db.insert(schema.userSharingSettings).values({ user_id: alice.id, data_type: 'research', shared: 1, updated_at: new Date().toISOString() }).run()
    const seen = await app.inject({ url: `/api/research/${session.id}`, headers: as(bob) })
    expect(seen.statusCode).toBe(200)
    expect(seen.json().data).toMatchObject({ can_edit: false, can_delete: false, owner_name: 'alice' })
    expect((await app.inject({ url: '/api/research?scope=all', headers: as(bob) })).json().data).toHaveLength(1)
    expect((await app.inject({ url: '/api/research', headers: as(bob) })).json().data).toHaveLength(0)
    expect((await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(bob), payload: { user_text: 'x', model_name: codexModel } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'DELETE', url: `/api/research/${session.id}`, headers: as(bob) })).statusCode).toBe(403)

    expect((await app.inject({ method: 'DELETE', url: `/api/research/${session.id}`, headers: as(admin) })).statusCode).toBe(200)
    expect(db.select().from(schema.researchSteps).all()).toHaveLength(0)
  })

  it('anonymous cannot list or read', async () => {
    expect((await app.inject({ url: '/api/research' })).statusCode).toBe(401)
  })
})

describe('agent tools', () => {
  it("gives each round a paperland MCP server authenticated with the owner's agent token", async () => {
    let validDuringCall = false
    const events: any[] = []
    let subscribed!: () => void
    const ready = new Promise<void>((r) => { subscribed = r })
    setResearchRunOptionsForTesting({
      callModelFn: async (input, _model, opts) => {
        await ready
        modelCalls.push({ input, model: _model })
        const check = checkBearerToken(input.mcp_servers?.[0]?.bearer_token, ['agent'])
        validDuringCall = check.ok && check.user.id === alice.id && check.token.kind === 'agent'
        opts.onToolCall?.({ server: 'paperland', tool: 's2_search', status: 'started' })
        return 'Round #1 LIST'
      },
      parseFn: fakeParse,
      batchMs: 1,
    })
    const session = (await create()).json().data
    const stepId = session.steps[0].id
    const unsubscribe = researchStepStreamBroker.subscribe(stepId, (e) => { events.push(e) })
    subscribed()
    await waitSettled(stepId)
    unsubscribe()
    const input = modelCalls[0].input
    expect(input.mcp_servers).toEqual([{ name: 'paperland', url: 'http://127.0.0.1:3000/mcp', bearer_token: expect.any(String), approved_tools: ['upload_image'] }])
    expect(input.skill_roots).toEqual([getConfig().agent_tools.skills_dir])
    expect(input.system).toContain('## Figures')
    expect(input.system).toContain('upload_image')
    expect(validDuringCall).toBe(true)
    // The same agent token is reused (not re-created) by later rounds.
    const agentRows = db.select().from(schema.apiTokens).where(eq(schema.apiTokens.user_id, alice.id)).all().filter((t) => t.kind === 'agent')
    expect(agentRows).toHaveLength(1)
    expect(agentRows[0].token).toBe(input.mcp_servers![0].bearer_token)
    expect(events.some((e) => e.event === 'tool' && e.tool === 's2_search' && e.result_id === stepId)).toBe(true)
  })

  it('attaches nothing when agent tools are disabled', async () => {
    getConfig().agent_tools.enabled = false
    try {
      const session = (await create()).json().data
      await waitSettled(session.steps[0].id)
      expect(modelCalls[0].input.mcp_servers).toBeUndefined()
      expect(modelCalls[0].input.skill_roots).toBeUndefined()
      expect(modelCalls[0].input.system).not.toContain('## Figures')
    } finally {
      getConfig().agent_tools.enabled = true
    }
  })
})

describe('SSE stream', () => {
  it('replays a finished step as start + done', async () => {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    const res = await app.inject({ url: `/api/research/steps/${session.steps[0].id}/stream`, headers: as(alice) })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('event: start')
    expect(res.body).toContain('event: done')
    expect(res.body).toContain('Long-context attention 1')
  })

  it('hides streams of sessions the viewer cannot see', async () => {
    const session = (await create()).json().data
    await waitSettled(session.steps[0].id)
    expect((await app.inject({ url: `/api/research/steps/${session.steps[0].id}/stream`, headers: as(bob) })).statusCode).toBe(404)
  })
})

describe('automatic repair', () => {
  const ID = 'a'.repeat(40)
  const good = '```paperlist\n' + JSON.stringify({ title: 'Fixed list', sections: [{ title: 'S', items: [{ s2_id: ID, comment: 'c' }] }] }) + '\n```'

  /** Real parser; the model answers a round with `round` and a repair (web_search off) with `repair`. */
  function useModel(round: string, repair: (signal?: AbortSignal) => Promise<string>) {
    setResearchRunOptionsForTesting({
      callModelFn: async (input, model, opts) => {
        modelCalls.push({ input, model })
        if (input.web_search === false) return repair(opts.signal)
        await opts.onChunk?.(round)
        return round
      },
      batchMs: 1,
    })
  }

  it('repairs an invalid list once with the same model and keeps the original report', async () => {
    useModel('My report body\n\n```paperlist\n{"title": "x", sections: [}\n```', async () => good)
    const session = (await create()).json().data
    const done = await waitSettled(session.steps[0].id)
    expect(done).toMatchObject({ status: 'done', repaired: 1, parse_error: null, report: 'My report body' })
    expect(JSON.parse(done.paper_list!).title).toBe('Fixed list')
    expect(modelCalls).toHaveLength(2)
    expect(modelCalls[1].model).toBe(codexModel)
    expect((modelCalls[1].input.user[0] as { text: string }).text).toContain('<validation_error>')
  })

  it('asks for the full output when the report is missing', async () => {
    useModel(good, async () => `A real report\n\n${good}`)
    const done = await waitSettled((await create()).json().data.steps[0].id)
    expect(done).toMatchObject({ status: 'done', repaired: 1, report: 'A real report' })
    expect((modelCalls[1].input.user[0] as { text: string }).text).toContain('missing the research report')
  })

  it('records one usage row per call (round and repair) billed to the session owner', async () => {
    const usage = { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50, reasoning_tokens: 10, total_tokens: 1050 }
    setResearchRunOptionsForTesting({
      callModelFn: async (input, model, opts) => {
        modelCalls.push({ input, model })
        opts.onUsage?.(usage)
        if (input.web_search === false) return good
        return 'Report body\n\n```paperlist\n{broken\n```'
      },
      batchMs: 1,
    })
    const stepId = (await create(bob)).json().data.steps[0].id
    await waitSettled(stepId)
    const rows = db.select().from(schema.modelUsage).all()
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).toMatchObject({ category: 'research', research_step_id: stepId, user_id: bob.id, model_name: codexModel, input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50 })
      expect(row.qa_result_id).toBeNull()
    }
  })

  it('keeps the previous version when the repair also fails or errors', async () => {
    useModel('Report only, no list', async () => 'still no list')
    const first = await waitSettled((await create()).json().data.steps[0].id)
    expect(first).toMatchObject({ status: 'done', repaired: 0, paper_list: null, report: null })
    expect(first.parse_error).toContain('paperlist')
    expect(modelCalls).toHaveLength(2) // exactly one repair attempt

    useModel('Report only', async () => { throw new Error('repair exploded') })
    const second = await waitSettled((await create()).json().data.steps[0].id)
    expect(second).toMatchObject({ status: 'done', paper_list: null })
  })

  it('cancelling during the repair cancels the round', async () => {
    let repairStarted!: () => void
    const started = new Promise<void>((r) => { repairStarted = r })
    useModel('Report only', (signal) => new Promise((_, reject) => {
      repairStarted()
      signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    const session = (await create()).json().data
    await started
    const cancel = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps/${session.steps[0].id}/cancel`, headers: as(alice) })
    expect(cancel.statusCode).toBe(200)
    expect((await waitSettled(session.steps[0].id)).status).toBe('cancelled')
  })
})

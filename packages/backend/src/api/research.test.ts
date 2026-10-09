import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import type { ResearchPaperList } from '@paperland/shared'
import { getConfig, loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { recoverInterruptedResearchSteps, resetResearchSchedulerForTesting } from '../services/research_runtime.js'
import type { ModelInput } from '../services/model_invoke.js'
import { researchRoutes, setResearchRunOptionsForTesting } from './research.js'

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
  it('submits rounds only when idle; the second round sees the first list and explanation', async () => {
    let release!: () => void
    nextAnswer = (call) => call === 1 ? new Promise((r) => { release = () => r('First #1 LIST') }) : Promise.resolve(`Second #${call} LIST`)
    const session = (await create()).json().data
    await new Promise((r) => setTimeout(r, 20))
    const busy = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: 'more', model_name: codexModel } })
    expect(busy.statusCode).toBe(409)
    release()
    await waitSettled(session.steps[0].id)
    const res = await app.inject({ method: 'POST', url: `/api/research/${session.id}/steps`, headers: as(alice), payload: { user_text: 'add benchmarks', model_name: codexModel } })
    expect(res.statusCode).toBe(201)
    const second = res.json().data.steps[1]
    expect(second.step_index).toBe(2)
    await waitSettled(second.id)
    const text = (modelCalls[1].input.user[0] as { text: string }).text
    expect(text.indexOf('<history>')).toBeLessThan(text.indexOf('<current_version>'))
    expect(text).toContain('<changes>\nchanges in 1\n</changes>') // round 1 changes note in history
    expect(text).toMatch(/<report>\nFirst #1\n<\/report>/) // round 1 report in the current version
    expect(text).toContain('Long-context attention 1') // round 1 list
    expect(text.trim().endsWith('<request>\nadd benchmarks\n</request>')).toBe(true)
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

  it('marks steps left active by a restart as failed', () => {
    const now = new Date().toISOString()
    db.insert(schema.researchSessions).values({ id: 9, user_id: alice.id, topic: 't', created_at: now, updated_at: now }).run()
    db.insert(schema.researchSteps).values({ session_id: 9, step_index: 1, kind: 'agent', user_text: 't', model_name: codexModel, status: 'streaming', created_at: now, updated_at: now }).run()
    expect(recoverInterruptedResearchSteps(db as any)).toBe(1)
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

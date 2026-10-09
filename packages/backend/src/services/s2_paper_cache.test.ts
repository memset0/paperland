import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { loadConfig, getConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { resolveS2Ids, warmCites } from './s2_paper_cache.js'

// S2 is always mocked here (globalThis.fetch) — this test never hits the real API.

const PA = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'
const PB = '649def34f8be52c8b66281af98ae884c09aef38b'
const PC = 'b069fbc3879559692875404c6e326dca41fd61bb'
const realFetch = globalThis.fetch
let db: ReturnType<typeof drizzle<typeof schema>>
let calls: string[][]

function rec(paperId: string, corpus: number, title = `T ${corpus}`) {
  return { paperId, externalIds: { CorpusId: corpus }, title, authors: [{ name: 'A' }], year: 2020, venue: 'V', citationCount: 3 }
}

/** Mock S2 batch: answers ids from `known` (by paperId or CorpusId:<n>), null otherwise. */
function mockBatch(known: Array<ReturnType<typeof rec>>) {
  globalThis.fetch = (async (_url: unknown, init: any) => {
    const ids: string[] = JSON.parse(init.body).ids
    calls.push(ids)
    return new Response(JSON.stringify(ids.map((id) => known.find((k) =>
      k.paperId === id || `CorpusId:${k.externalIds.CorpusId}` === id) ?? null)), { status: 200 })
  }) as typeof fetch
}

beforeAll(() => {
  loadConfig()
  // Keep tests fast: no 1 RPS spacing between mocked calls.
  const svc = getConfig().services.semantic_scholar_service
  if (svc) svc.rate_limit_interval = 0
})

beforeEach(() => {
  const sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  calls = []
})

afterEach(() => { globalThis.fetch = realFetch })

function ago(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('resolveS2Ids', () => {
  it('normalizes id forms, keeps request order, and flags invalid ids without a request', async () => {
    mockBatch([rec(PA, 13756489)])
    const res = await resolveS2Ids([PA.toUpperCase(), 'CorpusId:13756489', 'not-an-id'], { allowFetch: true })
    expect(res.map((r) => r.id)).toEqual([PA.toUpperCase(), 'CorpusId:13756489', 'not-an-id'])
    expect(res[0].status).toBe('resolved')
    expect(res[0].paper?.s2_paper_id).toBe(PA)
    expect(res[2]).toMatchObject({ status: 'invalid', paper: null })
    // Both forms of the same paper went out in one batch, nothing for the invalid id.
    expect(calls).toEqual([[PA, 'CorpusId:13756489']])
  })

  it('batches every missing id into one request and caches them (second resolve hits the cache)', async () => {
    mockBatch([rec(PA, 1), rec(PB, 2), rec(PC, 3)])
    const first = await resolveS2Ids([PA, PB, PC], { allowFetch: true })
    expect(calls).toHaveLength(1)
    expect(first.every((r) => r.source === 's2')).toBe(true)
    const second = await resolveS2Ids([PA, '2', PC], { allowFetch: true })
    expect(calls).toHaveLength(1)
    expect(second.every((r) => r.source === 'cache' && r.status === 'resolved')).toBe(true)
    expect(second[1].paper?.s2_paper_id).toBe(PB) // cached under both ids
  })

  it('short-circuits library papers without a request', async () => {
    mockBatch([])
    const now = new Date().toISOString()
    const paper = db.insert(schema.papers).values({
      title: 'Attention', authors: '["V"]', s2_paper_id: PA, metadata: JSON.stringify({ year: 2017, citation_count: 9 }),
      created_at: now, updated_at: now,
    }).returning().get()
    const [r] = await resolveS2Ids([PA], { allowFetch: true })
    expect(r).toMatchObject({ status: 'resolved', source: 'library', library_paper_id: paper.id })
    expect(r.paper?.year).toBe(2017)
    expect(calls).toHaveLength(0)
  })

  it('links a fetched paper to a library paper matched by another external id', async () => {
    const now = new Date().toISOString()
    const paper = db.insert(schema.papers).values({ title: 'X', authors: '[]', corpus_id: '77', created_at: now, updated_at: now }).returning().get()
    mockBatch([{ ...rec(PB, 77) }])
    // Requested by paperId; the library row only knows the CorpusId.
    const [r] = await resolveS2Ids([PB], { allowFetch: true })
    expect(r.source).toBe('s2')
    expect(r.library_paper_id).toBe(paper.id)
  })

  it('stores not_found entries and does not refetch them within not_found_ttl_days', async () => {
    mockBatch([])
    const [r1] = await resolveS2Ids([PA], { allowFetch: true })
    expect(r1.status).toBe('not_found')
    const [r2] = await resolveS2Ids([PA], { allowFetch: true })
    expect(r2).toMatchObject({ status: 'not_found', source: 'cache' })
    expect(calls).toHaveLength(1)
    // Past the negative TTL it is asked again.
    db.update(schema.s2Papers).set({ fetched_at: ago(8) }).run()
    await resolveS2Ids([PA], { allowFetch: true })
    expect(calls).toHaveLength(2)
  })

  it('refetches stale entries and serves stale data when the refetch fails', async () => {
    mockBatch([rec(PA, 1, 'Old title')])
    await resolveS2Ids([PA], { allowFetch: true })
    db.update(schema.s2Papers).set({ fetched_at: ago(31) }).run()
    globalThis.fetch = (async () => new Response('nope', { status: 403 })) as typeof fetch
    const [r] = await resolveS2Ids([PA], { allowFetch: true })
    expect(r).toMatchObject({ status: 'resolved', source: 'stale_cache' })
    expect(r.paper?.title).toBe('Old title')
  })

  it('returns unavailable when nothing is cached and S2 fails', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 403 })) as typeof fetch
    const [r] = await resolveS2Ids([PA], { allowFetch: true })
    expect(r).toMatchObject({ status: 'unavailable', paper: null })
  })

  it('does not fetch when allowFetch is false (anonymous)', async () => {
    mockBatch([rec(PA, 1)])
    const [miss] = await resolveS2Ids([PA], { allowFetch: false })
    expect(miss.status).toBe('unavailable')
    expect(calls).toHaveLength(0)
  })

  it('shares one in-flight request between concurrent resolves of the same id', async () => {
    mockBatch([rec(PA, 1)])
    const [a, b] = await Promise.all([resolveS2Ids([PA], { allowFetch: true }), resolveS2Ids([PA], { allowFetch: true })])
    expect(calls).toHaveLength(1)
    expect(a[0].status).toBe('resolved')
    expect(b[0].status).toBe('resolved')
  })
})

describe('warmCites', () => {
  it('caches every #cite id of an answer', async () => {
    mockBatch([rec(PA, 1), rec(PB, 2)])
    await warmCites(`See [A](#cite:${PA}) and [B](#cite:${PB}), again [A](#cite:${PA}).`)
    expect(calls).toEqual([[PA, PB]])
    const res = await resolveS2Ids([PA, PB], { allowFetch: true })
    expect(res.every((r) => r.source === 'cache')).toBe(true)
    expect(calls).toHaveLength(1)
  })
})

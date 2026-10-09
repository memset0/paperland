import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { getConfig, loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { parseAndVerifyAnswer } from './paperlist.js'
import { mergeRepairedAnswer } from './research_list.js'

// S2 is always mocked (globalThis.fetch) — this test never hits the real API.

const PA = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'
const PB = '649def34f8be52c8b66281af98ae884c09aef38b'
const FAKE = 'f'.repeat(40)
const realFetch = globalThis.fetch
let batchCalls: string[][]

function block(json: unknown): string {
  return '```paperlist\n' + (typeof json === 'string' ? json : JSON.stringify(json, null, 2)) + '\n```'
}

beforeAll(() => {
  loadConfig()
  const svc = getConfig().services.semantic_scholar_service
  if (svc) svc.rate_limit_interval = 0
})

beforeEach(() => {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  batchCalls = []
  // Known: PA and PB; anything else is unknown (null in the batch response).
  globalThis.fetch = (async (_url: unknown, init: any) => {
    const ids: string[] = JSON.parse(init.body).ids
    batchCalls.push(ids)
    return new Response(JSON.stringify(ids.map((id, i) => [PA, PB].includes(id)
      ? { paperId: id, externalIds: { CorpusId: 10 + i }, title: `T ${id.slice(0, 4)}`, authors: [] }
      : null)), { status: 200 })
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = realFetch })

const VALID = {
  title: 'Long-context attention',
  changes: 'Added benchmarks',
  sections: [
    { title: 'Sparse', description: 'See [x](#cite:' + PA + ')', items: [
      { s2_id: PA.toUpperCase(), title: 'ignored', authors: ['ignored'], comment: 'Key **baseline**' },
      { url: 'https://example.com/blog/attention', citation: { title: 'A blog on attention', author: ['Jane Doe'], year: 2024, howpublished: 'Example Blog' }, comment: 'Intuition' },
    ] },
    { title: 'Benchmarks', items: [{ s2_id: PB }] },
  ],
}

describe('parseAndVerifyAnswer', () => {
  it('splits the report from the list, verifies ids in one batch, and drops extra paper fields', async () => {
    const r = await parseAndVerifyAnswer(`# Report\n\nBody text.\n\n${block(VALID)}\n`)
    expect(r.failure).toBeNull()
    expect(r.report).toBe('# Report\n\nBody text.')
    expect(r.changes_note).toBe('Added benchmarks')
    expect(batchCalls).toHaveLength(1)
    expect(r.paper_list!.title).toBe('Long-context attention')
    expect(r.paper_list!.sections[0].description).toContain('#cite:')
    expect(r.paper_list!.sections[0].items[0]).toEqual({ kind: 'paper', s2_id: PA, comment: 'Key **baseline**', verification: 'verified' })
    expect(r.paper_list!.sections[0].items[1]).toEqual({
      kind: 'link', url: 'https://example.com/blog/attention',
      citation: { title: 'A blog on attention', author: ['Jane Doe'], year: 2024, howpublished: 'Example Blog' }, comment: 'Intuition',
    })
    expect(r.paper_list!.sections[1].items[0]).toMatchObject({ s2_id: PB, verification: 'verified' })
  })

  it('makes no S2 request for link items', async () => {
    const r = await parseAndVerifyAnswer(`Report\n\n${block({ title: 'L', sections: [{ title: 'S', items: [VALID.sections[0].items[1]] }] })}`)
    expect(r.failure).toBeNull()
    expect(batchCalls).toHaveLength(0)
  })

  it('keeps unresolvable ids as unverified (no title matching)', async () => {
    const r = await parseAndVerifyAnswer(`Report\n\n${block({ title: 'L', sections: [{ title: 'S', items: [{ s2_id: FAKE, comment: 'c' }] }] })}`)
    expect(r.paper_list!.sections[0].items[0]).toEqual({ kind: 'paper', s2_id: FAKE, comment: 'c', verification: 'unverified' })
  })

  it('keeps the same item in several sections but de-duplicates within a section', async () => {
    const r = await parseAndVerifyAnswer(`Report\n\n${block({ title: 'L', sections: [
      { title: 'A', items: [{ s2_id: PA, comment: 'first' }, { s2_id: PA, comment: 'dup' }, { url: 'https://x.test/a/', citation: { title: 'x' } }, { url: 'https://X.test/a#frag', citation: { title: 'x' } }] },
      { title: 'B', items: [{ s2_id: PA, comment: 'other angle' }] },
    ] })}`)
    const [a, b] = r.paper_list!.sections
    expect(a.items).toHaveLength(2)
    expect(a.items[0]).toMatchObject({ comment: 'first' })
    expect(b.items[0]).toMatchObject({ s2_id: PA, comment: 'other angle' })
  })

  it('uses the last block when several are present', async () => {
    const first = block({ title: 'Old', sections: [] })
    const r = await parseAndVerifyAnswer(`Report\n\n${first}\n\nMore text.\n\n${block({ title: 'New', sections: [] })}`)
    expect(r.paper_list!.title).toBe('New')
    expect(r.report).toContain('More text.')
  })

  it('classifies failures for the repair request', async () => {
    expect((await parseAndVerifyAnswer('Only a report.')).failure).toBe('missing_list')
    expect((await parseAndVerifyAnswer(`Report\n\n${block('{"title": "x", sections: [}')}`)).failure).toBe('invalid_list')
    expect((await parseAndVerifyAnswer(block(VALID))).failure).toBe('missing_report')
    expect((await parseAndVerifyAnswer(block('{bad'))).failure).toBe('missing_report')
    const both = await parseAndVerifyAnswer(`R\n\n${block({ title: 'L', sections: [{ title: 'S', items: [{ s2_id: PA, url: 'https://a.test', citation: { title: 'a' } }] }] })}`)
    expect(both.failure).toBe('invalid_list')
    expect(both.parse_error).toContain('exactly one of s2_id or url')
    const neither = await parseAndVerifyAnswer(`R\n\n${block({ title: 'L', sections: [{ title: 'S', items: [{ comment: 'x' }] }] })}`)
    expect(neither.failure).toBe('invalid_list')
    const linkWithoutCitation = await parseAndVerifyAnswer(`R\n\n${block({ title: 'L', sections: [{ title: 'S', items: [{ url: 'https://a.test' }] }] })}`)
    expect(linkWithoutCitation.failure).toBe('invalid_list')
    expect((await parseAndVerifyAnswer('')).failure).toBe('missing_report')
  })
})

describe('mergeRepairedAnswer', () => {
  it('keeps the original report for list-only repairs and accepts a bare JSON reply', () => {
    const merged = mergeRepairedAnswer(`My report\n\n${block('{bad')}`, JSON.stringify({ title: 'L', sections: [] }), 'invalid_list')
    expect(merged.startsWith('My report\n\n```paperlist\n')).toBe(true)
    expect(mergeRepairedAnswer('My report', block({ title: 'L', sections: [] }), 'missing_list')).toContain('"title": "L"')
  })

  it('replaces the whole answer when the report was missing', () => {
    expect(mergeRepairedAnswer(block(VALID), 'New report\n\n' + block(VALID), 'missing_report')).toStartWith('New report')
  })
})

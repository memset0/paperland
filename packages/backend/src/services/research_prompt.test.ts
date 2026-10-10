import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import type { ResearchPaperList } from '@paperland/shared'
import { getConfig, loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { buildRepairInput, buildResearchInput, getResearchSystemPrompt, renderHistory, type HistoryStep } from './research_prompt.js'

// S2 is always mocked (globalThis.fetch) — this test never hits the real API.

const PA = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'
const FAKE = 'f'.repeat(40)
const realFetch = globalThis.fetch
let db: ReturnType<typeof drizzle<typeof schema>>

const LIST: ResearchPaperList = {
  title: 'Attention <survey> & more',
  sections: [{
    title: 'Core "ideas"',
    description: 'See [Transformer](#cite:' + PA + ')',
    items: [
      { kind: 'paper', s2_id: PA, comment: 'Baseline **paper**', verification: 'verified' },
      { kind: 'paper', s2_id: FAKE, comment: 'dubious', verification: 'unverified' },
      { kind: 'link', url: 'https://example.com/post?a=1&b=2', citation: { title: 'A post', author: ['Jane Doe', 'John Roe'], year: 2024, howpublished: 'Blog' }, comment: 'Intuition' },
    ],
  }],
}

function text(input: { user: Array<{ type: string; text?: string }> }): string {
  return input.user[0].text!
}

beforeAll(() => {
  loadConfig()
  const svc = getConfig().services.semantic_scholar_service
  if (svc) svc.rate_limit_interval = 0
})

beforeEach(() => {
  const sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  globalThis.fetch = (async (_url: unknown, init: any) => {
    const ids: string[] = JSON.parse(init.body).ids
    return new Response(JSON.stringify(ids.map((id) => id === PA ? {
      paperId: PA, externalIds: { CorpusId: 13756489, ArXiv: '1706.03762' }, title: 'Attention Is All You Need',
      authors: [{ name: 'Ashish Vaswani' }, { name: 'Noam Shazeer' }], year: 2017, venue: 'NeurIPS', citationCount: 100000,
      tldr: { text: 'Self-attention only.' }, abstract: 'x'.repeat(2000),
    } : null)), { status: 200 })
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = realFetch })

describe('buildResearchInput', () => {
  it('assembles tagged sections in order with the research system prompt and web search on', async () => {
    const input = await buildResearchInput({
      topic: 'efficient attention',
      seed: { qa_result_id: 1, qa_entry_id: 2, paper_id: 3, paper_title: 'Paper', question: 'Q?', answer: 'A.', model_name: 'm' },
      history: [{ step_index: 1, kind: 'agent', user_text: 'start', changes_note: 'first list' }],
      current: { report: 'The report.', list: LIST },
      request: 'add benchmarks',
    })
    const t = text(input)
    const order = ['<topic>', '<seed>', '<history>', '<current_version>', '<report>', '<paper_list', '<request>']
    // `<request>` also appears inside history steps; the round's own request is the last one.
    const positions = order.map((tag) => tag === '<request>' ? t.lastIndexOf(tag) : t.indexOf(tag))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(t).toContain('<changes>\nfirst list\n</changes>')
    expect(t).toContain('<report>\nThe report.\n</report>')
    expect(t.trim().endsWith('<request>\nadd benchmarks\n</request>')).toBe(true)
    expect(input.system).toBe(getResearchSystemPrompt())
    expect(input.system).toContain('paperlist')
    expect(input.web_search).toBe(true)
  })

  it('enriches verified papers with S2 metadata, truncates abstracts, marks unverified ids, and escapes XML', async () => {
    const limit = getConfig().research.abstract_char_limit
    const t = text(await buildResearchInput({ topic: 't', seed: null, history: [], current: { report: 'r', list: LIST }, request: 'go' }))
    expect(t).toContain('<paper_list title="Attention &lt;survey&gt; &amp; more">')
    expect(t).toContain('<section index="1" title="Core &quot;ideas&quot;">')
    expect(t).toContain(`<paper s2_id="${PA}" verified="true" arxiv_id="1706.03762" year="2017" venue="NeurIPS" citation_count="100000">`)
    expect(t).toContain('<title>Attention Is All You Need</title>')
    expect(t).toContain('<authors>Ashish Vaswani, Noam Shazeer</authors>')
    expect(t).toContain('<tldr>Self-attention only.</tldr>')
    const abstract = t.match(/<abstract truncated="true">(x+)…<\/abstract>/)
    expect(abstract?.[1].length).toBe(limit)
    expect(t).toContain('<comment>Baseline **paper**</comment>')
    expect(t).toContain(`<paper s2_id="${FAKE}" verified="false">\n      <comment>dubious</comment>\n    </paper>`)
    expect(t).toContain('<link url="https://example.com/post?a=1&amp;b=2">')
    expect(t).toContain('<citation title="A post" author="Jane Doe and John Roe" year="2024" howpublished="Blog"/>')
  })

  it('gives library papers their in-app link and leaves other papers without one', async () => {
    const now = new Date().toISOString()
    const paper = db.insert(schema.papers).values({ title: 'Attention', authors: '[]', s2_paper_id: PA, created_at: now, updated_at: now }).returning().get()
    const t = text(await buildResearchInput({ topic: 't', seed: null, history: [], current: { report: 'r', list: LIST }, request: 'go' }))
    expect(t).toContain(`<paper s2_id="${PA}" verified="true" in_library="paperland://paper/${paper.id}"`)
    expect(t).toContain(`<paper s2_id="${FAKE}" verified="false">`)
  })

  it('states the math, JSON escaping, and library link rules in the system prompt', async () => {
    const system = getResearchSystemPrompt()
    expect(system).toContain('`$...$` for inline math')
    expect(system).toContain('Never use `\\(...\\)` or `\\[...\\]`')
    expect(system).toContain('every backslash must be escaped')
    expect(system).toContain('paperland://paper/<id>')
  })

  it('omits optional sections on the first round', async () => {
    const t = text(await buildResearchInput({ topic: 't', seed: null, history: [], current: null, request: 't' }))
    expect(t).not.toContain('<seed>')
    expect(t).not.toContain('<history>')
    expect(t).not.toContain('<current_version>')
  })
})

describe('renderHistory', () => {
  const steps: HistoryStep[] = [
    { step_index: 1, kind: 'agent', user_text: 'oldest', changes_note: 'A'.repeat(300) },
    { step_index: 2, kind: 'title_edit', user_text: 'list title "a" → "b"', changes_note: null },
    { step_index: 3, kind: 'agent', user_text: 'newest', changes_note: 'recent changes' },
  ]

  it('keeps recent steps in full and older ones as user text only when over budget', () => {
    const h = renderHistory(steps, 200)
    expect(h).toContain('<changes>\nrecent changes\n</changes>')
    expect(h).toContain('oldest')
    expect(h).not.toContain('A'.repeat(300))
    expect(h).toContain('The user edited titles: list title "a" → "b"')
    expect(h.indexOf('oldest')).toBeLessThan(h.indexOf('newest'))
  })

  it('keeps everything when within budget', () => {
    expect(renderHistory(steps, 100000)).toContain('A'.repeat(300))
  })
})

describe('buildRepairInput', () => {
  it('sends only the invalid block for list errors and the whole output when the report is missing', () => {
    const original = 'Long report body\n\n```paperlist\n{bad\n```'
    const listFix = text(buildRepairInput(original, 'invalid_list', 'Invalid paperlist JSON'))
    expect(listFix).toContain('ONLY a corrected `paperlist` block')
    expect(listFix).toContain('<validation_error>\nInvalid paperlist JSON\n</validation_error>')
    expect(listFix).not.toContain('Long report body')
    const full = buildRepairInput('```paperlist\n{}\n```', 'missing_report', 'no report')
    expect(text(full)).toContain('missing the research report')
    expect(full.web_search).toBe(false)
  })
})

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { getConfig, loadConfig } from '../config.js'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { setDefaultSharedForTesting } from '../auth/visibility.js'
import { AGENT_TOOLS, callAgentTool, markdownOutline, s2PathError } from './agent_tools.js'
import { resolveS2Ids } from './s2_paper_cache.js'

// S2 is always mocked (globalThis.fetch) — this test never hits the real API.

const PA = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'
const PB = '649def34f8be52c8b66281af98ae884c09aef38b'
const realFetch = globalThis.fetch
let db: ReturnType<typeof drizzle<typeof schema>>
let fetched: string[]
const now = new Date().toISOString()
const OWNER = { id: 1, role: 'user' }

function call(name: string, args: Record<string, unknown>, viewer = OWNER) {
  return callAgentTool(name, args, { viewer })
}
async function ok(name: string, args: Record<string, unknown>, viewer = OWNER): Promise<any> {
  const res = await call(name, args, viewer)
  expect(res.isError).toBe(false)
  return JSON.parse(res.text)
}

function mockS2(handler: (url: URL) => { status?: number; body?: unknown }) {
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input))
    fetched.push(url.pathname + url.search)
    const { status = 200, body = {} } = handler(url)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
}

function s2rec(paperId: string, corpus: number, title: string) {
  return { paperId, externalIds: { CorpusId: corpus }, title, authors: [{ name: 'Ada' }], year: 2017, venue: 'NeurIPS', citationCount: 5, abstract: 'abc' }
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
  setDefaultSharedForTesting(false)
  fetched = []
  for (const [id, name] of [[1, 'owner'], [2, 'other']] as const) {
    db.insert(schema.users).values({ id, username: name, password_hash: 'x', role: 'user', created_at: now }).run()
  }
  const text = '# Intro\nhello\n```\n# not a heading\n```\n## Method\n' + 'x'.repeat(50)
  db.insert(schema.papers).values([
    { id: 10, title: 'Attention Is All You Need', authors: '["Ashish Vaswani"]', abstract: 'self attention transformer', s2_paper_id: PA, corpus_id: '13756489',
      metadata: JSON.stringify({ year: 2017, venue: 'NeurIPS' }), contents: JSON.stringify({ pdf_parsed: text }), listed: 1, created_at: now, updated_at: now },
    { id: 11, title: 'Hidden Attention Paper', authors: '["Bob"]', abstract: null, listed: 0, created_at: now, updated_at: now },
  ]).run()
  db.insert(schema.userPapers).values({ user_id: 1, paper_id: 10, in_library: 1, created_at: now, updated_at: now }).run()
})

afterEach(() => {
  globalThis.fetch = realFetch
  setDefaultSharedForTesting(null)
  getConfig().agent_tools.read_max_chars = 20000
})

describe('site tools', () => {
  it('search_papers matches every term over listed papers only', async () => {
    const res = await ok('search_papers', { query: 'attention vaswani' })
    expect(res.papers.map((p: any) => p.paper_id)).toEqual([10])
    expect(res.papers[0]).toMatchObject({ s2_paper_id: PA, year: 2017, has_full_text: true, in_my_library: true, link: 'paperland://paper/10' })
    expect((await ok('search_papers', { query: 'hidden' })).papers).toEqual([])
  })

  it('get_paper works for unlisted papers and reports full-text availability', async () => {
    const res = await ok('get_paper', { paper_id: 11 })
    expect(res).toMatchObject({ paper_id: 11, listed: false, full_text: null })
    expect((await call('get_paper', { paper_id: 999 })).isError).toBe(true)
  })

  it('read_paper pages the text and returns an outline that skips code blocks', async () => {
    getConfig().agent_tools.read_max_chars = 10
    const page = await ok('read_paper', { paper_id: 10, max_chars: 500 })
    expect(page.text.length).toBe(10)
    expect(page.next_offset).toBe(10)
    const last = await ok('read_paper', { paper_id: 10, offset: page.total_chars - 3 })
    expect(last.next_offset).toBeNull()
    const outline = await ok('read_paper', { paper_id: 10, outline: true })
    expect(outline.outline.map((h: any) => h.title)).toEqual(['Intro', 'Method'])
    expect((await call('read_paper', { paper_id: 11 })).text).toContain('no full text')
  })

  it('get_paper_qa shows template and own answers but not private answers of others', async () => {
    const entries = db.insert(schema.qaEntries).values([
      { paper_id: 10, user_id: null, type: 'template', prompt: 'Template Q', status: 'done', created_at: now },
      { paper_id: 10, user_id: 1, type: 'free', prompt: 'My Q', status: 'done', created_at: now },
      { paper_id: 10, user_id: 2, type: 'free', prompt: 'Their Q', status: 'done', created_at: now },
    ]).returning().all()
    for (const e of entries) {
      db.insert(schema.qaResults).values({ qa_entry_id: e.id, prompt: e.prompt!, answer: `A for ${e.prompt}`, model_name: 'm', completed_at: now, status: 'done', created_at: now, updated_at: now }).run()
    }
    const res = await ok('get_paper_qa', { paper_id: 10 })
    expect(res.entries.map((e: any) => e.question).sort()).toEqual(['My Q', 'Template Q'])
  })

  it('markdownOutline reports offsets of heading lines', () => {
    expect(markdownOutline('a\n# T\n')).toEqual([{ level: 1, title: 'T', offset: 2 }])
  })
})

describe('S2 tools', () => {
  it('s2_search returns compact results, library links, and caches records', async () => {
    mockS2(() => ({ body: { total: 2, data: [s2rec(PA, 13756489, 'Attention'), s2rec(PB, 42, 'Other')] } }))
    const res = await ok('s2_search', { query: 'attention', limit: 500 })
    expect(fetched[0]).toContain('/graph/v1/paper/search?')
    expect(fetched[0]).toContain('limit=100')
    expect(res.papers[0]).toMatchObject({ s2_paper_id: PA, in_library: 'paperland://paper/10' })
    expect(res.papers[1]).toMatchObject({ s2_paper_id: PB, corpus_id: '42', in_library: null })
    fetched = []
    const [cached] = await resolveS2Ids([PB], { allowFetch: true })
    expect(cached.source).toBe('cache')
    expect(fetched).toEqual([])
  })

  it('s2_match returns null when S2 has no match', async () => {
    mockS2(() => ({ status: 404, body: { error: 'Title match not found' } }))
    expect(await ok('s2_match', { title: 'Nothing like this' })).toEqual({ match: null })
  })

  it('s2_citations unwraps the citing papers', async () => {
    mockS2(() => ({ body: { offset: 0, next: 20, data: [{ isInfluential: true, citingPaper: s2rec(PB, 42, 'Citer') }] } }))
    const res = await ok('s2_citations', { id: PA })
    expect(fetched[0]).toContain(`/graph/v1/paper/${PA}/citations?`)
    expect(res).toMatchObject({ next_offset: 20, papers: [{ s2_paper_id: PB, is_influential: true }] })
  })

  it('s2_get only allows configured path prefixes and never contacts S2 otherwise', async () => {
    mockS2(() => ({ body: { data: [] } }))
    for (const path of ['/recommendations/v1/papers', '/graph/v1/../x', '/graph/v1/paper/search?query=a', 'graph/v1/paper']) {
      const res = await call('s2_get', { path })
      expect(res.isError).toBe(true)
    }
    expect(fetched).toEqual([])
    expect(s2PathError('/graph/v1/author/search')).toBeNull()
    await ok('s2_get', { path: '/graph/v1/author/search', params: { query: 'hinton', limit: 1 } })
    expect(fetched).toEqual(['/graph/v1/author/search?query=hinton&limit=1'])
  })

  it('reports S2 outages as tool errors without the API key', async () => {
    mockS2(() => ({ status: 403 }))
    const res = await call('s2_search', { query: 'x' })
    expect(res).toEqual({ isError: true, text: 'Semantic Scholar returned HTTP 403' })
  })
})

describe('registry', () => {
  it('every tool has a schema and unknown tools are errors', async () => {
    for (const tool of AGENT_TOOLS) expect(tool.inputSchema.type).toBe('object')
    expect((await call('nope', {})).isError).toBe(true)
  })
})

describe('upload_image', () => {
  // 1×1 PNG.
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  let tmp = ''
  let savedDir = ''
  let generated = ''
  const AGENT = { viewer: OWNER, token_kind: 'agent' as const }
  const PERSONAL = { viewer: OWNER, token_kind: 'personal' as const }
  const upload = async (args: Record<string, unknown>, ctx: any = AGENT) => callAgentTool('upload_image', args, ctx)

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paperland-upload-image-'))
    const home = path.join(tmp, 'codex-home')
    fs.mkdirSync(path.join(home, 'generated_images', 'thread-1'), { recursive: true })
    generated = path.join(home, 'generated_images', 'thread-1', 'item-1.png')
    fs.writeFileSync(generated, Buffer.from(PNG, 'base64'))
    fs.writeFileSync(path.join(tmp, 'secret.png'), Buffer.from(PNG, 'base64'))
    fs.symlinkSync(path.join(tmp, 'secret.png'), path.join(home, 'generated_images', 'thread-1', 'link.png'))
    const config = getConfig()
    savedDir = config.image_host.dir
    config.image_host.dir = path.join(tmp, 'images')
    config.models.available.push({ name: 'test-codex-upload', type: 'codex', stream: true, cli_path: '/bin/true', codex_home: home, model_id: 'm', vision: false } as any)
  })

  afterEach(() => {
    const config = getConfig()
    config.image_host.dir = savedDir
    config.models.available = config.models.available.filter((m) => m.name !== 'test-codex-upload')
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('stores a Codex-generated image by path for agent tokens and returns embeddable Markdown', async () => {
    const res = await upload({ path: generated, alt: 'A [diagram]' })
    expect(res.isError).toBe(false)
    const body = JSON.parse(res.text)
    expect(body.url).toMatch(/^\/image\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f]{6}\.png$/)
    expect(body.markdown).toBe(`![A  diagram](${body.url})`)
    expect(body).toMatchObject({ width: 1, height: 1, deduped: false })
    const row = db.select().from(schema.images).get()!
    expect(row).toMatchObject({ uploaded_by: 1, original_name: 'item-1.png' })
    expect(fs.existsSync(path.join(tmp, 'images', row.path))).toBe(true)
  })

  it('rejects paths outside generated_images (absolute, .., symlink) and path uploads with personal tokens', async () => {
    for (const p of ['/etc/passwd', path.join(path.dirname(generated), '..', '..', '..', 'secret.png'), path.join(path.dirname(generated), 'link.png'), 'relative.png']) {
      const res = await upload({ path: p })
      expect(res.isError).toBe(true)
    }
    const personal = await upload({ path: generated }, PERSONAL)
    expect(personal.isError).toBe(true)
    expect(personal.text).toContain('"data"')
    expect(db.select().from(schema.images).all()).toHaveLength(0)
  })

  it('accepts base64 or data: URL data from any token and validates it', async () => {
    const res = await upload({ data: `data:image/png;base64,${PNG}` }, PERSONAL)
    expect(res.isError).toBe(false)
    expect(JSON.parse((await upload({ data: PNG }, PERSONAL)).text).deduped).toBe(true)
    expect((await upload({ data: 'bm90IGFuIGltYWdl' }, PERSONAL)).isError).toBe(true)
    expect((await upload({}, PERSONAL)).isError).toBe(true)
    expect((await upload({ data: PNG, path: generated })).isError).toBe(true)
  })

  it('is the only tool listed as non-read-only', () => {
    const writable = AGENT_TOOLS.filter((t) => t.annotations?.readOnlyHint === false).map((t) => t.name)
    expect(writable).toEqual(['upload_image'])
  })
})

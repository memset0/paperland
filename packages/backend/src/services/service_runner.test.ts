import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { serviceRunner, ServiceRunner } from './service_runner.js'

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

describe('ServiceRunner eligibility gate and concurrency groups', () => {
  function setupPaperDb(paper: { contents?: object; metadata?: object; pdf_path?: string | null }) {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
      CREATE TABLE papers (
        id INTEGER PRIMARY KEY, arxiv_id TEXT, corpus_id TEXT, s2_paper_id TEXT UNIQUE, title TEXT NOT NULL, authors TEXT NOT NULL,
        abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT, tags_json TEXT,
        listed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    sqlite.query(`INSERT INTO papers (id, title, authors, contents, pdf_path, metadata, created_at, updated_at)
      VALUES (1, 'P', '[]', ?, ?, ?, '2026-01-01', '2026-01-01')`).run(
      JSON.stringify(paper.contents ?? {}), paper.pdf_path ?? 'p.pdf', JSON.stringify(paper.metadata ?? {}),
    )
    setDatabaseForTesting(drizzle(sqlite, { schema }))
  }
  const execCount = (name: string) =>
    (sqlite!.query('SELECT COUNT(*) AS c FROM service_executions WHERE service_name = ?').get(name) as any).c

  test('ineligible services are skipped silently; eligibility re-checked after a dependency completes', async () => {
    setupPaperDb({})
    const runner = new ServiceRunner()
    runner.initialize({})
    let translated = 0
    runner.register({
      name: 'parse', type: 'paper_bound', depends_on: ['pdf_path'], produces: ['contents.precise'],
      execute: async () => ({ 'contents.precise': 'md' }),
    })
    runner.register({
      name: 'translate', type: 'paper_bound', depends_on: ['contents.precise'], produces: ['translation'],
      eligible: (paper) => !!JSON.parse(paper.metadata || '{}').requested,
      execute: async () => { translated++; return { translation: { ok: true } } },
    })

    await runner.triggerForPaper(1)
    await waitFor(() => (sqlite!.query("SELECT COUNT(*) AS c FROM service_executions WHERE service_name='parse' AND status='done'").get() as any).c === 1)
    await Bun.sleep(20)
    expect(execCount('translate')).toBe(0) // no blocked/deferred noise either

    // Request → explicit parse re-run → post-completion check now starts translate
    sqlite!.query(`UPDATE papers SET metadata = '{"requested":"x"}', contents = '{}'`).run()
    await runner.executeServiceForPaper('parse', 1)
    await waitFor(() => translated === 1)
  })

  test('services in one concurrency_group share a single limit', async () => {
    setupPaperDb({})
    const runner = new ServiceRunner()
    runner.initialize({
      a: { max_concurrency: 1, concurrency_group: 'g' },
      b: { max_concurrency: 1, concurrency_group: 'g' },
    })
    let running = 0
    let peak = 0
    const body = async () => { running++; peak = Math.max(peak, running); await Bun.sleep(20); running--; return {} }
    runner.register({ name: 'a', type: 'paper_bound', depends_on: [], produces: ['x'], execute: body })
    runner.register({ name: 'b', type: 'paper_bound', depends_on: [], produces: ['y'], execute: body })
    await Promise.all([runner.executeServiceForPaper('a', 1), runner.executeServiceForPaper('b', 1)])
    expect(peak).toBe(1)
  })
})

describe('ServiceRunner S2 open-access PDF chaining', () => {
  function setupCorpusPaper() {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
      CREATE TABLE papers (
        id INTEGER PRIMARY KEY, arxiv_id TEXT, corpus_id TEXT, s2_paper_id TEXT UNIQUE, title TEXT NOT NULL, authors TEXT NOT NULL,
        abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT, tags_json TEXT,
        listed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    sqlite.query(`INSERT INTO papers (id, corpus_id, title, authors, created_at, updated_at)
      VALUES (1, '123', 'P', '[]', '2026-01-01', '2026-01-01')`).run()
    setDatabaseForTesting(drizzle(sqlite, { schema }))
  }
  const statusOf = (name: string) =>
    (sqlite!.query('SELECT status FROM service_executions WHERE service_name = ? ORDER BY id').all(name) as any[]).map((r) => r.status)

  // Real s2PdfService scheduling (depends_on / eligible / requires_listed) with a stubbed download.
  async function setupRunner(s2Result: Record<string, any>) {
    const { s2PdfService } = await import('./s2_pdf_service.js')
    const runner = new ServiceRunner()
    runner.initialize({})
    const downloads: string[] = []
    runner.register({
      name: 'semantic_scholar_service', type: 'paper_bound', depends_on: [],
      produces: ['citation_count'], execute: async () => ({ citation_count: 1, ...s2Result }),
    })
    runner.register({
      name: 'arxiv_pdf_service', type: 'paper_bound', depends_on: ['arxiv_id'], produces: ['pdf_path'],
      requires_listed: true, execute: async () => { downloads.push('arxiv'); return { pdf_path: 'data/pdfs/a.pdf' } },
    })
    runner.register({ ...s2PdfService, execute: async () => { downloads.push('s2'); return { pdf_path: 'data/pdfs/s2_123.pdf' } } })
    return { runner, downloads }
  }

  test('corpus-only paper without arXiv version chains S2 → s2_pdf_service', async () => {
    setupCorpusPaper()
    const { runner, downloads } = await setupRunner({ open_access_pdf_url: 'https://example.org/p.pdf' })
    await runner.triggerForPaper(1)
    await waitFor(() => downloads.length === 1)
    await Bun.sleep(20)
    expect(downloads).toEqual(['s2'])
    expect(statusOf('s2_pdf_service')).toEqual(['blocked', 'done'])
    expect((sqlite!.query('SELECT pdf_path FROM papers WHERE id = 1').get() as any).pdf_path).toBe('data/pdfs/s2_123.pdf')
  })

  test('arxiv_id resolved by S2 wins: arxiv_pdf_service downloads, s2_pdf_service never runs', async () => {
    setupCorpusPaper()
    const { runner, downloads } = await setupRunner({ arxiv_id: '1706.03762', open_access_pdf_url: 'https://example.org/p.pdf' })
    await runner.triggerForPaper(1)
    await waitFor(() => downloads.length === 1)
    await Bun.sleep(20)
    expect(downloads).toEqual(['arxiv'])
    expect(statusOf('s2_pdf_service')).not.toContain('done')
  })

  test('closed-access paper: s2_pdf_service stays blocked, never fails', async () => {
    setupCorpusPaper()
    const { runner, downloads } = await setupRunner({ open_access_pdf_status: 'CLOSED' })
    await runner.triggerForPaper(1)
    await waitFor(() => statusOf('semantic_scholar_service').includes('done'))
    await Bun.sleep(20)
    expect(downloads).toEqual([])
    expect(statusOf('s2_pdf_service')).toEqual(['blocked'])
  })
})

describe('ServiceRunner s2_paper_id column', () => {
  test('writes s2_paper_id as a top-level column and skips a value held by another paper', async () => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
      CREATE TABLE papers (
        id INTEGER PRIMARY KEY, arxiv_id TEXT, corpus_id TEXT, s2_paper_id TEXT UNIQUE, title TEXT NOT NULL, authors TEXT NOT NULL,
        abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT, tags_json TEXT,
        listed INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO papers (id, corpus_id, title, authors, created_at, updated_at) VALUES (1, '1', 'A', '[]', 'x', 'x');
      INSERT INTO papers (id, corpus_id, s2_paper_id, title, authors, created_at, updated_at) VALUES (2, '2', 'held', 'B', '[]', 'x', 'x');
      INSERT INTO papers (id, corpus_id, title, authors, created_at, updated_at) VALUES (3, '3', 'C', '[]', 'x', 'x');
    `)
    setDatabaseForTesting(drizzle(sqlite, { schema }))
    const runner = new ServiceRunner()
    runner.initialize({})
    runner.register({
      name: 'enrich', type: 'paper_bound', depends_on: [], produces: ['citation_count'],
      execute: async (id) => ({ s2_paper_id: id === 1 ? 'fresh' : 'held', citation_count: 1 }),
    })
    await runner.executeServiceForPaper('enrich', 1)
    await runner.executeServiceForPaper('enrich', 3)
    const row = (id: number) => sqlite!.query('SELECT s2_paper_id, metadata FROM papers WHERE id = ?').get(id) as any
    expect(row(1).s2_paper_id).toBe('fresh')
    expect(row(3).s2_paper_id).toBeNull() // collision with paper 2 → skipped
    expect(JSON.parse(row(3).metadata).citation_count).toBe(1) // rest of the enrichment kept
  })
})

describe('ServiceRunner PDF replacement (manual re-fetch)', () => {
  const { mkdtempSync, rmSync, existsSync } = require('fs') as typeof import('fs')
  const { tmpdir } = require('os') as typeof import('os')
  const { join } = require('path') as typeof import('path')
  const origCwd = process.cwd()
  let workDir = ''

  async function setup(contents: Record<string, any>, metadata: Record<string, any>) {
    const { writePdfFile } = await import('./pdf_store.js')
    workDir = mkdtempSync(join(tmpdir(), 'runner-pdf-'))
    process.chdir(workDir)
    const oldPath = writePdfFile('2401_00001', new TextEncoder().encode('%PDF old'))
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
      CREATE TABLE papers (
        id INTEGER PRIMARY KEY, arxiv_id TEXT, corpus_id TEXT, s2_paper_id TEXT UNIQUE, title TEXT NOT NULL, authors TEXT NOT NULL,
        abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT, tags_json TEXT,
        listed INTEGER NOT NULL DEFAULT 1, kind TEXT NOT NULL DEFAULT 'paper', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    sqlite.query(`INSERT INTO papers (id, arxiv_id, title, authors, contents, pdf_path, metadata, created_at, updated_at)
      VALUES (1, '2401.00001', 'P', '[]', ?, ?, ?, '2026-01-01', '2026-01-01')`).run(JSON.stringify(contents), oldPath, JSON.stringify(metadata))
    // Earlier runs on the old PDF.
    for (const name of ['pdf_parse', 'doc2x_parse', 'doc2x_translate']) {
      sqlite.query(`INSERT INTO service_executions (service_name, paper_id, status, progress, created_at) VALUES (?, 1, 'done', 100, '2026-01-02T00:00:00.000Z')`).run(name)
    }
    setDatabaseForTesting(drizzle(sqlite, { schema }))

    const runs: string[] = []
    const runner = new ServiceRunner()
    runner.initialize({})
    let nextBytes = '%PDF old'
    runner.register({
      name: 'arxiv_pdf_service', type: 'paper_bound', depends_on: ['arxiv_id'], produces: ['pdf_path'], requires_listed: true,
      execute: async () => ({ pdf_path: writePdfFile('2401_00001', new TextEncoder().encode(nextBytes)), pdf_fetched_at: 'now' }),
    })
    runner.register({
      name: 'pdf_parse', type: 'paper_bound', depends_on: ['pdf_path'], produces: ['contents.pdf_parsed'],
      execute: async () => { runs.push('pdf_parse'); return { 'contents.pdf_parsed': 'new text' } },
    })
    runner.register({
      name: 'doc2x_parse', type: 'paper_bound', depends_on: ['pdf_path'], produces: ['contents.doc2x_parsed'],
      eligible: (p: any) => !!JSON.parse(p.metadata || '{}').doc2x_parse_requested,
      execute: async () => { runs.push('doc2x_parse'); return { 'contents.doc2x_parsed': 'new md' } },
    })
    runner.register({
      name: 'doc2x_translate', type: 'paper_bound', depends_on: ['contents.doc2x_parsed'], produces: ['doc2x_translation'],
      eligible: (p: any) => !!JSON.parse(p.metadata || '{}').doc2x_translate_requested && !!JSON.parse(p.contents || '{}').doc2x_parsed,
      execute: async () => { runs.push('doc2x_translate'); return { doc2x_translation: { new: true } } },
    })
    return { runner, runs, oldPath, setBytes: (b: string) => { nextBytes = b } }
  }

  afterEach(() => {
    if (workDir) {
      process.chdir(origCwd)
      rmSync(workDir, { recursive: true, force: true })
      workDir = ''
    }
  })

  const paper = () => sqlite!.query('SELECT * FROM papers WHERE id = 1').get() as any
  const lastResult = (name: string) =>
    (sqlite!.query('SELECT result FROM service_executions WHERE service_name = ? ORDER BY id DESC').get(name) as any)?.result

  test('identical PDF: nothing changes and the run reports unchanged', async () => {
    const { runner, runs, oldPath } = await setup({ pdf_parsed: 'old text' }, {})
    await runner.executeServiceForPaper('arxiv_pdf_service', 1)
    expect(lastResult('arxiv_pdf_service')).toBe('unchanged')
    expect(paper().pdf_path).toBe(oldPath)
    expect(JSON.parse(paper().contents)).toEqual({ pdf_parsed: 'old text' })
    await Bun.sleep(20)
    expect(runs).toEqual([])
  })

  test('new version: pdf_path switches, derived data is regenerated, doc2x parse and translation re-run', async () => {
    const { runner, runs, oldPath, setBytes } = await setup(
      { pdf_parsed: 'old text', doc2x_parsed: 'old md', user_input: 'mine' },
      { doc2x_parse_id: 'op_old', doc2x_translation: { old: true } },
    )
    setBytes('%PDF v2')
    await runner.executeServiceForPaper('arxiv_pdf_service', 1)
    expect(lastResult('arxiv_pdf_service')).toBe('updated')
    expect(paper().pdf_path).not.toBe(oldPath)
    expect(existsSync(join(workDir, oldPath))).toBe(true)
    await waitFor(() => runs.includes('doc2x_translate'))
    const contents = JSON.parse(paper().contents)
    expect(contents).toEqual({ user_input: 'mine', pdf_parsed: 'new text', doc2x_parsed: 'new md' })
    const meta = JSON.parse(paper().metadata)
    expect(meta.doc2x_translation).toEqual({ new: true })
    expect(meta.doc2x_parse_id).toBeUndefined()
    expect(meta.pdf_fetched_at).toBe('now')
    expect(runs.sort()).toEqual(['doc2x_parse', 'doc2x_translate', 'pdf_parse'])
  })
})

describe('ServiceRunner url_pdf_service scheduling', () => {
  test('a listed manual paper with pdf_url downloads; an unlisted one is deferred', async () => {
    const { urlPdfService } = await import('./url_pdf_service.js')
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE service_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, service_name TEXT NOT NULL, paper_id INTEGER NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL, created_at TEXT NOT NULL,
        finished_at TEXT, result TEXT, error TEXT
      );
      CREATE TABLE papers (
        id INTEGER PRIMARY KEY, arxiv_id TEXT, corpus_id TEXT, s2_paper_id TEXT UNIQUE, title TEXT NOT NULL, authors TEXT NOT NULL,
        abstract TEXT, contents TEXT, pdf_path TEXT, metadata TEXT, link TEXT, tags_json TEXT,
        listed INTEGER NOT NULL DEFAULT 1, kind TEXT NOT NULL DEFAULT 'paper', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    const meta = JSON.stringify({ pdf_url: 'https://x.org/tech_report.pdf' })
    sqlite.query(`INSERT INTO papers (id, title, authors, metadata, listed, created_at, updated_at) VALUES (1, 'A', '[]', ?, 1, 'x', 'x'), (2, 'B', '[]', ?, 0, 'x', 'x')`).run(meta, meta)
    setDatabaseForTesting(drizzle(sqlite, { schema }))
    const runner = new ServiceRunner()
    runner.initialize({})
    const downloads: number[] = []
    runner.register({ ...urlPdfService, execute: async (id: number) => { downloads.push(id); return { pdf_path: `data/pdfs/url_${id}.pdf` } } })
    await runner.triggerForPaper(1)
    await runner.triggerForPaper(2)
    await waitFor(() => downloads.length === 1)
    await Bun.sleep(20)
    expect(downloads).toEqual([1])
    expect((sqlite.query('SELECT status FROM service_executions WHERE paper_id = 2').get() as any).status).toBe('deferred')
    expect((sqlite.query('SELECT pdf_path FROM papers WHERE id = 1').get() as any).pdf_path).toBe('data/pdfs/url_1.pdf')
  })
})

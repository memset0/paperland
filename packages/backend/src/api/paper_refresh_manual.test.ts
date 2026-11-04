import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { serviceRunner } from '../services/service_runner.js'
import { writePdfFile } from '../services/pdf_store.js'
import { paperRoutes } from './papers.js'

/** Manual refresh endpoints, manual-paper create/edit fields, link dedup, and replacement upload.
 *  Temp cwd + in-memory DB; the runner is stubbed, so nothing is downloaded. */

const migrationsFolder = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
const origCwd = process.cwd()
let workDir = ''
let app: FastifyInstance
let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let loggedIn = true
const triggered: number[] = []
const executed: Array<[string, number]> = []
const realTrigger = serviceRunner.triggerForPaper
const realExecute = serviceRunner.executeServiceForPaper

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'paper-refresh-'))
  process.chdir(workDir)
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  setDatabaseForTesting(db)
  const now = new Date().toISOString()
  db.insert(schema.users).values({ username: 'alice', password_hash: 'x', role: 'user', created_at: now }).run()
  const oldPdf = writePdfFile('upload_5', new TextEncoder().encode('%PDF old'))
  db.insert(schema.papers).values([
    { id: 1, arxiv_id: '2401.00001', title: 'ArXiv', authors: '[]', pdf_path: 'data/pdfs/x.pdf', created_at: now, updated_at: now },
    { id: 2, title: 'Manual with URL', authors: '[]', metadata: JSON.stringify({ pdf_url: 'https://x.org/r.pdf' }), created_at: now, updated_at: now },
    { id: 3, title: 'Manual bare', authors: '[]', link: 'https://code-video-model.github.io/', created_at: now, updated_at: now },
    { id: 4, corpus_id: '44', title: 'Hidden', authors: '[]', listed: 0, metadata: JSON.stringify({ open_access_pdf_url: 'https://x.org/o.pdf' }), created_at: now, updated_at: now },
    { id: 5, title: 'Uploaded', authors: '[]', pdf_path: oldPdf, contents: JSON.stringify({ pdf_parsed: 'old', user_input: 'mine' }), created_at: now, updated_at: now },
  ]).run()

  serviceRunner.triggerForPaper = (async (id: number) => { triggered.push(id) }) as any
  // Records the call and leaves a pending execution behind, like the real runner does synchronously.
  serviceRunner.executeServiceForPaper = (async (name: string, id: number) => {
    executed.push([name, id])
    db.insert(schema.serviceExecutions).values({ service_name: name, paper_id: id, status: 'pending', progress: 0, created_at: new Date().toISOString() }).run()
  }) as any

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = loggedIn ? ({ id: 1, username: 'alice', role: 'user' } as any) : null
  })
  await app.register(paperRoutes)
  await app.ready()
})

afterAll(() => {
  serviceRunner.triggerForPaper = realTrigger
  serviceRunner.executeServiceForPaper = realExecute
  process.chdir(origCwd)
  rmSync(workDir, { recursive: true, force: true })
})

beforeEach(() => {
  triggered.length = 0
  executed.length = 0
  loggedIn = true
})

const post = (url: string, payload?: any) => app.inject({ method: 'POST', url, payload })
const patch = (id: number, payload: any) => app.inject({ method: 'PATCH', url: `/api/papers/${id}`, payload })
const row = (id: number) => db.select().from(schema.papers).where(eq(schema.papers.id, id)).get()!

describe('POST /api/papers/:id/pdf/refetch', () => {
  it('re-downloads an arXiv paper through arxiv_pdf_service', async () => {
    const res = await post('/api/papers/1/pdf/refetch')
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ queued: true, service: 'arxiv_pdf_service' })
    expect(executed).toEqual([['arxiv_pdf_service', 1]])
  })

  it('rejects a second refetch while the first is pending', async () => {
    const res = await post('/api/papers/1/pdf/refetch')
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('REFRESH_IN_PROGRESS')
  })

  it('uses url_pdf_service for a manual paper with a PDF URL', async () => {
    expect((await post('/api/papers/2/pdf/refetch')).json().service).toBe('url_pdf_service')
  })

  it('rejects papers without a source, unlisted papers, unknown papers, and anonymous users', async () => {
    expect((await post('/api/papers/3/pdf/refetch')).json().error.code).toBe('NO_PDF_SOURCE')
    expect((await post('/api/papers/4/pdf/refetch')).json().error.code).toBe('NOT_LISTED')
    expect((await post('/api/papers/999/pdf/refetch')).statusCode).toBe(404)
    loggedIn = false
    expect((await post('/api/papers/1/pdf/refetch')).statusCode).toBe(401)
    expect(executed).toEqual([])
  })
})

describe('POST /api/papers/:id/s2/refresh', () => {
  it('runs semantic_scholar_service for papers with an S2-resolvable id', async () => {
    const res = await post('/api/papers/4/s2/refresh')
    expect(res.statusCode).toBe(202)
    expect(executed).toEqual([['semantic_scholar_service', 4]])
    expect((await post('/api/papers/4/s2/refresh')).statusCode).toBe(409)
  })

  it('rejects papers without ids', async () => {
    const res = await post('/api/papers/3/s2/refresh')
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('NO_S2_ID')
  })
})

describe('PATCH manual-paper metadata', () => {
  it('updates abstract, year, venue, kind and pdf_url, scheduling the PDF download', async () => {
    const res = await patch(3, { abstract: 'A', year: 2026, venue: 'Tech report', kind: 'article', pdf_url: 'https://code-video-model.github.io/tech_report.pdf' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ abstract: 'A', kind: 'article', metadata: { year: 2026, venue: 'Tech report', pdf_url: 'https://code-video-model.github.io/tech_report.pdf' } })
    expect(triggered).toEqual([3])
  })

  it('clears values with empty strings / null', async () => {
    const res = await patch(3, { abstract: '', venue: '', year: null, pdf_url: '' })
    expect(res.json().abstract).toBeNull()
    expect(res.json().metadata).toEqual({})
    expect(triggered).toEqual([])
  })

  it('rejects invalid kind, year, and pdf_url without changing the paper', async () => {
    for (const body of [{ kind: 'video' }, { year: 'soon' }, { pdf_url: 'ftp://x.org/a.pdf' }, { title: 'T', year: 'x' }]) {
      const res = await patch(3, body)
      expect(res.statusCode).toBe(422)
    }
    expect(row(3).title).toBe('Manual bare')
    expect(row(3).kind).toBe('article')
  })

  it('keeps the arXiv title/authors lock', async () => {
    expect((await patch(1, { title: 'X' })).statusCode).toBe(400)
    expect((await patch(1, { abstract: 'ok' })).statusCode).toBe(200)
  })
})

describe('POST /api/papers manual sources', () => {
  it('creates a project-page paper with metadata and PDF URL', async () => {
    const res = await post('/api/papers', {
      title: 'Code Video Model', authors: ['A', 'B'], link: 'https://example.org/cvm', abstract: 'Abs', year: 2026, venue: 'Tech report',
      pdf_url: 'https://example.org/cvm/tech_report.pdf',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ created: true, kind: 'paper', abstract: 'Abs', metadata: { year: 2026, venue: 'Tech report', pdf_url: 'https://example.org/cvm/tech_report.pdf' } })
    expect(triggered).toEqual([res.json().id])
  })

  it('returns the existing manual paper for the same normalized link', async () => {
    const res = await post('/api/papers', { title: 'Again', link: 'http://www.Code-Video-Model.github.io#top' })
    expect(res.json()).toMatchObject({ id: 3, created: false })
    expect(row(3).title).toBe('Manual bare')
  })

  it('stores web articles and rejects bad kinds or a missing title', async () => {
    const ok = await post('/api/papers', { title: 'Blog', link: 'https://blog.example.com/post', kind: 'article' })
    expect(ok.json().kind).toBe('article')
    expect((await post('/api/papers', { title: 'X', kind: 'video' })).statusCode).toBe(422)
    expect((await post('/api/papers', { link: 'https://x.org' })).statusCode).toBe(422)
  })
})

describe('Replacement upload', () => {
  const upload = (id: number, body: string, q = '') =>
    app.inject({ method: 'POST', url: `/api/papers/${id}/pdf${q}`, payload: Buffer.from(body), headers: { 'content-type': 'application/pdf' } })

  it('needs replace=1 when a PDF exists', async () => {
    expect((await upload(5, '%PDF new')).json().error.code).toBe('PDF_EXISTS')
  })

  it('identical content changes nothing', async () => {
    const before = row(5).pdf_path
    const res = await upload(5, '%PDF old', '?replace=1')
    expect(res.json().outcome).toBe('unchanged')
    expect(row(5).pdf_path).toBe(before)
    expect(triggered).toEqual([])
  })

  it('different content switches the file and drops derived data', async () => {
    const before = row(5).pdf_path!
    const res = await upload(5, '%PDF new version', '?replace=1')
    expect(res.json().outcome).toBe('updated')
    expect(row(5).pdf_path).not.toBe(before)
    expect(existsSync(join(workDir, before))).toBe(true)
    expect(JSON.parse(row(5).contents!)).toEqual({ user_input: 'mine' })
    expect(JSON.parse(row(5).metadata!).pdf_fetched_at).toBeDefined()
    expect(triggered).toEqual([5])
  })
})

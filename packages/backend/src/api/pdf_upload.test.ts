import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { serviceRunner } from '../services/service_runner.js'
import { paperRoutes } from './papers.js'

/** POST /api/papers/:id/pdf + derived pdf_status on GET /api/papers/:id. Runs in a temp cwd
 *  (files land in <tmp>/data/pdfs, never packages/backend/data); the runner is stubbed. */

const migrationsFolder = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
const origCwd = process.cwd()
let workDir = ''
let app: FastifyInstance
let sqlite: Database
let loggedIn = true
const triggered: number[] = []
const realTrigger = serviceRunner.triggerForPaper
const PDF = Buffer.from('%PDF-1.7\nfake pdf body\n')

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'pdf-upload-'))
  process.chdir(workDir)
  sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  setDatabaseForTesting(db)
  const now = new Date().toISOString()
  db.insert(schema.users).values({ username: 'alice', password_hash: 'x', role: 'user', created_at: now }).run()
  db.insert(schema.papers).values([
    { id: 1, corpus_id: '1', title: 'Closed', authors: '[]', metadata: JSON.stringify({ open_access_pdf_status: 'CLOSED' }), created_at: now, updated_at: now },
    { id: 2, corpus_id: '2', title: 'Has PDF', authors: '[]', pdf_path: 'data/pdfs/existing.pdf', created_at: now, updated_at: now },
  ]).run()

  serviceRunner.triggerForPaper = (async (id: number) => { triggered.push(id) }) as any

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = loggedIn ? ({ id: 1, username: 'alice', role: 'user' } as any) : null
  })
  await app.register(paperRoutes)
  await app.ready()
})

afterAll(() => {
  serviceRunner.triggerForPaper = realTrigger
  process.chdir(origCwd)
  rmSync(workDir, { recursive: true, force: true })
})

const upload = (id: number, payload: Buffer | string, type = 'application/pdf') =>
  app.inject({ method: 'POST', url: `/api/papers/${id}/pdf`, payload, headers: { 'content-type': type } })
const pdfFiles = () => (existsSync(join(workDir, 'data/pdfs')) ? readdirSync(join(workDir, 'data/pdfs')) : [])

describe('PDF upload', () => {
  it('reports upload_required / closed_access for a closed-access paper', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/papers/1' })
    expect(res.json()).toMatchObject({ pdf_status: 'upload_required', pdf_unavailable_reason: 'closed_access' })
  })

  it('rejects anonymous uploads', async () => {
    loggedIn = false
    expect((await upload(1, PDF)).statusCode).toBe(401)
    loggedIn = true
  })

  it('rejects non-PDF bodies without leaving files', async () => {
    const res = await upload(1, Buffer.from('<html>nope</html>'))
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('INVALID_PDF')
    expect(pdfFiles()).toEqual([])
  })

  it('rejects papers that already have a PDF and unknown papers', async () => {
    const res = await upload(2, PDF)
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('PDF_EXISTS')
    expect((await upload(999, PDF)).statusCode).toBe(404)
  })

  it('stores a valid PDF, sets pdf_path, and triggers the pipeline', async () => {
    const res = await upload(1, PDF)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.pdf_path).toMatch(/^data\/pdfs\/upload_1_[0-9a-f]{8}\.pdf$/)
    expect(body.pdf_status).toBe('available')
    expect(existsSync(join(workDir, body.pdf_path))).toBe(true)
    expect(triggered).toEqual([1])
    const detail = (await app.inject({ method: 'GET', url: '/api/papers/1' })).json()
    expect(detail.pdf_status).toBe('available')
    // A second upload is now refused.
    expect((await upload(1, PDF)).statusCode).toBe(409)
  })
})

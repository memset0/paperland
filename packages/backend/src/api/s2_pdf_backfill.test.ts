import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { serviceRunner } from '../services/service_runner.js'
import { serviceRoutes } from './services.js'

/** POST /api/services/backfill/s2_pdf_service: eligibility filter + admin guard.
 *  The runner is stubbed, so no S2 request is made. */

let app: FastifyInstance
let role: 'admin' | 'user' = 'admin'
const queued: Array<[string, number]> = []
const realExecute = serviceRunner.executeServiceForPaper

beforeAll(async () => {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)

  const now = new Date().toISOString()
  const base = { title: 'P', authors: '[]', created_at: now, updated_at: now }
  db.insert(schema.papers).values([
    { ...base, corpus_id: '1' }, // eligible
    { ...base, corpus_id: '2', metadata: JSON.stringify({ citation_count: 3 }) }, // eligible (enriched before openAccessPdf)
    { ...base, corpus_id: '3', metadata: JSON.stringify({ open_access_pdf_status: 'CLOSED' }) }, // already checked
    { ...base, corpus_id: '4', arxiv_id: '1706.03762' }, // arXiv paper
    { ...base, corpus_id: '5', pdf_path: 'data/pdfs/x.pdf' }, // already has a PDF
    { ...base, corpus_id: '6', listed: 0 }, // metadata-only
  ]).run()

  serviceRunner.executeServiceForPaper = (async (name: string, id: number) => { queued.push([name, id]) }) as any

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = { id: 1, username: 'u', role } as any
  })
  await app.register(serviceRoutes)
  await app.ready()
})

afterAll(() => {
  serviceRunner.executeServiceForPaper = realExecute
})

describe('POST /api/services/backfill/s2_pdf_service', () => {
  it('re-runs semantic_scholar_service only for listed corpus-only papers lacking open-access info', async () => {
    role = 'admin'
    const res = await app.inject({ method: 'POST', url: '/api/services/backfill/s2_pdf_service' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true, queued: 2 })
    expect(queued.map(([n]) => n)).toEqual(['semantic_scholar_service', 'semantic_scholar_service'])
    expect(queued.map(([, id]) => id).sort()).toEqual([1, 2])
  })

  it('rejects non-admin users', async () => {
    role = 'user'
    const res = await app.inject({ method: 'POST', url: '/api/services/backfill/s2_pdf_service' })
    expect(res.statusCode).toBe(403)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { serviceRunner } from '../services/service_runner.js'
import { paperRoutes } from './papers.js'
import { externalPaperRoutes } from '../external-api/papers.js'

/** Create / lookup / dedup by either S2 identifier (corpus_id or s2_paper_id), internal and
 *  external APIs. The service runner is stubbed, so no S2 request is made. */

const PID = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'
const PID2 = '649def34f8be52c8b66281af98ae884c09aef38b'
let app: FastifyInstance
let sqlite: Database
const realTrigger = serviceRunner.triggerForPaper
const triggered: number[] = []

beforeAll(async () => {
  sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  const userId = db.insert(schema.users).values({ username: 'alice', password_hash: 'x', role: 'user', created_at: new Date().toISOString() }).returning().get().id

  serviceRunner.triggerForPaper = (async (id: number) => { triggered.push(id) }) as any

  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = { id: userId, username: 'alice', role: 'user' } as any
  })
  await app.register(paperRoutes)
  await app.register(externalPaperRoutes)
  await app.ready()
})

afterAll(() => {
  serviceRunner.triggerForPaper = realTrigger
})

const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as any })
const row = (id: number) => sqlite.query('SELECT arxiv_id, corpus_id, s2_paper_id FROM papers WHERE id = ?').get(id) as any

describe('POST /api/papers with S2 identifiers', () => {
  it('creates by s2_paper_id parsed from a pasted URL and triggers the pipeline', async () => {
    const res = await post('/api/papers', { s2_paper_id: `https://www.semanticscholar.org/paper/Attention-is-All-you-Need-Vaswani/${PID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(true)
    expect(body.s2_paper_id).toBe(PID)
    expect(triggered).toContain(body.id)
  })

  it('returns the existing paper when the same s2_paper_id is posted again', async () => {
    const res = await post('/api/papers', { s2_paper_id: PID.toUpperCase() })
    expect(res.json().created).toBe(false)
    expect(sqlite.query('SELECT COUNT(*) c FROM papers').get()).toEqual({ c: 1 })
  })

  it('a corpus_id match backfills the missing s2_paper_id', async () => {
    const created = (await post('/api/papers', { corpus_id: 'CorpusId:13756489' })).json()
    expect(created.corpus_id).toBe('13756489')
    const res = (await post('/api/papers', { corpus_id: '13756489', s2_paper_id: PID2 })).json()
    expect(res.created).toBe(false)
    expect(res.id).toBe(created.id)
    expect(row(created.id).s2_paper_id).toBe(PID2)
  })

  it('rejects an unrecognizable identifier with 422', async () => {
    const res = await post('/api/papers', { s2_paper_id: 'not-an-id' })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('includes s2_paper_id in GET /api/papers/:id', async () => {
    const id = (sqlite.query('SELECT id FROM papers WHERE s2_paper_id = ?').get(PID) as any).id
    const res = await app.inject({ method: 'GET', url: `/api/papers/${id}` })
    expect(res.json().s2_paper_id).toBe(PID)
  })
})

describe('External API with S2 identifiers', () => {
  it('looks up by s2_paper_id', async () => {
    const res = await app.inject({ method: 'GET', url: `/external-api/v1/papers?s2_paper_id=${PID}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().paper.s2_paper_id).toBe(PID)
    const full = await app.inject({ method: 'GET', url: `/external-api/v1/papers/full?s2_paper_id=${PID}&exclude=qa,services` })
    expect(full.json().paper.s2_paper_id).toBe(PID)
  })

  it('POST dedups by s2_paper_id and creates a new one by URL', async () => {
    expect((await post('/external-api/v1/papers', { s2_paper_id: PID })).json().created).toBe(false)
    const third = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const res = (await post('/external-api/v1/papers', { corpus_id: `https://www.semanticscholar.org/paper/${third}` })).json()
    expect(res.created).toBe(true)
    expect(res.s2_paper_id).toBe(third)
  })

  it('batch accepts s2_paper_id and reports invalid items per entry', async () => {
    const res = (await post('/external-api/v1/papers/batch', { papers: [{ s2_paper_id: PID }, { corpus_id: 'bogus' }] })).json()
    expect(res.results[0]).toMatchObject({ s2_paper_id: PID, created: false })
    expect(res.results[1].error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an invalid s2_paper_id lookup with 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/external-api/v1/papers?s2_paper_id=xyz' })
    expect(res.statusCode).toBe(422)
  })
})

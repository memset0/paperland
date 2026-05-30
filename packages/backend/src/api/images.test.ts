import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import Fastify, { type FastifyInstance } from 'fastify'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve } from 'path'
import { existsSync, rmSync } from 'fs'
import { imagesRoutes } from './images.js'
import { setDatabaseForTesting, schema } from '../db/index.js'
import { storeImage, ImageValidationError, imageAbsPath } from '../services/image_store.js'
import { loadConfig, getConfig } from '../config.js'

type TestUser = { id: number; username: string; role: 'admin' | 'user' }

// A 1×1 transparent PNG (valid magic bytes + IHDR with width=1, height=1).
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const TMP_DIR = resolve(import.meta.dir, '../../../../', '.image-test-store')

let app: FastifyInstance
let db: ReturnType<typeof drizzle>
let currentUser: TestUser | null = null

function makeUser(db: ReturnType<typeof drizzle>, username: string): TestUser {
  const now = new Date().toISOString()
  const u = db.insert(schema.users).values({ username, password_hash: 'x', role: 'user', created_at: now }).returning().get()
  return { id: u.id, username: u.username, role: 'user' }
}

function makePaper(db: ReturnType<typeof drizzle>): number {
  const now = new Date().toISOString()
  const p = db.insert(schema.papers).values({ title: 'T', authors: '[]', created_at: now, updated_at: now }).returning().get()
  return p.id
}

beforeEach(() => {
  loadConfig() // load real config.yml, then redirect image storage to a throwaway dir
  getConfig().image_host.dir = TMP_DIR
  getConfig().image_host.max_size_mb = 18
  getConfig().image_host.allowed_types = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true })

  const sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(import.meta.dir, '../db/migrations') })
  setDatabaseForTesting(db)
  currentUser = null

  app = Fastify()
  app.addHook('onRequest', async (request) => { ;(request as any).user = currentUser })
  app.register(imagesRoutes)
})

afterAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('storeImage', () => {
  it('stores a valid PNG content-addressed, with sniffed dimensions and a dated path', () => {
    const { row, deduped } = storeImage(`data:image/png;base64,${PNG_1x1}`, { originalName: 'x.png', userId: 1 })
    expect(deduped).toBe(false)
    expect(row.hash).toMatch(/^[0-9a-f]{6}$/)
    expect(row.ext).toBe('png')
    expect(row.mime).toBe('image/png')
    expect(row.width).toBe(1)
    expect(row.height).toBe(1)
    expect(row.path).toMatch(/^\d{4}\/\d{2}\/\d{2}\/[0-9a-f]{6}\.png$/)
    expect(existsSync(imageAbsPath(row.path))).toBe(true)
  })

  it('dedupes identical bytes to one row/file', () => {
    const a = storeImage(PNG_1x1)
    const b = storeImage(PNG_1x1)
    expect(b.deduped).toBe(true)
    expect(b.row.hash).toBe(a.row.hash)
    expect(db.select().from(schema.images).all().length).toBe(1)
  })

  it('rejects non-image bytes', () => {
    expect(() => storeImage(Buffer.from('hello world').toString('base64'))).toThrow(ImageValidationError)
  })

  it('rejects oversized images', () => {
    getConfig().image_host.max_size_mb = 0.0000001
    expect(() => storeImage(PNG_1x1)).toThrow(ImageValidationError)
  })

  it('rejects a disallowed (but real) image type', () => {
    getConfig().image_host.allowed_types = ['image/jpeg']
    expect(() => storeImage(PNG_1x1)).toThrow(ImageValidationError)
  })
})

describe('image routes', () => {
  it('POST /api/images requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/images', payload: { data: PNG_1x1 } })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/images stores and returns the canonical URL', async () => {
    currentUser = makeUser(db, 'alice')
    const res = await app.inject({ method: 'POST', url: '/api/images', payload: { data: PNG_1x1, filename: 'a.png' } })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.url).toBe(`/image/${body.data.path}`)
    // second upload of the same bytes dedupes → 200
    const res2 = await app.inject({ method: 'POST', url: '/api/images', payload: { data: PNG_1x1 } })
    expect(res2.statusCode).toBe(200)
  })

  it('POST /api/images rejects junk with 400', async () => {
    currentUser = makeUser(db, 'alice')
    const res = await app.inject({ method: 'POST', url: '/api/images', payload: { data: Buffer.from('nope').toString('base64') } })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/images counts references across note bodies', async () => {
    currentUser = makeUser(db, 'alice')
    const up = await app.inject({ method: 'POST', url: '/api/images', payload: { data: PNG_1x1 } })
    const { hash, url } = up.json().data
    const paperId = makePaper(db)
    const now = new Date().toISOString()
    // one note references it twice, one note not at all
    db.insert(schema.notes).values({ user_id: currentUser.id, paper_id: paperId, kind: 'note', parent_id: null, body: `![](${url}) and again ![](${url})`, sort_order: 0, created_at: now, updated_at: now }).run()
    db.insert(schema.notes).values({ user_id: currentUser.id, paper_id: paperId, kind: 'note', parent_id: null, body: 'no images here', sort_order: 1, created_at: now, updated_at: now }).run()

    const res = await app.inject({ method: 'GET', url: '/api/images' })
    const body = res.json()
    const img = body.data.find((i: any) => i.hash === hash)
    expect(img.reference_count).toBe(2)
    expect(body).toHaveProperty('public_base_url')
  })

  it('DELETE /api/images/:hash removes the row and the file', async () => {
    currentUser = makeUser(db, 'alice')
    const up = await app.inject({ method: 'POST', url: '/api/images', payload: { data: PNG_1x1 } })
    const { hash, path } = up.json().data
    expect(existsSync(imageAbsPath(path))).toBe(true)

    const res = await app.inject({ method: 'DELETE', url: `/api/images/${hash}` })
    expect(res.statusCode).toBe(200)
    expect(db.select().from(schema.images).all().length).toBe(0)
    expect(existsSync(imageAbsPath(path))).toBe(false)
  })
})

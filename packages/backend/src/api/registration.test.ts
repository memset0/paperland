import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { tmpdir } from 'os'
import * as schema from '../db/schema.js'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting } from '../db/index.js'
import { identityHook } from '../auth/identity_hook.js'
import { authRoutes } from './auth.js'
import { userRoutes } from './users.js'
import { paperRoutes } from './papers.js'
import { notesRoutes } from './notes.js'
import { fileRoutes } from './files.js'

/** Self-registration + admin review, the website login wall, and /api/files confinement. */

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
const fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-registration-'))
const origCwd = process.cwd()
let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>
let app: FastifyInstance

function writeConfig(registration = true) {
  const p = join(fixtureDir, 'config.yml')
  writeFileSync(p, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: true, registration_enabled: ${registration} }
models: { default: m, available: [{ name: m, type: codex, shell: "true", timeout: 5 }] }
content_priority: [user_input, pdf_parsed]
qa: [{ name: summary, prompt: Summary }]
translation: { prompt: 'Translate {TEXT}' }
image_host: { dir: ${fixtureDir}/images }
`, 'utf8')
  loadConfig(p)
}

async function login(username: string, password = 'pw') {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } })
  const c = res.cookies.find((x) => x.name === 'paperland_session')
  return { res, cookie: c ? `paperland_session=${c.value}` : undefined }
}
const as = (cookieHeader: string | undefined, method: any, url: string, payload?: unknown) =>
  app.inject({ method, url, payload: payload as any, headers: cookieHeader ? { cookie: cookieHeader } : {} })

beforeAll(() => {
  // /api/files resolves against cwd: give it a data/ dir with a PDF and a non-PDF.
  mkdirSync(join(fixtureDir, 'data', 'pdfs'), { recursive: true })
  writeFileSync(join(fixtureDir, 'data', 'pdfs', 'a.pdf'), '%PDF-1.4 test')
  writeFileSync(join(fixtureDir, 'data', 'paperland.db'), 'secret')
  writeFileSync(join(fixtureDir, 'config.secret'), 'secret')
  process.chdir(fixtureDir)
})
afterAll(() => { process.chdir(origCwd); rmSync(fixtureDir, { recursive: true, force: true }) })

beforeEach(async () => {
  writeConfig()
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  setDatabaseForTesting(db)
  const now = new Date().toISOString()
  db.insert(schema.users).values({ username: 'root', password_hash: Bun.password.hashSync('pw'), role: 'admin', created_at: now }).run()
  db.insert(schema.papers).values({ arxiv_id: '1706.03762', title: 'Attention', authors: '[]', created_at: now, updated_at: now }).run()
  app = Fastify()
  await app.register(cookie)
  app.get('/api/health', async () => ({ status: 'ok' }))
  app.addHook('onRequest', identityHook)
  for (const r of [authRoutes, userRoutes, paperRoutes, notesRoutes, fileRoutes]) await app.register(r)
})
afterEach(async () => { await app.close(); sqlite.close() })

describe('registration and review', () => {
  test('register → pending (cannot log in) → approve → login with starter paper', async () => {
    const reg = await as(undefined, 'POST', '/api/auth/register', { username: ' carol ', password: 'pw', nickname: 'Carol' })
    expect(reg.statusCode).toBe(201)
    expect(reg.json().user).toMatchObject({ username: 'carol', nickname: 'Carol', status: 'pending' })
    expect(reg.cookies.length).toBe(0)

    const pending = await login('carol')
    expect(pending.res.statusCode).toBe(403)
    expect(pending.res.json().error.code).toBe('ACCOUNT_PENDING')
    expect(pending.cookie).toBeUndefined()
    expect((await login('carol', 'wrong')).res.statusCode).toBe(401) // still generic

    const admin = (await login('root')).cookie
    const list = (await as(admin, 'GET', '/api/users')).json().data
    const carol = list.find((u: any) => u.username === 'carol')
    expect(carol.status).toBe('pending')
    expect((await as(admin, 'POST', `/api/users/${carol.id}/approve`)).json().data.status).toBe('active')

    const ok = await login('carol')
    expect(ok.res.statusCode).toBe(200)
    const mine = (await as(ok.cookie, 'GET', '/api/papers')).json().data
    expect(mine.map((p: any) => p.arxiv_id)).toEqual(['1706.03762'])
  })

  test('duplicate, invalid and disabled registration', async () => {
    expect((await as(undefined, 'POST', '/api/auth/register', { username: 'root', password: 'x' })).statusCode).toBe(409)
    expect((await as(undefined, 'POST', '/api/auth/register', { username: '  ', password: 'x' })).statusCode).toBe(400)
    expect((await as(undefined, 'POST', '/api/auth/register', { username: 'x'.repeat(65), password: 'x' })).statusCode).toBe(400)
    expect((await as(undefined, 'GET', '/api/auth/me')).json()).toEqual({ user: null, registration_enabled: true })
    writeConfig(false)
    expect((await as(undefined, 'POST', '/api/auth/register', { username: 'dave', password: 'x' })).statusCode).toBe(403)
    expect((await as(undefined, 'GET', '/api/auth/me')).json().registration_enabled).toBe(false)
  })

  test('reject deletes only pending accounts; non-admins forbidden', async () => {
    await as(undefined, 'POST', '/api/auth/register', { username: 'eve', password: 'pw' })
    const admin = (await login('root')).cookie
    const eve = (await as(admin, 'GET', '/api/users')).json().data.find((u: any) => u.username === 'eve')
    expect((await as(admin, 'DELETE', '/api/users/1')).statusCode).toBe(400) // active admin
    expect((await as(admin, 'DELETE', `/api/users/${eve.id}`)).statusCode).toBe(200)
    expect((await as(admin, 'DELETE', `/api/users/${eve.id}`)).statusCode).toBe(404)
    // username freed
    expect((await as(undefined, 'POST', '/api/auth/register', { username: 'eve', password: 'pw' })).statusCode).toBe(201)
    db.insert(schema.users).values({ username: 'bob', password_hash: Bun.password.hashSync('pw'), role: 'user', created_at: 'now' }).run()
    const bob = (await login('bob')).cookie
    expect((await as(bob, 'POST', `/api/users/${eve.id}/approve`)).statusCode).toBe(403)
  })

  test('a session of a non-active account does not resolve', async () => {
    const admin = await login('root')
    db.update(schema.users).set({ status: 'pending' }).run()
    expect((await as(admin.cookie, 'GET', '/api/auth/me')).json().user).toBeNull()
  })
})

describe('login wall', () => {
  test('anonymous callers only reach the allowlist', async () => {
    for (const url of ['/api/papers', '/api/papers/1', '/api/users', '/api/notes', '/api/files/data%2Fpdfs%2Fa.pdf']) {
      expect((await as(undefined, 'GET', url)).statusCode).toBe(401)
    }
    expect((await as(undefined, 'POST', '/api/papers', { title: 'x' })).statusCode).toBe(401)
    expect((await as(undefined, 'GET', '/api/health')).statusCode).toBe(200)
    expect((await as(undefined, 'GET', '/api/auth/me')).statusCode).toBe(200)
    expect((await as(undefined, 'GET', '/api/no-such-route')).statusCode).toBe(404)
  })

  test('published notes stay readable by link; unpublished do not', async () => {
    const now = new Date().toISOString()
    const pub = db.insert(schema.notes).values({ user_id: 1, paper_id: 1, body: '# Hi', is_public: 1, created_at: now, updated_at: now }).returning().get()
    db.insert(schema.users).values({ username: 'bob', password_hash: 'x', role: 'user', created_at: now }).run()
    const priv = db.insert(schema.notes).values({ user_id: 2, paper_id: 1, body: 'secret', is_public: 0, created_at: now, updated_at: now }).returning().get()
    const res = await as(undefined, 'GET', `/api/notes/${pub.id}`)
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ body: '# Hi', paper_title: 'Attention' })
    expect((await as(undefined, 'GET', `/api/notes/${priv.id}`)).statusCode).toBe(404)
  })

  test('/api/files serves only PDFs inside data/', async () => {
    const c = (await login('root')).cookie
    const ok = await as(c, 'GET', '/api/files/data%2Fpdfs%2Fa.pdf')
    expect(ok.statusCode).toBe(200)
    expect(ok.headers['content-type']).toBe('application/pdf')
    for (const p of ['data%2Fpaperland.db', 'config.secret', '..%2F..%2Fetc%2Fpasswd', 'data%2F..%2Fconfig.secret', '%2Fetc%2Fpasswd', 'data%2Fpdfs%2Fmissing.pdf']) {
      expect((await as(c, 'GET', `/api/files/${p}`)).statusCode).toBe(404)
    }
  })
})

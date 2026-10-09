import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve, dirname } from 'path'
import Fastify, { type FastifyInstance } from 'fastify'
import * as schema from '../db/schema.js'
import { setDatabaseForTesting } from '../db/index.js'
import { extensionRoutes } from './extension.js'
import { getOrCreateOpenToken } from '../auth/open_token.js'

/** Personalized browser-extension download: zip validity (checked with the system `unzip`),
 *  runtime-only contents, embedded preset, and auth / validation errors. */

let app: FastifyInstance
let userId: number
let currentUserId: number | null = null

beforeAll(async () => {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations') })
  setDatabaseForTesting(db)
  userId = db.insert(schema.users).values({ username: 'alice', password_hash: 'x', role: 'user', created_at: new Date().toISOString() }).returning().get().id
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = currentUserId == null ? null : ({ id: currentUserId, username: 'alice', role: 'user' } as any)
  })
  await app.register(extensionRoutes)
  await app.ready()
})

/** Run the system `unzip` on the payload: `unzip <opts> x.zip <members>`. */
function unzip(buf: Buffer, opts: string[], members: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'ext-zip-'))
  try {
    const file = join(dir, 'x.zip')
    writeFileSync(file, buf)
    const res = Bun.spawnSync(['unzip', ...opts, file, ...members])
    if (res.exitCode !== 0) throw new Error(`unzip ${opts.join(' ')} failed: ${res.stderr.toString()}`)
    return res.stdout.toString()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('GET /api/extension/download', () => {
  it('returns a valid zip of runtime files with the user preset', async () => {
    currentUserId = userId
    const res = await app.inject({ method: 'GET', url: '/api/extension/download?base_url=https://paper.example.com/' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/zip')
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="paperland-extension-\d+\.\d+\.\d+\.zip"$/)
    const zip = res.rawPayload

    unzip(zip, ['-tq']) // CRCs + structure
    const names = unzip(zip, ['-Z1']).trim().split('\n')
    expect(names).toContain('manifest.json')
    expect(names).toContain('icons/icon-128.png')
    expect(names).toContain('src/background.js')
    expect(names).toContain('src/preset.json')
    expect(names.some((n) => n.startsWith('test/') || n === 'package.json')).toBe(false)

    const preset = JSON.parse(unzip(zip, ['-p'], ['src/preset.json']))
    expect(preset).toEqual({ base_url: 'https://paper.example.com', token: getOrCreateOpenToken(userId) })
  })

  it('rejects a missing or non-http base_url with 422', async () => {
    currentUserId = userId
    for (const q of ['', '?base_url=', '?base_url=javascript:alert(1)', '?base_url=/relative']) {
      expect((await app.inject({ method: 'GET', url: `/api/extension/download${q}` })).statusCode).toBe(422)
    }
  })

  it('rejects anonymous callers with 401', async () => {
    currentUserId = null
    expect((await app.inject({ method: 'GET', url: '/api/extension/download?base_url=https://x.dev' })).statusCode).toBe(401)
  })
})


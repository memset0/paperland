import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sharingRoutes } from './sharing.js'
import { getDatabase, setDatabaseForTesting } from '../db/index.js'
import * as schema from '../db/schema.js'
import { canViewOwnedRow, ownerVisibilityFilter, setDefaultSharedForTesting, setSharingPrefs, sharedFlagsFor } from '../auth/visibility.js'

let sqlite: Database
let app: FastifyInstance

const alice = { id: 1, username: 'alice', role: 'user' }
const bob = { id: 2, username: 'bob', role: 'user' }
const admin = { id: 3, username: 'admin', role: 'admin' }

beforeEach(async () => {
  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL, nickname TEXT);
    CREATE TABLE user_sharing_settings (
      user_id INTEGER NOT NULL, data_type TEXT NOT NULL, shared INTEGER NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, data_type)
    );
    CREATE TABLE paper_reference_links (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, paper_id INTEGER NOT NULL, title TEXT, url TEXT NOT NULL,
      description TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO users (id, username, role) VALUES (1,'alice','user'),(2,'bob','user'),(3,'admin','admin');
    INSERT INTO paper_reference_links VALUES
      (1,1,42,NULL,'https://a.example',NULL,'t','t'),
      (2,2,42,NULL,'https://b.example',NULL,'t','t'),
      (3,3,42,NULL,'https://c.example',NULL,'t','t');
  `)
  setDatabaseForTesting(drizzle(sqlite, { schema }))
  app = Fastify()
  app.addHook('onRequest', async (request) => {
    const id = Number(request.headers['x-test-user'] || 0)
    request.user = ([alice, bob, admin].find((u) => u.id === id) as any) ?? null
  })
  await app.register(sharingRoutes)
})

afterEach(async () => {
  setDefaultSharedForTesting(null)
  await app.close()
  sqlite.close()
})

function visibleLinkOwners(viewer: any, scope: 'mine' | 'all'): number[] {
  const t = schema.paperReferenceLinks
  return getDatabase().select().from(t)
    .where(ownerVisibilityFilter(viewer, 'reference_links', t.user_id, scope))
    .all().map((r) => r.user_id).sort()
}

describe('visibility helper', () => {
  test('mine returns only own rows', () => {
    expect(visibleLinkOwners(bob, 'mine')).toEqual([2])
  })

  test('default shared: non-admin all sees everyone who has not opted out', () => {
    expect(visibleLinkOwners(bob, 'all')).toEqual([1, 2, 3])
    setSharingPrefs(1, { reference_links: false })
    expect(visibleLinkOwners(bob, 'all')).toEqual([2, 3])
    // other types unaffected
    expect(sharedFlagsFor('notes', [1]).get(1)).toBe(true)
  })

  test('default private: non-admin all sees only own rows plus explicit opt-ins', () => {
    setDefaultSharedForTesting(false)
    expect(visibleLinkOwners(bob, 'all')).toEqual([2])
    setSharingPrefs(1, { reference_links: true })
    expect(visibleLinkOwners(bob, 'all')).toEqual([1, 2])
    expect(visibleLinkOwners(admin, 'all')).toEqual([1, 2, 3])
  })

  test('opted-out owner still sees own rows in all scope', () => {
    setSharingPrefs(1, { reference_links: false })
    expect(visibleLinkOwners(alice, 'all')).toEqual([1, 2, 3])
  })

  test('admin all ignores switches', () => {
    setSharingPrefs(1, { reference_links: false })
    expect(visibleLinkOwners(admin, 'all')).toEqual([1, 2, 3])
    expect(sharedFlagsFor('reference_links', [1, 2]).get(1)).toBe(false)
  })

  test('anonymous sees nothing', () => {
    expect(visibleLinkOwners(null, 'all')).toEqual([])
  })

  test('single-row check', () => {
    setSharingPrefs(1, { notes: false })
    expect(canViewOwnedRow(bob, 1, 'notes')).toBe(false)
    expect(canViewOwnedRow(alice, 1, 'notes')).toBe(true)
    expect(canViewOwnedRow(admin, 1, 'notes')).toBe(true)
    expect(canViewOwnedRow(null, 1, 'notes')).toBe(false)
    expect(canViewOwnedRow(bob, 1, 'qa')).toBe(true)
  })
})

describe('sharing preferences API', () => {
  test('GET returns defaults', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me/sharing', headers: { 'x-test-user': '1' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ highlights: true, notes: true, qa: true, reference_links: true })
  })

  test('PUT updates a subset', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/auth/me/sharing', headers: { 'x-test-user': '1' }, payload: { notes: false } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ highlights: true, notes: false, qa: true, reference_links: true })
    const again = await app.inject({ method: 'GET', url: '/api/auth/me/sharing', headers: { 'x-test-user': '1' } })
    expect(again.json().data.notes).toBe(false)
    const other = await app.inject({ method: 'GET', url: '/api/auth/me/sharing', headers: { 'x-test-user': '2' } })
    expect(other.json().data.notes).toBe(true)
  })

  test('PUT rejects unknown keys and non-booleans without changes', async () => {
    for (const payload of [{ tags: true }, { notes: 'no' }, { notes: false, images: false }]) {
      const res = await app.inject({ method: 'PUT', url: '/api/auth/me/sharing', headers: { 'x-test-user': '1' }, payload })
      expect(res.statusCode).toBe(400)
    }
    const res = await app.inject({ method: 'GET', url: '/api/auth/me/sharing', headers: { 'x-test-user': '1' } })
    expect(res.json().data.notes).toBe(true)
  })

  test('anonymous rejected', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/me/sharing' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'PUT', url: '/api/auth/me/sharing', payload: { qa: false } })).statusCode).toBe(401)
  })
})

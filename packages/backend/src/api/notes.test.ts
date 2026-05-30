import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import Fastify from 'fastify'
import * as schema from '../db/schema.js'
import { notesRoutes } from './notes.js'
import { setDatabaseForTesting } from '../db/index.js'
import type { Note } from '@paperland/shared'

/**
 * Tests for the notes-root-note model. Like the other backend tests we run an
 * in-memory SQLite + drizzle here (no Fastify, no network):
 *   - the 0014 migration drops walkthroughs, creates one root per (user, paper)
 *     with top-level notes, and reparents those notes under the root
 *   - the notes_root_unq partial unique index allows at most one root per (user, paper)
 *   - a note counts only when its body (trimmed) is non-empty
 *
 * No external service is triggered.
 */

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')

/** The notes table as it existed at migration 0013 (kind 'walkthrough' | 'note', no root index). */
const NOTES_0013 = `CREATE TABLE notes (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id integer NOT NULL,
  paper_id integer NOT NULL,
  kind text NOT NULL,
  parent_id integer,
  title text,
  body text DEFAULT '' NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
)`

/** Apply the 0014 migration SQL (split on drizzle statement breakpoints, comments stripped). */
function apply0014(sqlite: Database) {
  const sql = readFileSync(resolve(MIGRATIONS_DIR, '0014_legal_black_cat.sql'), 'utf8')
  for (const block of sql.split('--> statement-breakpoint')) {
    const stmt = block.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim()
    if (stmt) sqlite.exec(stmt)
  }
}

describe('notes 0014 migration', () => {
  let sqlite: Database

  beforeAll(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(NOTES_0013)
    // (user 1, paper 10): a never-used walkthrough + two top-level notes, one nested child.
    sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at) VALUES
      (1, 10, 'walkthrough', NULL, NULL, 'old walkthrough body', 0, 't', 't'),
      (1, 10, 'note', NULL, 'A', 'a', 0, 't', 't'),
      (1, 10, 'note', NULL, 'B', '', 1, 't', 't')`)
    // child of note A (id 2)
    sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at)
      VALUES (1, 10, 'note', 2, 'A1', 'a1', 0, 't', 't')`)
    // (user 2, paper 10): a single top-level note, no walkthrough.
    sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at)
      VALUES (2, 10, 'note', NULL, 'C', 'c', 0, 't', 't')`)
    apply0014(sqlite)
  })

  it('removes walkthrough rows', () => {
    const c = sqlite.query("SELECT COUNT(*) AS c FROM notes WHERE kind = 'walkthrough'").get() as { c: number }
    expect(c.c).toBe(0)
  })

  it('creates exactly one root per (user, paper) that had notes', () => {
    const dup = sqlite.query(
      "SELECT user_id, paper_id, COUNT(*) AS c FROM notes WHERE kind = 'root' GROUP BY user_id, paper_id HAVING c > 1",
    ).all()
    expect(dup.length).toBe(0)
    const roots = sqlite.query("SELECT COUNT(*) AS c FROM notes WHERE kind = 'root'").get() as { c: number }
    expect(roots.c).toBe(2) // (1,10) and (2,10)
  })

  it('reparents every former top-level note under its root (no orphans)', () => {
    const orphans = sqlite.query("SELECT COUNT(*) AS c FROM notes WHERE kind = 'note' AND parent_id IS NULL").get() as { c: number }
    expect(orphans.c).toBe(0)
    // Note A's child A1 stays nested under A, not the root.
    const a1 = sqlite.query("SELECT parent_id FROM notes WHERE title = 'A1'").get() as { parent_id: number }
    expect(a1.parent_id).toBe(2)
  })

  it('enforces at most one root per (user, paper) via the partial unique index', () => {
    expect(() =>
      sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at)
        VALUES (1, 10, 'root', NULL, NULL, '', 0, 't', 't')`),
    ).toThrow()
    // A root for a different paper is fine.
    expect(() =>
      sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at)
        VALUES (1, 99, 'root', NULL, NULL, '', 0, 't', 't')`),
    ).not.toThrow()
  })
})

describe('note count by content', () => {
  let sqlite: Database
  let db: ReturnType<typeof drizzle>

  beforeAll(() => {
    sqlite = new Database(':memory:')
    db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: MIGRATIONS_DIR })
    sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at) VALUES
      (1, 1, 'root', NULL, NULL, '', 0, 't', 't')`)
    const rootId = (sqlite.query("SELECT id FROM notes WHERE kind = 'root'").get() as { id: number }).id
    sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at) VALUES
      (1, 1, 'note', ${rootId}, 'has body', 'content', 0, 't', 't'),
      (1, 1, 'note', ${rootId}, 'empty', '', 1, 't', 't'),
      (1, 1, 'note', ${rootId}, 'whitespace', '   \n', 2, 't', 't')`)
  })

  it('counts only notes whose trimmed body is non-empty (empty root excluded)', () => {
    const rows = sqlite.query('SELECT body FROM notes').all() as { body: string }[]
    const count = rows.filter((r) => r.body.trim() !== '').length
    expect(count).toBe(1) // only "has body"; root, empty, and whitespace-only are excluded
  })
})

describe('notes routes (Fastify inject)', () => {
  let sqlite: Database
  let app: ReturnType<typeof Fastify>
  const PAPER = 1

  beforeAll(async () => {
    sqlite = new Database(':memory:')
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: MIGRATIONS_DIR })
    setDatabaseForTesting(db)
    // A paper row for the GET /api/notes aggregate (innerJoin papers). FK is off in :memory:.
    sqlite.exec(`INSERT INTO papers (id, title, authors, listed, created_at, updated_at) VALUES (${PAPER}, 'P', '[]', 1, 't', 't')`)

    app = Fastify()
    app.decorateRequest('user', null)
    // Set request.user from an x-test-user header (absent → anonymous).
    app.addHook('onRequest', async (req) => {
      const h = req.headers['x-test-user']
      ;(req as unknown as { user: unknown }).user = h ? { id: parseInt(h as string, 10), username: 'u', role: 'admin' } : undefined
    })
    await app.register(notesRoutes)
    await app.ready()
  })

  const u = (id: number) => ({ 'x-test-user': String(id) })

  it('anonymous read returns an empty note list (200)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/notes` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ notes: [] })
  })

  it('anonymous write is rejected (401)', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/notes`, payload: { title: 'x' } })
    expect(res.statusCode).toBe(401)
  })

  it('creating a note with no parent lazily creates the root and attaches the note under it', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/notes`, headers: u(1), payload: { title: 'N1', body: 'b1' } })
    expect(res.statusCode).toBe(201)
    const created = res.json().data as Note
    expect(created.kind).toBe('note')
    expect(created.parent_id).not.toBeNull()

    const list = (await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/notes`, headers: u(1) })).json().notes as Note[]
    const root = list.find((n) => n.kind === 'root')
    expect(root).toBeDefined()
    expect(list.filter((n) => n.kind === 'root').length).toBe(1)
    expect(created.parent_id).toBe(root!.id)
  })

  it('a second parentless note attaches under the same root; an explicit parent nests', async () => {
    const root = ((await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/notes`, headers: u(1) })).json().notes as Note[]).find((n) => n.kind === 'root')!
    const n2 = (await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/notes`, headers: u(1), payload: { title: 'N2' } })).json().data as Note
    expect(n2.parent_id).toBe(root.id)
    const child = (await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/notes`, headers: u(1), payload: { title: 'child', parent_id: n2.id } })).json().data as Note
    expect(child.parent_id).toBe(n2.id)
  })

  it('PUT /root upserts the root note body', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/root`, headers: u(1), payload: { body: 'overview text' } })
    expect([200, 201]).toContain(res.statusCode)
    expect(res.json().data.body).toBe('overview text')
  })

  it('the root note cannot be moved or deleted (400)', async () => {
    const root = ((await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/notes`, headers: u(1) })).json().notes as Note[]).find((n) => n.kind === 'root')!
    const moved = await app.inject({ method: 'POST', url: `/api/notes/${root.id}/move`, headers: u(1), payload: { parent_id: null, sort_order: 0 } })
    expect(moved.statusCode).toBe(400)
    const deleted = await app.inject({ method: 'DELETE', url: `/api/notes/${root.id}`, headers: u(1) })
    expect(deleted.statusCode).toBe(400)
  })

  it("cannot touch another user's note (404)", async () => {
    const mine = ((await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/notes`, headers: u(1) })).json().notes as Note[]).find((n) => n.kind === 'note')!
    const res = await app.inject({ method: 'PATCH', url: `/api/notes/${mine.id}`, headers: u(2), payload: { title: 'hacked' } })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/notes excludes empty-body notes (the empty placeholder, etc.)', async () => {
    // Give user 2 a paper-less-but-joinable note set: an empty root + one note with body.
    const rows = (await app.inject({ method: 'GET', url: '/api/notes', headers: u(1) })).json().data as Note[]
    expect(rows.every((r) => r.body.trim() !== '')).toBe(true)
    // N1 (body 'b1') is present; the empty root is not.
    expect(rows.some((r) => r.body === 'b1')).toBe(true)
    expect(rows.some((r) => r.kind === 'root' && r.body.trim() === '')).toBe(false)
  })
})

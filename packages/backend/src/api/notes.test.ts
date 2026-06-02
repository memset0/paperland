import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import Fastify from 'fastify'
import * as schema from '../db/schema.js'
import { notesRoutes } from './notes.js'
import { setDatabaseForTesting } from '../db/index.js'
import { flattenTreeToMarkdown, migrateNotesToSingleDoc } from '../db/notes-migration.js'
import type { Note, NoteWithAuthor, PublicNoteSummary } from '@paperland/shared'

/**
 * Tests for the single-document notes model. In-memory SQLite + drizzle (no network, no
 * external services):
 *   - flattenTreeToMarkdown: tree → one Markdown document (depth headings, body re-leveling)
 *   - migrateNotesToSingleDoc: collapses the old tree into one row per (user, paper)
 *   - the new GET/PUT single-document endpoints + the /api/notes aggregate
 */

const MIGRATIONS_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')

/** The old tree-shaped notes table (kind/parent_id/title/sort_order), for migration tests.
 *  Declares the self-referential parent_id FK like the real schema so that, with
 *  `foreign_keys = ON` (as the app runs), the collapse's delete order is exercised. */
const NOTES_OLD = `CREATE TABLE notes (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id integer NOT NULL,
  paper_id integer NOT NULL,
  kind text NOT NULL,
  parent_id integer REFERENCES notes(id),
  title text,
  body text DEFAULT '' NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
)`

type Row = Parameters<typeof flattenTreeToMarkdown>[0][number]
const row = (p: Partial<Row> & Pick<Row, 'id' | 'kind'>): Row => ({
  id: p.id, user_id: p.user_id ?? 1, paper_id: p.paper_id ?? 10, kind: p.kind,
  parent_id: p.parent_id ?? null, title: p.title ?? null, body: p.body ?? '', sort_order: p.sort_order ?? 0,
})

describe('flattenTreeToMarkdown', () => {
  it('flattens a multi-node tree to depth-based headings with the root body as preamble', () => {
    const md = flattenTreeToMarkdown([
      row({ id: 1, kind: 'root', body: 'Overview' }),
      row({ id: 2, kind: 'note', parent_id: 1, title: 'A', body: 'a', sort_order: 0 }),
      row({ id: 3, kind: 'note', parent_id: 1, title: 'B', body: '', sort_order: 1 }),
      row({ id: 4, kind: 'note', parent_id: 2, title: 'A1', body: 'a1', sort_order: 0 }),
    ])
    expect(md).toBe('Overview\n\n## A\n\na\n\n### A1\n\na1\n\n## B')
  })

  it('uses (untitled) for a note with no title', () => {
    const md = flattenTreeToMarkdown([
      row({ id: 1, kind: 'root', body: '' }),
      row({ id: 2, kind: 'note', parent_id: 1, title: null, body: 'x', sort_order: 0 }),
    ])
    expect(md).toBe('## (untitled)\n\nx')
  })

  it('re-levels headings authored inside a note body to nest under the note', () => {
    const md = flattenTreeToMarkdown([
      row({ id: 1, kind: 'root', body: '' }),
      row({ id: 2, kind: 'note', parent_id: 1, title: 'X', body: '# Sub\ntext', sort_order: 0 }),
    ])
    // body's shallowest authored heading (#) sits one level below the note (H2) → ###
    expect(md).toBe('## X\n\n### Sub\ntext')
  })

  it('is idempotent on an already-collapsed single root row', () => {
    const doc = 'Overview\n\n## A\n\na'
    const md = flattenTreeToMarkdown([row({ id: 1, kind: 'root', body: doc })])
    expect(md).toBe(doc)
  })

  it('handles a paper whose notes have no root row (parentless notes become top level)', () => {
    const md = flattenTreeToMarkdown([
      row({ id: 5, kind: 'note', parent_id: null, title: 'C', body: 'c', sort_order: 0 }),
    ])
    expect(md).toBe('## C\n\nc')
  })
})

describe('migrateNotesToSingleDoc', () => {
  let sqlite: Database

  beforeAll(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(NOTES_OLD)
    sqlite.exec('PRAGMA foreign_keys = ON') // match the real app, so the FK-safe collapse is exercised
    // (user 1, paper 10): root + two top-level notes, one nested child.
    sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at) VALUES
      (1, 10, 'root', NULL, NULL, 'Overview', 0, 't', 't'),
      (1, 10, 'note', NULL, 'A', 'a', 0, 't', 't'),
      (1, 10, 'note', NULL, 'B', '', 1, 't', 't')`)
    const aId = (sqlite.query("SELECT id FROM notes WHERE title = 'A'").get() as { id: number }).id
    const rootId = (sqlite.query("SELECT id FROM notes WHERE kind = 'root'").get() as { id: number }).id
    sqlite.query(`UPDATE notes SET parent_id = ? WHERE title IN ('A','B')`).run(rootId)
    sqlite.query(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at)
      VALUES (1, 10, 'note', ?, 'A1', 'a1', 0, 't', 't')`).run(aId)
    // (user 2, paper 10): a single note, no root row.
    sqlite.exec(`INSERT INTO notes (user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at)
      VALUES (2, 10, 'note', NULL, 'C', 'c', 0, 't', 't')`)
    migrateNotesToSingleDoc(sqlite)
  })

  it('collapses to exactly one row per (user, paper)', () => {
    const dup = sqlite.query(
      'SELECT user_id, paper_id, COUNT(*) AS c FROM notes GROUP BY user_id, paper_id HAVING c > 1',
    ).all()
    expect(dup.length).toBe(0)
    const total = (sqlite.query('SELECT COUNT(*) AS c FROM notes').get() as { c: number }).c
    expect(total).toBe(2) // (1,10) and (2,10)
  })

  it('writes the flattened document into the surviving row', () => {
    const r1 = sqlite.query('SELECT body FROM notes WHERE user_id = 1 AND paper_id = 10').get() as { body: string }
    expect(r1.body).toBe('Overview\n\n## A\n\na\n\n### A1\n\na1\n\n## B')
  })

  it('flattens a rootless group too', () => {
    const r2 = sqlite.query('SELECT body FROM notes WHERE user_id = 2 AND paper_id = 10').get() as { body: string }
    expect(r2.body).toBe('## C\n\nc')
  })

  it('is a no-op once the kind column is gone (new schema)', () => {
    const fresh = new Database(':memory:')
    fresh.exec(`CREATE TABLE notes (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, user_id integer NOT NULL, paper_id integer NOT NULL, body text DEFAULT '' NOT NULL, created_at text NOT NULL, updated_at text NOT NULL)`)
    fresh.exec(`INSERT INTO notes (user_id, paper_id, body, created_at, updated_at) VALUES (1, 1, 'doc', 't', 't')`)
    expect(() => migrateNotesToSingleDoc(fresh)).not.toThrow()
    const c = (fresh.query('SELECT COUNT(*) AS c FROM notes').get() as { c: number }).c
    expect(c).toBe(1)
  })
})

describe('notes routes (Fastify inject)', () => {
  let sqlite: Database
  let app: ReturnType<typeof Fastify>
  let currentUser: { id: number; username: string; role: string } | null
  const PAPER = 1

  // Fresh app + DB per test (mirrors the reference_links harness): `currentUser` drives auth;
  // setting it to null exercises the anonymous/requireUser path.
  beforeEach(async () => {
    sqlite = new Database(':memory:')
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: MIGRATIONS_DIR })
    setDatabaseForTesting(db)
    sqlite.exec(`INSERT INTO papers (id, title, authors, listed, created_at, updated_at) VALUES (${PAPER}, 'P', '[]', 1, 't', 't')`)
    // Users referenced by note FKs + the username joins in the cross-user reads. (Roles here are
    // for the FK only; per-request role comes from `currentUser`.)
    sqlite.exec(`INSERT INTO users (id, username, password_hash, role, created_at) VALUES
      (1, 'u1', 'h', 'admin', 't'), (2, 'u2', 'h', 'user', 't'), (3, 'u3', 'h', 'user', 't')`)
    currentUser = null

    app = Fastify()
    app.addHook('onRequest', async (request) => { ;(request as unknown as { user: unknown }).user = currentUser })
    await app.register(notesRoutes)
    await app.ready()
  })

  it('anonymous read returns { note: null } (200)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/note` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ note: null })
  })

  it('anonymous write is rejected (401)', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'x' } })
    expect(res.statusCode).toBe(401)
  })

  it('first write creates the note without a prior updated_at, and GET returns it', async () => {
    currentUser = { id: 1, username: 'u', role: 'admin' }
    const res = await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: '# Hello\n\ntext' } })
    expect([200, 201]).toContain(res.statusCode)
    expect(res.json().data.body).toBe('# Hello\n\ntext')

    const got = (await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/note` })).json().note as Note
    expect(got.body).toBe('# Hello\n\ntext')
  })

  it('a matching updated_at succeeds; a stale one is rejected with 409 + latest content', async () => {
    currentUser = { id: 1, username: 'u', role: 'admin' }
    const created = (await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'v1' } })).json().data as Note
    const ok = await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'v2', updated_at: created.updated_at } })
    expect(ok.statusCode).toBe(200)
    // A clearly-wrong timestamp is rejected and returns the current (v2) content.
    const stale = await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'v3', updated_at: '1999-01-01T00:00:00.000Z' } })
    expect(stale.statusCode).toBe(409)
    expect(stale.json().data.body).toBe('v2')
  })

  it("does not expose another user's note", async () => {
    currentUser = { id: 1, username: 'u', role: 'admin' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'mine' } })
    currentUser = { id: 2, username: 'u', role: 'admin' }
    const other = (await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/note` })).json().note
    expect(other).toBeNull()
  })

  it('GET /api/notes returns one non-empty note per paper, owner-scoped; anon 401', async () => {
    currentUser = { id: 1, username: 'u', role: 'admin' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'agg' } })
    const rows = (await app.inject({ method: 'GET', url: '/api/notes' })).json().data as Array<Note & { paper_title: string }>
    expect(rows.length).toBe(1)
    expect(rows[0].paper_id).toBe(PAPER)
    expect(rows[0].paper_title).toBe('P')
    expect(rows.every((r) => r.body.trim() !== '')).toBe(true)

    currentUser = null
    const anon = await app.inject({ method: 'GET', url: '/api/notes' })
    expect(anon.statusCode).toBe(401)
  })

  it('an empty-body document is excluded from /api/notes', async () => {
    currentUser = { id: 2, username: 'u', role: 'admin' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: '   ' } })
    const rows = (await app.inject({ method: 'GET', url: '/api/notes' })).json().data as Note[]
    expect(rows.length).toBe(0)
  })

  it('completed defaults false; toggle sets it; aggregate reflects it; body PUT preserves it', async () => {
    currentUser = { id: 1, username: 'u', role: 'admin' }
    const created = (await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'x' } })).json().data as Note
    expect(created.completed).toBe(false)

    const done = await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/note/completed`, payload: { completed: true } })
    expect(done.statusCode).toBe(200)
    expect(done.json().data.completed).toBe(true)
    expect(((await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/note` })).json().note as Note).completed).toBe(true)
    const agg = (await app.inject({ method: 'GET', url: '/api/notes' })).json().data as Note[]
    expect(agg.find((n) => n.paper_id === PAPER)?.completed).toBe(true)

    // Body upsert leaves completion untouched.
    const cur = (await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/note` })).json().note as Note
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'y', updated_at: cur.updated_at } })
    expect(((await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/note` })).json().note as Note).completed).toBe(true)

    await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/note/completed`, payload: { completed: false } })
    expect(((await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/note` })).json().note as Note).completed).toBe(false)
  })

  it('cannot complete a paper with no note (400); anonymous toggle is 401', async () => {
    currentUser = { id: 1, username: 'u', role: 'admin' }
    const noNote = await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/note/completed`, payload: { completed: true } })
    expect(noNote.statusCode).toBe(400)
    currentUser = null
    const anon = await app.inject({ method: 'POST', url: `/api/papers/${PAPER}/note/completed`, payload: { completed: true } })
    expect(anon.statusCode).toBe(401)
  })

  // ── public notes ─────────────────────────────────────────────────────────────
  it('visibility: defaults private; publishing needs a non-empty note; owner toggles; anon 401', async () => {
    currentUser = { id: 1, username: 'u1', role: 'admin' }
    // No note yet → cannot publish.
    expect((await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })).statusCode).toBe(400)
    // Empty note → still cannot publish.
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: '   ' } })
    expect((await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })).statusCode).toBe(400)
    // Non-empty note → publish, then unpublish.
    const created = (await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'doc' } })).json().data as Note
    expect(created.is_public).toBe(false)
    const pub = await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().data.is_public).toBe(true)
    expect((await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: false } })).json().data.is_public).toBe(false)
    // Anonymous cannot toggle.
    currentUser = null
    expect((await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })).statusCode).toBe(401)
  })

  it('single-note fetch: public to anyone; private to owner/admin only; else 404', async () => {
    currentUser = { id: 1, username: 'u1', role: 'admin' }
    const noteId = ((await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'doc' } })).json().data as Note).id
    // Owner reads own private note (annotated with paper title + author).
    const owner = await app.inject({ method: 'GET', url: `/api/notes/${noteId}` })
    expect(owner.statusCode).toBe(200)
    expect(owner.json().data.username).toBe('u1')
    expect(owner.json().data.paper_title).toBe('P')
    // A different non-admin user → 404 (existence not revealed).
    currentUser = { id: 2, username: 'u2', role: 'user' }
    expect((await app.inject({ method: 'GET', url: `/api/notes/${noteId}` })).statusCode).toBe(404)
    // An admin (other user) → 200.
    currentUser = { id: 3, username: 'u3', role: 'admin' }
    expect((await app.inject({ method: 'GET', url: `/api/notes/${noteId}` })).statusCode).toBe(200)
    // Once public, anonymous can read.
    currentUser = { id: 1, username: 'u1', role: 'admin' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })
    currentUser = null
    expect((await app.inject({ method: 'GET', url: `/api/notes/${noteId}` })).statusCode).toBe(200)
    // Unknown id → 404.
    expect((await app.inject({ method: 'GET', url: `/api/notes/99999` })).statusCode).toBe(404)
  })

  it('per-paper public list: others public only, excludes own + private, body-less', async () => {
    currentUser = { id: 1, username: 'u1', role: 'user' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'one' } })
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })
    currentUser = { id: 2, username: 'u2', role: 'user' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'two' } })
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })
    currentUser = { id: 3, username: 'u3', role: 'user' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'three' } }) // private
    // As user 1: sees only user 2 (public, other), not own, not user 3 (private), and no body.
    currentUser = { id: 1, username: 'u1', role: 'user' }
    const list = (await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/public-notes` })).json().data as PublicNoteSummary[]
    expect(list.map((n) => n.user_id)).toEqual([2])
    expect(list[0].username).toBe('u2')
    expect((list[0] as Record<string, unknown>).body).toBeUndefined()
    // Anonymous sees both public notes, not the private one.
    currentUser = null
    const anon = (await app.inject({ method: 'GET', url: `/api/papers/${PAPER}/public-notes` })).json().data as PublicNoteSummary[]
    expect(anon.map((n) => n.user_id).sort()).toEqual([1, 2])
  })

  it('aggregate scope: mine (own) vs all (public+own); admin include_private adds others private', async () => {
    currentUser = { id: 1, username: 'u1', role: 'user' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'pub1' } })
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note/visibility`, payload: { is_public: true } })
    currentUser = { id: 2, username: 'u2', role: 'user' }
    await app.inject({ method: 'PUT', url: `/api/papers/${PAPER}/note`, payload: { body: 'priv2' } }) // private
    // User 3 owns nothing: scope=mine empty; scope=all sees only user 1's public note.
    currentUser = { id: 3, username: 'u3', role: 'user' }
    expect(((await app.inject({ method: 'GET', url: '/api/notes?scope=mine' })).json().data as Note[]).length).toBe(0)
    const all3 = (await app.inject({ method: 'GET', url: '/api/notes?scope=all' })).json().data as NoteWithAuthor[]
    expect(all3.map((n) => n.user_id)).toEqual([1])
    expect(all3[0].username).toBe('u1')
    expect(all3[0].is_public).toBe(true)
    // Non-admin include_private has no effect.
    expect(((await app.inject({ method: 'GET', url: '/api/notes?scope=all&include_private=true' })).json().data as Note[]).map((n) => n.user_id)).toEqual([1])
    // Anonymous scope=all → public only, HTTP 200.
    currentUser = null
    const anonAll = await app.inject({ method: 'GET', url: '/api/notes?scope=all' })
    expect(anonAll.statusCode).toBe(200)
    expect((anonAll.json().data as Note[]).map((n) => n.user_id)).toEqual([1])
    // Admin include_private also pulls user 2's private note.
    currentUser = { id: 3, username: 'u3', role: 'admin' }
    const adminAll = (await app.inject({ method: 'GET', url: '/api/notes?scope=all&include_private=true' })).json().data as Note[]
    expect(adminAll.map((n) => n.user_id).sort()).toEqual([1, 2])
  })
})

import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { and, eq } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import * as schema from '../db/schema.js'

/**
 * Tests for the conferences pipeline. We bring up an in-memory SQLite + drizzle
 * here (no Fastify, no service_runner, no external network) and exercise the
 * concrete behaviors covered by the spec:
 *   - schema migration creates conferences + conference_papers
 *   - candidate import defaults to status='pending'
 *   - status transitions pending↔candidate
 *   - delete cascade removes candidates but not papers (papers untouched)
 *   - one-click ingest is idempotent when an arxiv_id already exists in papers
 *
 * No external service is triggered — the ingest path here only exercises the
 * candidate-status update + paper_id linkage, NOT serviceRunner.
 */

let db: ReturnType<typeof drizzle>
let sqlite: Database

beforeAll(() => {
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })

  // Apply all migrations from the repo. This is the same set the running
  // backend applies on startup.
  const migrationsFolder = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
  migrate(db, { migrationsFolder })
})

function nowIso() { return new Date().toISOString() }

function insertConference(name: string, year: number | null = null) {
  const now = nowIso()
  return db.insert(schema.conferences).values({ name, year, created_at: now, updated_at: now }).returning().get()
}

function insertCandidate(conferenceId: number, opts: { title?: string; topic?: string | null; source?: string | null; external_id?: string | null; status?: string } = {}) {
  const now = nowIso()
  return db.insert(schema.conferencePapers).values({
    conference_id: conferenceId,
    title: opts.title ?? 'Untitled',
    topic: opts.topic ?? null,
    authors: null,
    abstract: null,
    source: (opts.source as any) ?? null,
    external_id: opts.external_id ?? null,
    link: null,
    status: opts.status ?? 'pending',
    paper_id: null,
    metadata: null,
    created_at: now,
    updated_at: now,
  }).returning().get()
}

describe('conferences schema', () => {
  it('creates both tables with the expected columns and the conf_status index', () => {
    const tables = sqlite.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    expect(tables).toContain('conferences')
    expect(tables).toContain('conference_papers')

    const indexes = sqlite.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name)
    expect(indexes).toContain('conference_papers_conf_status_idx')
  })
})

describe('conferences CRUD', () => {
  it('inserts, reads, updates, deletes a conference', () => {
    const created = insertConference('NeurIPS 2024', 2024)
    expect(created.id).toBeGreaterThan(0)
    expect(created.name).toBe('NeurIPS 2024')
    expect(created.year).toBe(2024)

    const fetched = db.select().from(schema.conferences).where(eq(schema.conferences.id, created.id)).get()
    expect(fetched?.name).toBe('NeurIPS 2024')

    db.update(schema.conferences).set({ name: 'NeurIPS', updated_at: nowIso() }).where(eq(schema.conferences.id, created.id)).run()
    const updated = db.select().from(schema.conferences).where(eq(schema.conferences.id, created.id)).get()
    expect(updated?.name).toBe('NeurIPS')

    db.delete(schema.conferences).where(eq(schema.conferences.id, created.id)).run()
    expect(db.select().from(schema.conferences).where(eq(schema.conferences.id, created.id)).get()).toBeUndefined()
  })

  it('accepts a conference with only a name (other fields nullable)', () => {
    const c = insertConference('Bare 2099')
    expect(c.year).toBeNull()
    expect(c.start_date).toBeNull()
    expect(c.location).toBeNull()
  })
})

describe('candidate pool import', () => {
  it('defaults imported candidates to status=pending and paper_id=null', () => {
    const conf = insertConference('ICLR 2025', 2025)
    const cand = insertCandidate(conf.id, { title: 'Test', topic: 'Alignment', source: 'arxiv', external_id: '2401.12345' })
    expect(cand.status).toBe('pending')
    expect(cand.paper_id).toBeNull()
    expect(cand.topic).toBe('Alignment')
    expect(cand.source).toBe('arxiv')
  })

  it('allows null source (unknown source is tolerated)', () => {
    const conf = insertConference('Misc 2024')
    const cand = insertCandidate(conf.id, { title: 'X', source: null })
    expect(cand.source).toBeNull()
  })

  it('stores authors / metadata as JSON strings parseable back to original values', () => {
    const conf = insertConference('Demo 2024')
    const now = nowIso()
    const r = db.insert(schema.conferencePapers).values({
      conference_id: conf.id, title: 'JSON test',
      authors: JSON.stringify(['A', 'B']),
      metadata: JSON.stringify({ raw: { x: 1 } }),
      status: 'pending', created_at: now, updated_at: now,
    }).returning().get()
    expect(JSON.parse(r.authors!)).toEqual(['A', 'B'])
    expect(JSON.parse(r.metadata!)).toEqual({ raw: { x: 1 } })
  })
})

describe('status lifecycle', () => {
  it('transitions pending → candidate and back', () => {
    const conf = insertConference('T1')
    const c = insertCandidate(conf.id, { title: 'A' })

    db.update(schema.conferencePapers).set({ status: 'candidate', updated_at: nowIso() }).where(eq(schema.conferencePapers.id, c.id)).run()
    expect(db.select().from(schema.conferencePapers).where(eq(schema.conferencePapers.id, c.id)).get()?.status).toBe('candidate')

    db.update(schema.conferencePapers).set({ status: 'pending', updated_at: nowIso() }).where(eq(schema.conferencePapers.id, c.id)).run()
    expect(db.select().from(schema.conferencePapers).where(eq(schema.conferencePapers.id, c.id)).get()?.status).toBe('pending')
  })

  it('one-click ingest only touches candidate-status rows (pending is skipped)', () => {
    const conf = insertConference('T2')
    const pending = insertCandidate(conf.id, { title: 'P', status: 'pending' })
    const cand = insertCandidate(conf.id, { title: 'C', status: 'candidate' })

    // Simulate the "ingest only candidate" filter our endpoint applies.
    const targets = db.select().from(schema.conferencePapers)
      .where(and(eq(schema.conferencePapers.conference_id, conf.id), eq(schema.conferencePapers.status, 'candidate')))
      .all()
    expect(targets.length).toBe(1)
    expect(targets[0].id).toBe(cand.id)
    expect(targets.find((r) => r.id === pending.id)).toBeUndefined()
  })

  it('linking an ingested candidate to a paper preserves the reference', () => {
    const conf = insertConference('T3')
    // Pretend a paper already exists in the library.
    const now = nowIso()
    const paper = db.insert(schema.papers).values({
      arxiv_id: '2401.99999', corpus_id: null,
      title: 'Existing', authors: JSON.stringify([]),
      created_at: now, updated_at: now,
    }).returning().get()

    const cand = insertCandidate(conf.id, { title: 'Existing', source: 'arxiv', external_id: '2401.99999', status: 'candidate' })

    // Idempotent ingest: link candidate to existing paper, mark ingested.
    db.update(schema.conferencePapers).set({ status: 'ingested', paper_id: paper.id, updated_at: nowIso() })
      .where(eq(schema.conferencePapers.id, cand.id)).run()

    const refetched = db.select().from(schema.conferencePapers).where(eq(schema.conferencePapers.id, cand.id)).get()
    expect(refetched?.status).toBe('ingested')
    expect(refetched?.paper_id).toBe(paper.id)
    // No new paper row was created.
    expect(db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, '2401.99999')).all().length).toBe(1)
  })
})

describe('cascade delete', () => {
  it('deleting a conference removes its candidates but never the linked papers', () => {
    const conf = insertConference('T4')
    const now = nowIso()
    const paper = db.insert(schema.papers).values({
      arxiv_id: '2402.00001', corpus_id: null, title: 'Keep me',
      authors: JSON.stringify([]), created_at: now, updated_at: now,
    }).returning().get()

    insertCandidate(conf.id, { title: 'p1', status: 'pending' })
    const ingested = insertCandidate(conf.id, { title: 'p2', status: 'candidate' })
    db.update(schema.conferencePapers).set({ status: 'ingested', paper_id: paper.id, updated_at: nowIso() })
      .where(eq(schema.conferencePapers.id, ingested.id)).run()

    // Same transaction as the DELETE /api/conferences/:id route.
    sqlite.transaction(() => {
      db.delete(schema.conferencePapers).where(eq(schema.conferencePapers.conference_id, conf.id)).run()
      db.delete(schema.conferences).where(eq(schema.conferences.id, conf.id)).run()
    })()

    expect(db.select().from(schema.conferences).where(eq(schema.conferences.id, conf.id)).get()).toBeUndefined()
    expect(db.select().from(schema.conferencePapers).where(eq(schema.conferencePapers.conference_id, conf.id)).all().length).toBe(0)
    // The previously-ingested paper is untouched.
    expect(db.select().from(schema.papers).where(eq(schema.papers.id, paper.id)).get()?.title).toBe('Keep me')
  })
})

import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import * as schema from '../db/schema.js'
import {
  hasArxivSource,
  hasS2Source,
  isOpenreviewOnly,
  canList,
  openreviewLinkCount,
  openreviewLinkCountsByPapers,
} from './listing.js'

/**
 * Tests for the paper-listing-eligibility rule. Pure predicates are tested directly;
 * the conference-link counters are exercised against an in-memory SQLite + drizzle
 * (no Fastify, no service_runner, no external network), mirroring conferences.test.ts.
 *
 * Covers the spec scenarios: OpenReview-only papers cannot be listed, papers with an
 * arxiv_id / corpus_id (or arxiv.org link) remain listable, and a manual title-only
 * paper (no OpenReview links) is unaffected.
 */

let db: any
let sqlite: Database

beforeAll(() => {
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle(sqlite, { schema })
  const migrationsFolder = resolve(dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations')
  migrate(db, { migrationsFolder })
})

function nowIso() { return new Date().toISOString() }

function insertPaper(opts: { arxiv_id?: string | null; corpus_id?: string | null; link?: string | null; listed?: number } = {}) {
  const now = nowIso()
  return db.insert(schema.papers).values({
    arxiv_id: opts.arxiv_id ?? null,
    corpus_id: opts.corpus_id ?? null,
    title: 'T', authors: JSON.stringify([]),
    link: opts.link ?? null,
    listed: opts.listed ?? 1,
    created_at: now, updated_at: now,
  }).returning().get()
}

function insertConfLink(paperId: number | null, link: string | null) {
  const now = nowIso()
  const conf = db.insert(schema.conferences).values({ name: 'C', created_at: now, updated_at: now }).returning().get()
  return db.insert(schema.conferencePapers).values({
    conference_id: conf.id, title: 'cand', authors: null, source: 'openreview',
    link, status: 'pending', paper_id: paperId, created_at: now, updated_at: now,
  }).returning().get()
}

describe('listing predicates (pure)', () => {
  it('hasArxivSource: arxiv_id, arxiv.org link (incl. www + subdomain), but not other hosts', () => {
    expect(hasArxivSource({ arxiv_id: '2401.1', corpus_id: null, link: null })).toBe(true)
    expect(hasArxivSource({ arxiv_id: null, corpus_id: null, link: 'https://arxiv.org/abs/2401.1' })).toBe(true)
    expect(hasArxivSource({ arxiv_id: null, corpus_id: null, link: 'https://www.arxiv.org/abs/2401.1' })).toBe(true)
    expect(hasArxivSource({ arxiv_id: null, corpus_id: null, link: 'https://openreview.net/forum?id=x' })).toBe(false)
    expect(hasArxivSource({ arxiv_id: null, corpus_id: null, link: null })).toBe(false)
    expect(hasArxivSource({ arxiv_id: null, corpus_id: null, link: 'not a url' })).toBe(false)
  })

  it('hasS2Source: only when corpus_id present', () => {
    expect(hasS2Source({ arxiv_id: null, corpus_id: '123', link: null })).toBe(true)
    expect(hasS2Source({ arxiv_id: null, corpus_id: null, link: null })).toBe(false)
  })

  it('isOpenreviewOnly / canList: OpenReview links + no arxiv/S2 → not listable', () => {
    const orOnly = { arxiv_id: null, corpus_id: null, link: null }
    expect(isOpenreviewOnly(orOnly, 1)).toBe(true)
    expect(canList(orOnly, 1)).toBe(false)
  })

  it('canList: a corpus_id makes an OpenReview paper listable', () => {
    expect(canList({ arxiv_id: null, corpus_id: '123', link: null }, 2)).toBe(true)
  })

  it('canList: an arxiv_id (or arxiv.org link) makes it listable despite OpenReview links', () => {
    expect(canList({ arxiv_id: '2401.1', corpus_id: null, link: null }, 1)).toBe(true)
    expect(canList({ arxiv_id: null, corpus_id: null, link: 'https://arxiv.org/abs/2401.1' }, 1)).toBe(true)
  })

  it('canList: a manual title-only paper with NO OpenReview links is listable', () => {
    expect(canList({ arxiv_id: null, corpus_id: null, link: null }, 0)).toBe(true)
    expect(isOpenreviewOnly({ arxiv_id: null, corpus_id: null, link: null }, 0)).toBe(false)
  })
})

describe('OpenReview link counters (DB)', () => {
  it('openreviewLinkCount counts only non-empty links for the paper', () => {
    const p = insertPaper()
    expect(openreviewLinkCount(db, p.id)).toBe(0)
    insertConfLink(p.id, 'https://openreview.net/forum?id=a')
    insertConfLink(p.id, 'https://openreview.net/forum?id=b')
    insertConfLink(p.id, '')   // empty → not counted
    insertConfLink(p.id, null) // null → not counted
    expect(openreviewLinkCount(db, p.id)).toBe(2)
  })

  it('openreviewLinkCountsByPapers batches counts; papers without links are absent (treated as 0)', () => {
    const a = insertPaper()
    const b = insertPaper()
    const c = insertPaper()
    insertConfLink(a.id, 'https://openreview.net/forum?id=1')
    insertConfLink(c.id, 'https://openreview.net/forum?id=2')
    insertConfLink(c.id, 'https://openreview.net/forum?id=3')
    const counts = openreviewLinkCountsByPapers(db, [a.id, b.id, c.id])
    expect(counts.get(a.id)).toBe(1)
    expect(counts.get(b.id) ?? 0).toBe(0)
    expect(counts.get(c.id)).toBe(2)
    expect(openreviewLinkCountsByPapers(db, []).size).toBe(0)
  })

  it('composite: an OpenReview-only paper is not listable, an arxiv-linked one is', () => {
    const orOnly = insertPaper({ arxiv_id: null, corpus_id: null, link: null })
    insertConfLink(orOnly.id, 'https://openreview.net/forum?id=z')
    expect(canList(orOnly, openreviewLinkCount(db, orOnly.id))).toBe(false)

    const withArxiv = insertPaper({ arxiv_id: '2402.5', corpus_id: null, link: null })
    insertConfLink(withArxiv.id, 'https://openreview.net/forum?id=y')
    expect(canList(withArxiv, openreviewLinkCount(db, withArxiv.id))).toBe(true)
  })
})

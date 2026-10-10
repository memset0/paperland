import { eq, or } from 'drizzle-orm'
import type { S2PaperMeta, S2ResolveResult } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import { parseS2Input } from '../utils/s2_ids.js'
import { s2PostBatch } from './semantic_scholar_service.js'
import { extractCiteLinks } from './qa_cites.js'

/**
 * Semantic Scholar metadata cache (`s2_papers`) for papers referenced anywhere (e.g. `#cite:`
 * links in answers), whether or not they are in the library. Resolution order per id:
 * library paper → fresh cache entry → one batched S2 request for everything still missing.
 */

const BATCH_FIELDS = [
  'paperId', 'externalIds', 'title', 'authors', 'year', 'venue', 'abstract', 'tldr',
  'citationCount', 'influentialCitationCount', 'referenceCount', 'publicationDate', 'url', 'openAccessPdf',
].join(',')

const DAY_MS = 24 * 60 * 60 * 1000

type CacheRow = typeof schema.s2Papers.$inferSelect
type PaperRow = typeof schema.papers.$inferSelect

/** Normalized id: exactly one of the two S2 identifiers. */
interface Key { s2_paper_id?: string; corpus_id?: string }

function keyString(key: Key): string {
  return key.s2_paper_id ? `p:${key.s2_paper_id}` : `c:${key.corpus_id}`
}

/** S2 batch id expression for a key. */
function idExpr(key: Key): string {
  return key.s2_paper_id ?? `CorpusId:${key.corpus_id}`
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function cacheToMeta(row: CacheRow): S2PaperMeta {
  return {
    s2_paper_id: row.s2_paper_id,
    corpus_id: row.corpus_id,
    arxiv_id: row.arxiv_id,
    doi: row.doi,
    title: row.title,
    authors: parseJson<string[]>(row.authors, []),
    year: row.year,
    venue: row.venue,
    abstract: row.abstract,
    tldr: row.tldr,
    citation_count: row.citation_count,
    influential_citation_count: row.influential_citation_count,
    url: row.url,
    open_access_pdf_url: row.open_access_pdf_url,
    fetched_at: row.fetched_at,
  }
}

function paperToMeta(paper: PaperRow): S2PaperMeta {
  const m = parseJson<Record<string, any>>(paper.metadata, {})
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    s2_paper_id: paper.s2_paper_id,
    corpus_id: paper.corpus_id,
    arxiv_id: paper.arxiv_id,
    doi: str(m.doi),
    title: paper.title,
    authors: parseJson<string[]>(paper.authors, []),
    year: num(m.year),
    venue: str(m.venue),
    abstract: paper.abstract,
    tldr: str(m.tldr),
    citation_count: num(m.citation_count),
    influential_citation_count: num(m.influential_citation_count),
    url: str(m.s2_url),
    open_access_pdf_url: str(m.open_access_pdf_url),
    fetched_at: paper.updated_at,
  }
}

/** Map one S2 batch record onto an `s2_papers` row (status ok). */
function recordToRow(rec: any, now: string): Omit<CacheRow, 'id' | 'created_at'> {
  const ext = rec.externalIds || {}
  return {
    s2_paper_id: typeof rec.paperId === 'string' ? rec.paperId.toLowerCase() : null,
    corpus_id: ext.CorpusId !== undefined && ext.CorpusId !== null ? String(ext.CorpusId) : null,
    arxiv_id: ext.ArXiv ?? null,
    doi: ext.DOI ?? null,
    title: rec.title ?? null,
    authors: Array.isArray(rec.authors) ? JSON.stringify(rec.authors.map((a: any) => a.name)) : null,
    year: rec.year ?? null,
    venue: rec.venue || rec.publicationVenue?.name || null,
    abstract: rec.abstract ?? null,
    tldr: rec.tldr?.text ?? null,
    citation_count: rec.citationCount ?? null,
    influential_citation_count: rec.influentialCitationCount ?? null,
    reference_count: rec.referenceCount ?? null,
    publication_date: rec.publicationDate ?? null,
    url: rec.url ?? (rec.paperId ? `https://www.semanticscholar.org/paper/${rec.paperId}` : null),
    open_access_pdf_url: rec.openAccessPdf?.url || null,
    status: 'ok',
    fetched_at: now,
  }
}

function findLibraryPaper(ids: { s2_paper_id?: string | null; corpus_id?: string | null; arxiv_id?: string | null }): PaperRow | undefined {
  const conds = []
  if (ids.s2_paper_id) conds.push(eq(schema.papers.s2_paper_id, ids.s2_paper_id))
  if (ids.corpus_id) conds.push(eq(schema.papers.corpus_id, ids.corpus_id))
  if (ids.arxiv_id) conds.push(eq(schema.papers.arxiv_id, ids.arxiv_id))
  if (conds.length === 0) return undefined
  return getDatabase().select().from(schema.papers).where(or(...conds)).get()
}

function findCacheRow(key: Key): CacheRow | undefined {
  const col = key.s2_paper_id ? schema.s2Papers.s2_paper_id : schema.s2Papers.corpus_id
  return getDatabase().select().from(schema.s2Papers).where(eq(col, (key.s2_paper_id ?? key.corpus_id)!)).get()
}

function isFresh(row: CacheRow, nowMs: number): boolean {
  const cfg = getConfig().s2_cache
  const ttlDays = row.status === 'not_found' ? cfg.not_found_ttl_days : cfg.ttl_days
  return nowMs - Date.parse(row.fetched_at) < ttlDays * DAY_MS
}

/**
 * Store a fetched record under both of its ids. Rows that hold either id (e.g. an older entry keyed
 * by the other id, or a negative entry) are replaced so the unique columns never collide.
 */
function upsertRecord(rec: any, now: string): CacheRow {
  const db = getDatabase()
  const row = recordToRow(rec, now)
  const conds = []
  if (row.s2_paper_id) conds.push(eq(schema.s2Papers.s2_paper_id, row.s2_paper_id))
  if (row.corpus_id) conds.push(eq(schema.s2Papers.corpus_id, row.corpus_id))
  return db.transaction((tx) => {
    let createdAt = now
    if (conds.length) {
      const existing = tx.select().from(schema.s2Papers).where(or(...conds)).all()
      for (const e of existing) if (e.created_at < createdAt) createdAt = e.created_at
      tx.delete(schema.s2Papers).where(or(...conds)).run()
    }
    return tx.insert(schema.s2Papers).values({ ...row, created_at: createdAt }).returning().get()
  })
}

/**
 * Merge S2 records that may carry only some fields (search / match / citation results) into the
 * cache. Fields a record leaves null keep the existing row's value, so a partial result never erases
 * a richer entry, and an existing ok row keeps its `fetched_at` (a partial result is not a refresh).
 * Records without a `paperId` are skipped. Returns how many rows were written.
 */
export function cacheS2Records(records: unknown[]): number {
  const now = new Date().toISOString()
  let written = 0
  for (const rec of records as any[]) {
    if (!rec || typeof rec.paperId !== 'string') continue
    const incoming = recordToRow(rec, now)
    const conds = []
    if (incoming.s2_paper_id) conds.push(eq(schema.s2Papers.s2_paper_id, incoming.s2_paper_id))
    if (incoming.corpus_id) conds.push(eq(schema.s2Papers.corpus_id, incoming.corpus_id))
    const existing = conds.length
      ? getDatabase().select().from(schema.s2Papers).where(or(...conds)).all().find((r) => r.status === 'ok')
      : undefined
    if (!existing) {
      upsertRecord(rec, now)
      written++
      continue
    }
    const merged: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = value ?? (existing as Record<string, unknown>)[key] ?? null
    }
    // Keep the original fetch time: a partial record is not a full refresh.
    merged.fetched_at = existing.fetched_at
    getDatabase().transaction((tx) => {
      tx.delete(schema.s2Papers).where(or(...conds)).run()
      tx.insert(schema.s2Papers).values({ ...(merged as Omit<CacheRow, 'id' | 'created_at'>), created_at: existing.created_at }).run()
    })
    written++
  }
  return written
}

/** Record that S2 has no paper for this id (negative entry keyed by the requested id only). */
function storeNotFound(key: Key, now: string): void {
  const db = getDatabase()
  const col = key.s2_paper_id ? schema.s2Papers.s2_paper_id : schema.s2Papers.corpus_id
  db.transaction((tx) => {
    tx.delete(schema.s2Papers).where(eq(col, (key.s2_paper_id ?? key.corpus_id)!)).run()
    tx.insert(schema.s2Papers).values({
      s2_paper_id: key.s2_paper_id ?? null,
      corpus_id: key.corpus_id ?? null,
      status: 'not_found',
      fetched_at: now,
      created_at: now,
    }).run()
  })
}

// In-flight fetches by key, so concurrent resolves (e.g. warming + a UI request) share one request.
const inflight = new Map<string, Promise<CacheRow | null>>()

/**
 * Fetch the given keys from S2 (one batch for those not already in flight), cache the outcome, and
 * return each key's row (`null` = S2 has no record). Rejects per key when the request fails.
 */
function fetchKeys(keys: Key[]): Map<string, Promise<CacheRow | null>> {
  const out = new Map<string, Promise<CacheRow | null>>()
  const fresh: Key[] = []
  for (const key of keys) {
    const ks = keyString(key)
    const pending = inflight.get(ks)
    if (pending) out.set(ks, pending)
    else fresh.push(key)
  }
  if (fresh.length) {
    const batch = s2PostBatch(fresh.map(idExpr), BATCH_FIELDS).then((records) => {
      const now = new Date().toISOString()
      return fresh.map((key, i) => {
        const rec = records[i]
        if (!rec) { storeNotFound(key, now); return null }
        return upsertRecord(rec, now)
      })
    })
    fresh.forEach((key, i) => {
      const ks = keyString(key)
      const p = batch.then((rows) => rows[i])
      p.catch(() => {}) // observed by callers; avoid unhandled-rejection noise for unawaited keys
      const tracked = p.finally(() => inflight.delete(ks))
      tracked.catch(() => {})
      inflight.set(ks, p)
      out.set(ks, p)
    })
  }
  return out
}

function libraryIdFor(meta: S2PaperMeta): number | null {
  return findLibraryPaper(meta)?.id ?? null
}

/**
 * Resolve S2 identifiers (paperId, CorpusId, `CorpusId:<n>`, S2 URL) to metadata. Results come back
 * one per input id, in input order. With `allowFetch: false` (anonymous callers) nothing is
 * requested from S2: ids that would need fetching come back `unavailable`.
 */
export async function resolveS2Ids(rawIds: string[], opts: { allowFetch: boolean }): Promise<S2ResolveResult[]> {
  const nowMs = Date.now()
  const byKey = new Map<string, Omit<S2ResolveResult, 'id'>>()
  const parsed = rawIds.map((raw) => {
    const ids = parseS2Input(String(raw ?? ''))
    // An id resolves through one identifier; prefer the paperId when a URL yields both.
    const key: Key | null = ids?.s2_paper_id ? { s2_paper_id: ids.s2_paper_id } : ids?.corpus_id ? { corpus_id: ids.corpus_id } : null
    return { raw, key }
  })

  const stale = new Map<string, CacheRow>()
  const toFetch: Key[] = []
  for (const { key } of parsed) {
    if (!key) continue
    const ks = keyString(key)
    if (byKey.has(ks) || toFetch.some((k) => keyString(k) === ks)) continue

    const paper = findLibraryPaper(key)
    if (paper) {
      byKey.set(ks, { status: 'resolved', source: 'library', paper: paperToMeta(paper), library_paper_id: paper.id })
      continue
    }
    const row = findCacheRow(key)
    if (row && isFresh(row, nowMs)) {
      if (row.status === 'not_found') {
        byKey.set(ks, { status: 'not_found', source: 'cache', paper: null, library_paper_id: null })
      } else {
        const meta = cacheToMeta(row)
        byKey.set(ks, { status: 'resolved', source: 'cache', paper: meta, library_paper_id: libraryIdFor(meta) })
      }
      continue
    }
    if (row && row.status === 'ok') stale.set(ks, row)
    toFetch.push(key)
  }

  const fallback = (ks: string): Omit<S2ResolveResult, 'id'> => {
    const old = stale.get(ks)
    if (!old) return { status: 'unavailable', source: null, paper: null, library_paper_id: null }
    const meta = cacheToMeta(old)
    return { status: 'resolved', source: 'stale_cache', paper: meta, library_paper_id: libraryIdFor(meta) }
  }

  if (toFetch.length && opts.allowFetch) {
    const pending = fetchKeys(toFetch)
    await Promise.all(toFetch.map(async (key) => {
      const ks = keyString(key)
      try {
        const row = await pending.get(ks)!
        if (!row) {
          byKey.set(ks, { status: 'not_found', source: 's2', paper: null, library_paper_id: null })
        } else {
          const meta = cacheToMeta(row)
          byKey.set(ks, { status: 'resolved', source: 's2', paper: meta, library_paper_id: libraryIdFor(meta) })
        }
      } catch (err: any) {
        console.warn(`S2 cache fetch failed for ${ks}: ${err?.message || err}`)
        byKey.set(ks, fallback(ks))
      }
    }))
  } else {
    for (const key of toFetch) byKey.set(keyString(key), fallback(keyString(key)))
  }

  return parsed.map(({ raw, key }) => key
    ? { id: raw, ...byKey.get(keyString(key))! }
    : { id: raw, status: 'invalid', source: null, paper: null, library_paper_id: null })
}

/** Cache metadata for every `#cite:` id in a finished answer (fetching what is missing). */
export async function warmCites(answer: string): Promise<void> {
  const ids = extractCiteLinks(answer).map((link) => link.cite_id)
  if (ids.length === 0) return
  await resolveS2Ids(ids, { allowFetch: true })
}

export const __test__ = { inflight, recordToRow, paperToMeta }

import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { withDedup, getDedupKey } from './paper_dedup.js'
import { serviceRunner } from './service_runner.js'

export interface IngestPaperInput {
  arxiv_id?: string | null
  corpus_id?: string | null
  /** 40-hex Semantic Scholar paperId (already normalized, see utils/s2_ids.ts). */
  s2_paper_id?: string | null
  title?: string | null
  authors?: string[] | null
  link?: string | null
  content?: string | null
  /** false = ingest as a metadata-only (hidden) paper; default true = listed in the library. */
  listed?: boolean
}

type DB = ReturnType<typeof getDatabase>
type PaperRow = typeof schema.papers.$inferSelect

export interface PaperIds {
  arxiv_id?: string | null
  corpus_id?: string | null
  s2_paper_id?: string | null
}

/** In-flight dedup key for a create request: the strongest identifier wins (arxiv → corpus → s2). */
export function paperDedupKey(ids: PaperIds): string | null {
  if (ids.arxiv_id) return getDedupKey('arxiv', ids.arxiv_id)
  if (ids.corpus_id) return getDedupKey('corpus', ids.corpus_id)
  if (ids.s2_paper_id) return getDedupKey('s2', ids.s2_paper_id)
  return null
}

/**
 * Find an existing paper by arxiv_id, then corpus_id, then s2_paper_id. On a match,
 * backfill any of the given identifiers the paper is missing (skipping a value another
 * row already holds, since all three are UNIQUE). Returns the matched row or null.
 */
export function findExistingPaperByIds(db: DB, ids: PaperIds): PaperRow | null {
  const keys = ['arxiv_id', 'corpus_id', 's2_paper_id'] as const
  for (const key of keys) {
    const value = ids[key]
    if (!value) continue
    const existing = db.select().from(schema.papers).where(eq(schema.papers[key], value)).get()
    if (!existing) continue
    const updates: Partial<PaperRow> = {}
    for (const other of keys) {
      const v = ids[other]
      if (!v || existing[other]) continue
      const holder = db.select({ id: schema.papers.id }).from(schema.papers).where(eq(schema.papers[other], v)).get()
      if (!holder) updates[other] = v
    }
    if (Object.keys(updates).length > 0) {
      db.update(schema.papers).set(updates).where(eq(schema.papers.id, existing.id)).run()
    }
    return existing
  }
  return null
}

export interface IngestPaperResult {
  /** Raw `papers` row (still JSON-encoded for `authors`/`contents`/`metadata`). */
  paper: typeof schema.papers.$inferSelect
  /** True when a new row was inserted; false when a matching arxiv_id/corpus_id/s2_paper_id was found. */
  created: boolean
}

/**
 * Core paper-ingest pipeline shared by the paper-creating routes. Returns the existing paper (with cross-id backfilled if
 * applicable) when an `arxiv_id`/`corpus_id`/`s2_paper_id` already exists; otherwise inserts a
 * new row and asynchronously triggers the service dependency graph for it.
 *
 * Tag association is intentionally NOT handled here — tags are scoped to the
 * calling user, so the API route owns that step after this helper returns.
 */
export async function ingestPaper(input: IngestPaperInput): Promise<IngestPaperResult> {
  const { arxiv_id, corpus_id, s2_paper_id, title, authors, link, content, listed } = input

  // Promote an existing metadata-only paper when a normal (listed) ingest matches it.
  const maybePromote = (existing: typeof schema.papers.$inferSelect): void => {
    if (listed !== false && existing.listed === 0) {
      const db = getDatabase()
      db.update(schema.papers).set({ listed: 1 }).where(eq(schema.papers.id, existing.id)).run()
      serviceRunner.triggerForPaper(existing.id).catch(() => {})
    }
  }

  const dedupKey = paperDedupKey({ arxiv_id, corpus_id, s2_paper_id })

  const createFn = async (): Promise<IngestPaperResult> => {
    const db = getDatabase()

    const existing = findExistingPaperByIds(db, { arxiv_id, corpus_id, s2_paper_id })
    if (existing) {
      maybePromote(existing)
      const refetched = db.select().from(schema.papers).where(eq(schema.papers.id, existing.id)).get()!
      return { paper: refetched, created: false }
    }

    const now = new Date().toISOString()
    const contents = content ? JSON.stringify({ user_input: content }) : null

    const paper = db.insert(schema.papers).values({
      arxiv_id: arxiv_id || null,
      corpus_id: corpus_id || null,
      s2_paper_id: s2_paper_id || null,
      title: title || 'Untitled',
      authors: JSON.stringify(authors || []),
      contents,
      link: link || null,
      listed: listed === false ? 0 : 1,
      created_at: now,
      updated_at: now,
    }).returning().get()

    serviceRunner.triggerForPaper(paper.id).catch((err) => {
      console.error(`Failed to trigger services for paper ${paper.id}:`, err)
    })

    return { paper, created: true }
  }

  return dedupKey ? await withDedup(dedupKey, createFn) : await createFn()
}

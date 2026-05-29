import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { withDedup, getDedupKey } from './paper_dedup.js'
import { serviceRunner } from './service_runner.js'

export interface IngestPaperInput {
  arxiv_id?: string | null
  corpus_id?: string | null
  title?: string | null
  authors?: string[] | null
  link?: string | null
  content?: string | null
  /** false = ingest as a metadata-only (hidden) paper; default true = listed in the library. */
  listed?: boolean
}

export interface IngestPaperResult {
  /** Raw `papers` row (still JSON-encoded for `authors`/`contents`/`metadata`). */
  paper: typeof schema.papers.$inferSelect
  /** True when a new row was inserted; false when a matching arxiv_id/corpus_id was found. */
  created: boolean
}

/**
 * Core paper-ingest pipeline shared by `POST /api/papers` and by the conference
 * one-click ingest flow. Returns the existing paper (with cross-id backfilled if
 * applicable) when an `arxiv_id`/`corpus_id` already exists; otherwise inserts a
 * new row and asynchronously triggers the service dependency graph for it.
 *
 * Tag association is intentionally NOT handled here — tags are scoped to the
 * calling user, so the API route owns that step after this helper returns.
 */
export async function ingestPaper(input: IngestPaperInput): Promise<IngestPaperResult> {
  const { arxiv_id, corpus_id, title, authors, link, content, listed } = input

  // Promote an existing metadata-only paper when a normal (listed) ingest matches it.
  const maybePromote = (existing: typeof schema.papers.$inferSelect): void => {
    if (listed !== false && existing.listed === 0) {
      getDatabase().update(schema.papers).set({ listed: 1 }).where(eq(schema.papers.id, existing.id)).run()
      serviceRunner.triggerForPaper(existing.id).catch(() => {})
    }
  }

  const dedupKey = arxiv_id
    ? getDedupKey('arxiv', arxiv_id)
    : corpus_id
      ? getDedupKey('corpus', corpus_id)
      : null

  const createFn = async (): Promise<IngestPaperResult> => {
    const db = getDatabase()

    if (arxiv_id) {
      const existing = db.select().from(schema.papers).where(eq(schema.papers.arxiv_id, arxiv_id)).get()
      if (existing) {
        if (corpus_id && !existing.corpus_id) {
          db.update(schema.papers).set({ corpus_id }).where(eq(schema.papers.id, existing.id)).run()
        }
        maybePromote(existing)
        const refetched = db.select().from(schema.papers).where(eq(schema.papers.id, existing.id)).get()!
        return { paper: refetched, created: false }
      }
    }

    if (corpus_id) {
      const existing = db.select().from(schema.papers).where(eq(schema.papers.corpus_id, corpus_id)).get()
      if (existing) {
        if (arxiv_id && !existing.arxiv_id) {
          db.update(schema.papers).set({ arxiv_id }).where(eq(schema.papers.id, existing.id)).run()
        }
        maybePromote(existing)
        const refetched = db.select().from(schema.papers).where(eq(schema.papers.id, existing.id)).get()!
        return { paper: refetched, created: false }
      }
    }

    const now = new Date().toISOString()
    const contents = content ? JSON.stringify({ user_input: content }) : null

    const paper = db.insert(schema.papers).values({
      arxiv_id: arxiv_id || null,
      corpus_id: corpus_id || null,
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

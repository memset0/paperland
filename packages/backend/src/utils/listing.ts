import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

type DB = ReturnType<typeof getDatabase>

/**
 * Minimal shape needed to judge a paper's canonical source.
 * Works with both a raw `papers` row and a parsed paper object.
 */
export interface ListablePaper {
  arxiv_id: string | null
  corpus_id: string | null
  link: string | null
}

/** Normalized hostname of a URL (lowercased, `www.` stripped), or null if unparseable. */
function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** True when the paper has a canonical arXiv source: an `arxiv_id`, or a `link` pointing at arxiv.org. */
export function hasArxivSource(paper: ListablePaper): boolean {
  if (paper.arxiv_id != null) return true
  const host = hostOf(paper.link)
  return host === 'arxiv.org' || (host?.endsWith('.arxiv.org') ?? false)
}

/** True when the paper has a Semantic Scholar source (a `corpus_id`). */
export function hasS2Source(paper: ListablePaper): boolean {
  return paper.corpus_id != null
}

/**
 * A paper is "OpenReview-only" when it has one or more OpenReview links
 * (conference_papers rows with a non-empty link) but no canonical arXiv/S2 source.
 * Such papers have nothing to fetch the full pipeline from and MUST NOT be listed.
 */
export function isOpenreviewOnly(paper: ListablePaper, openreviewLinkCount: number): boolean {
  return openreviewLinkCount > 0 && !hasArxivSource(paper) && !hasS2Source(paper)
}

/** Whether the paper is allowed to be set to `listed=true`. The inverse of {@link isOpenreviewOnly}. */
export function canList(paper: ListablePaper, openreviewLinkCount: number): boolean {
  return !isOpenreviewOnly(paper, openreviewLinkCount)
}

/** Number of OpenReview (conference) links attached to a single paper. */
export function openreviewLinkCount(db: DB, paperId: number): number {
  const row = db.select({ cnt: sql<number>`count(*)` })
    .from(schema.conferencePapers)
    .where(and(
      eq(schema.conferencePapers.paper_id, paperId),
      isNotNull(schema.conferencePapers.link),
      ne(schema.conferencePapers.link, ''),
    ))
    .get()
  return row?.cnt ?? 0
}

/**
 * Map of paperId → OpenReview link count, for a batch of papers (mirrors `userTagsByPapers`).
 * Papers with no OpenReview links are simply absent from the map (treat as 0).
 */
export function openreviewLinkCountsByPapers(db: DB, paperIds: number[]): Map<number, number> {
  const map = new Map<number, number>()
  if (paperIds.length === 0) return map
  const rows = db.select({
    paper_id: schema.conferencePapers.paper_id,
    cnt: sql<number>`count(*)`.as('cnt'),
  })
    .from(schema.conferencePapers)
    .where(and(
      inArray(schema.conferencePapers.paper_id, paperIds),
      isNotNull(schema.conferencePapers.link),
      ne(schema.conferencePapers.link, ''),
    ))
    .groupBy(schema.conferencePapers.paper_id)
    .all()
  for (const r of rows) {
    if (r.paper_id != null) map.set(r.paper_id, r.cnt)
  }
  return map
}

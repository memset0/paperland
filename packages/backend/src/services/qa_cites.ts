import { and, eq } from 'drizzle-orm'
import type { getDatabase } from '../db/index.js'
import * as schema from '../db/schema.js'

type Database = ReturnType<typeof getDatabase>

export interface CiteLink {
  cite_id: string
  id_kind: 's2_paper_id' | 'corpus_id'
  link_text: string
}

const CITE_LINK = /\[([^\]\n]*)\]\(#cite:([^)\s]+)\)/g

/** `#cite:<id>` links in an answer, one per distinct id (first link text wins). */
export function extractCiteLinks(answer: string): CiteLink[] {
  const seen = new Map<string, CiteLink>()
  for (const match of answer.matchAll(CITE_LINK)) {
    const raw = match[2].trim()
    const id = /^[0-9a-f]{40}$/i.test(raw) ? raw.toLowerCase() : raw
    const kind = /^[0-9a-f]{40}$/.test(id) ? 's2_paper_id' : /^\d+$/.test(id) ? 'corpus_id' : null
    if (!kind || seen.has(id)) continue
    seen.set(id, { cite_id: id, id_kind: kind, link_text: match[1].trim() })
  }
  return [...seen.values()]
}

/**
 * Record a finished answer's `#cite:` ids that are not among the paper's stored references, for
 * later resolution. Ids found in the paper's references need nothing stored (the UI uses them).
 */
export function recordUnknownCites(db: Database, paperId: number, resultId: number, answer: string): number {
  const links = extractCiteLinks(answer)
  if (links.length === 0) return 0
  const references = db.select({ s2: schema.paperCitations.s2_paper_id, corpus: schema.paperCitations.corpus_id })
    .from(schema.paperCitations)
    .where(and(eq(schema.paperCitations.paper_id, paperId), eq(schema.paperCitations.direction, 'reference')))
    .all()
  const known = new Set(references.flatMap((row) => [row.s2?.toLowerCase(), row.corpus].filter(Boolean) as string[]))
  const unknown = links.filter((link) => !known.has(link.cite_id))
  const now = new Date().toISOString()
  for (const link of unknown) {
    db.insert(schema.qaResultCites).values({
      qa_result_id: resultId, paper_id: paperId, ...link, created_at: now,
    }).onConflictDoNothing().run()
  }
  return unknown.length
}

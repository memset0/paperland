import { ref, type Ref } from 'vue'
import { api } from '@/api/client'

/** A paper this paper cites (Semantic Scholar reference), as listed by `/api/papers/:id/citations`. */
export interface PaperReference {
  id: number
  s2_paper_id: string | null
  corpus_id: string | null
  title: string | null
  authors: string[]
  year: number | null
  venue: string | null
  url: string | null
  /** Library paper matching this reference, if any (links in-app). */
  library_paper_id: number | null
}

// One shared, lazily-loaded reference list per paper (answers render many `#cite:` links).
const cache = new Map<number, Ref<PaperReference[] | null>>()

export function usePaperReferences(paperId: number): Ref<PaperReference[] | null> {
  let entry = cache.get(paperId)
  if (!entry) {
    entry = ref<PaperReference[] | null>(null)
    cache.set(paperId, entry)
    const target = entry
    api.get<{ references: PaperReference[] }>(`/api/papers/${paperId}/citations?direction=reference`)
      .then((res) => { target.value = res.references })
      .catch(() => { target.value = [] })
  }
  return entry
}

/** The reference a `#cite:<id>` link points to: a 40-hex S2 paperId or a numeric CorpusId. */
export function findReference(references: PaperReference[] | null, citeId: string): PaperReference | null {
  if (!references) return null
  const id = citeId.trim().toLowerCase()
  if (/^[0-9a-f]{40}$/.test(id)) return references.find((ref) => ref.s2_paper_id?.toLowerCase() === id) ?? null
  if (/^\d+$/.test(id)) return references.find((ref) => ref.corpus_id === id) ?? null
  return null
}

/** Semantic Scholar page for a reference id. */
export function s2Url(citeId: string): string {
  return /^\d+$/.test(citeId) ? `https://www.semanticscholar.org/paper/CorpusID:${citeId}` : `https://www.semanticscholar.org/paper/${citeId}`
}

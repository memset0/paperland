export interface CiteLink {
  /** Normalized id: lowercase 40-hex S2 paperId, or a numeric CorpusId. */
  id: string
  /** Link text of the first occurrence (fallback title). */
  text: string
}

const CITE_LINK = /\[([^\]\n]*)\]\(#cite:([^)\s]+)\)/g

/**
 * Normalize a `#cite:` id: 40-hex paperId → lowercase, `CorpusId:<n>` / `<n>` → `<n>`.
 * Returns null for anything else. Mirrors the backend's `extractCiteLinks` rules.
 */
export function normalizeCiteId(raw: string): string | null {
  let id = raw.trim()
  try { id = decodeURIComponent(id) } catch { /* keep raw */ }
  if (/^[0-9a-f]{40}$/i.test(id)) return id.toLowerCase()
  const corpus = id.replace(/^corpusid:/i, '')
  if (/^\d+$/.test(corpus)) return corpus
  return null
}

/** Distinct `#cite:` links in a Markdown answer, in order of first appearance. */
export function extractCiteLinks(markdown: string): CiteLink[] {
  const seen = new Map<string, CiteLink>()
  for (const match of markdown.matchAll(CITE_LINK)) {
    const id = normalizeCiteId(match[2])
    if (!id || seen.has(id)) continue
    seen.set(id, { id, text: match[1].trim() })
  }
  return [...seen.values()]
}

/** Semantic Scholar page for a cited id: a 40-hex paperId or a numeric CorpusId. */
export function s2Url(citeId: string): string {
  return /^\d+$/.test(citeId) ? `https://www.semanticscholar.org/paper/CorpusID:${citeId}` : `https://www.semanticscholar.org/paper/${citeId}`
}

/**
 * Route a pasted Semantic Scholar identifier to the matching create-paper field:
 * a Corpus ID (`123`, `CorpusId:123`, `…/CorpusID:123` URL) → `corpus_id`;
 * a 40-hex paper id or a semanticscholar.org paper URL → `s2_paper_id`.
 * Returns null when unrecognizable. The backend re-validates (utils/s2_ids.ts).
 */
export function parseS2Input(raw: string): { corpus_id: string } | { s2_paper_id: string } | null {
  const s = raw.trim()
  if (!s) return null
  if (/^[0-9a-f]{40}$/i.test(s)) return { s2_paper_id: s.toLowerCase() }
  const corpus = s.match(/^(?:corpus[_ ]?id:?\s*)?(\d+)$/i)
  if (corpus) return { corpus_id: String(Number(corpus[1])) }

  let url: URL
  try { url = new URL(s) } catch { return null }
  if (!/(^|\.)semanticscholar\.org$/i.test(url.hostname)) return null
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent).reverse()
  for (const seg of segments) {
    if (/^[0-9a-f]{40}$/i.test(seg)) return { s2_paper_id: seg.toLowerCase() }
    const c = seg.match(/^corpus[_ ]?id:(\d+)$/i)
    if (c) return { corpus_id: String(Number(c[1])) }
  }
  return null
}

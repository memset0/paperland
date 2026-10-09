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

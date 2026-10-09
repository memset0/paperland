/**
 * Semantic Scholar identifier normalization. Users identify S2 papers by the numeric
 * Corpus ID or the 40-hex paperId (the one in semanticscholar.org URLs); both may be
 * pasted as a URL. Every create/lookup path normalizes through here.
 */

const PAPER_ID_RE = /^[0-9a-f]{40}$/i
const CORPUS_RE = /^(?:corpus[_ ]?id:?\s*)?(\d+)$/i

export interface S2Ids {
  corpus_id?: string
  s2_paper_id?: string
}

export class S2IdError extends Error {}

/**
 * Parse one S2 identifier in any accepted form: `123`, `CorpusId:123`, a 40-hex paperId,
 * or a semanticscholar.org URL (`/paper/[<slug>/]<paperId>` or `/CorpusID:<n>`).
 * Returns null when the input is not recognizable.
 */
export function parseS2Input(raw: string): S2Ids | null {
  const s = raw.trim()
  if (!s) return null
  if (PAPER_ID_RE.test(s)) return { s2_paper_id: s.toLowerCase() }
  const corpus = s.match(CORPUS_RE)
  if (corpus) return { corpus_id: String(Number(corpus[1])) }

  let url: URL
  try { url = new URL(s) } catch { return null }
  if (!/(^|\.)semanticscholar\.org$/i.test(url.hostname)) return null
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  for (const seg of segments.reverse()) {
    if (PAPER_ID_RE.test(seg)) return { s2_paper_id: seg.toLowerCase() }
    const c = seg.match(/^corpus[_ ]?id:(\d+)$/i)
    if (c) return { corpus_id: String(Number(c[1])) }
  }
  return null
}

/**
 * Normalize the `corpus_id` / `s2_paper_id` request fields. Either field may hold any
 * accepted form (e.g. a paper URL in `corpus_id`); values are routed to the right key.
 * Throws {@link S2IdError} for an unrecognizable value or two conflicting values.
 */
export function normalizeS2Ids(input: { corpus_id?: unknown; s2_paper_id?: unknown }): S2Ids {
  const out: S2Ids = {}
  for (const field of ['corpus_id', 's2_paper_id'] as const) {
    const v = input[field]
    if (v === undefined || v === null || v === '') continue
    const parsed = parseS2Input(String(v))
    if (!parsed) throw new S2IdError(`Invalid ${field}: ${String(v)}`)
    for (const key of ['corpus_id', 's2_paper_id'] as const) {
      const value = parsed[key]
      if (!value) continue
      if (out[key] && out[key] !== value) throw new S2IdError(`Conflicting ${key} values`)
      out[key] = value
    }
  }
  return out
}

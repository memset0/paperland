// New-style ids (0704 onward): YYMM.NNNN (2007–2014) or YYMM.NNNNN (2015+).
const NEW_STYLE = /^\d{4}\.\d{4,5}$/
// Old-style ids: archive[.SUBJECT]/YYMMNNN, e.g. hep-th/9901001, math.GT/0309136.
const OLD_STYLE = /^[a-z]+(?:-[a-z]+)*(?:\.[A-Z]{2})?\/\d{7}$/

/**
 * Normalize a user/extension-supplied arxiv id to the canonical stored form:
 * strips an `arXiv:` prefix (any case) and a trailing version (`v2`).
 * Returns null when the input is not a recognizable arxiv id.
 */
export function normalizeArxivId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const id = raw.trim().replace(/^arxiv:/i, '').replace(/v\d+$/, '')
  return NEW_STYLE.test(id) || OLD_STYLE.test(id) ? id : null
}

import { normalizeArxivId } from '../utils/arxiv_id.js'

/** Recognize paper identifiers without fetching or interpreting arbitrary reference URLs. */
export function topicArxivId(source: string | undefined): string | null {
  if (!source) return null
  try {
    const url = new URL(source)
    if (!['http:', 'https:'].includes(url.protocol) || !['arxiv.org', 'www.arxiv.org', 'export.arxiv.org'].includes(url.hostname.toLowerCase()) || url.port || url.username || url.password) return null
    if (!/^\/(abs|pdf|html)\//.test(url.pathname)) return null
    return normalizeArxivId(decodeURIComponent(url.pathname.replace(/^\/(abs|pdf|html)\//, '').replace(/\.pdf$/i, '')))
  } catch { return null }
}

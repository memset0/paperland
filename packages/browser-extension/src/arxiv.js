// Pure helpers shared by the background script and unit tests (no extension APIs here).

// New-style id (YYMM.NNNN / YYMM.NNNNN) or old-style id (archive[.SUBJECT]/YYMMNNN),
// each with an optional version suffix.
const ID_SOURCE = String.raw`(\d{4}\.\d{4,5}|[a-z]+(?:-[a-z]+)*(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?`
const ID_AT_START = new RegExp(`^${ID_SOURCE}(?:\\.pdf)?(?=$|/)`)
const ID_EXACT = new RegExp(`^${ID_SOURCE}$`)

// host → path prefixes that are followed by an arxiv id.
const SITES = [
  { hosts: ['arxiv.org', 'www.arxiv.org', 'export.arxiv.org'], prefixes: ['/abs/', '/pdf/', '/html/'] },
  { hosts: ['huggingface.co'], prefixes: ['/papers/'] },
  { hosts: ['alphaxiv.org', 'www.alphaxiv.org'], prefixes: ['/abs/', '/overview/', '/pdf/'] },
]

/** Strip an `arXiv:` prefix and version; returns the canonical id or null. */
export function normalizeArxivId(raw) {
  if (!raw) return null
  const m = String(raw).trim().replace(/^arxiv:/i, '').match(ID_EXACT)
  return m ? m[1] : null
}

/** Extract the arxiv id (without version) from a supported page URL, or null. */
export function extractArxivIdFromUrl(url) {
  let u
  try { u = new URL(url) } catch { return null }
  const site = SITES.find((s) => s.hosts.includes(u.hostname.toLowerCase()))
  if (!site) return null
  let path
  try { path = decodeURIComponent(u.pathname) } catch { path = u.pathname }
  for (const prefix of site.prefixes) {
    if (!path.startsWith(prefix)) continue
    const m = path.slice(prefix.length).match(ID_AT_START)
    if (m) return m[1]
  }
  return null
}

/** Build the Paperland quick-open URL: <base>/open/arxiv/<id>?token=<token>. */
export function buildOpenUrl(baseUrl, arxivId, token) {
  const base = String(baseUrl).trim().replace(/\/+$/, '')
  // Keep the "/" of old-style ids literal so it maps onto the route's path segments.
  const idPath = arxivId.split('/').map(encodeURIComponent).join('/')
  return `${base}/open/arxiv/${idPath}?token=${encodeURIComponent(token)}`
}

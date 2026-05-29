import { and, eq } from 'drizzle-orm'
import type { PaperBoundServiceDef } from './base_service.js'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'

const S2_BASE = 'https://api.semanticscholar.org/graph/v1'
const SERVICE_NAME = 'semantic_scholar_service'

// Fields for the single-paper lookup (resolves corpus_id + citation metrics).
const S2_FIELDS = [
  'externalIds',
  'title',
  'abstract',
  'authors',
  'citationCount',
  'influentialCitationCount',
  'references.title',
  'references.year',
  'tldr',
  'venue',
  'year',
  'publicationVenue',
  'fieldsOfStudy',
  'publicationDate',
].join(',')

// Fields for the citation-graph edge endpoints (contexts = where the citation occurs).
const REF_FIELDS = 'contexts,intents,isInfluential,citedPaper.paperId,citedPaper.externalIds,citedPaper.title,citedPaper.authors,citedPaper.year,citedPaper.venue,citedPaper.url'
const CIT_FIELDS = 'contexts,intents,isInfluential,citingPaper.paperId,citingPaper.externalIds,citingPaper.title,citingPaper.authors,citingPaper.year,citingPaper.venue,citingPaper.url'
// One page only, per product decision. S2 allows up to 1000 per page.
const EDGE_PAGE_LIMIT = 1000

interface S2Reference {
  paperId?: string
  title?: string
  year?: number
}

interface S2Response {
  paperId?: string
  externalIds?: { ArXiv?: string; DOI?: string; CorpusId?: number | string; [k: string]: unknown }
  title?: string
  abstract?: string
  authors?: Array<{ name: string }>
  citationCount?: number
  influentialCitationCount?: number
  references?: S2Reference[]
  tldr?: { model?: string; text?: string } | null
  venue?: string
  year?: number
  publicationVenue?: { name?: string } | null
  fieldsOfStudy?: string[] | null
  publicationDate?: string | null
}

/** Resolve the S2 API key: prefer literal `api_key`, else `api_key_env` env var. */
function getApiKey(): string | undefined {
  const svc = getConfig().services[SERVICE_NAME]
  if (svc?.api_key) return svc.api_key
  if (svc?.api_key_env) return process.env[svc.api_key_env] || undefined
  return undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Module-level rate gate shared by ALL S2 calls (single-paper + edge endpoints),
// so the multiple requests issued per paper still respect the configured 1 RPS.
let lastCallAt = 0
async function rateGate(): Promise<void> {
  const intervalMs = (getConfig().services[SERVICE_NAME]?.rate_limit_interval ?? 1) * 1000
  if (intervalMs <= 0) return
  const wait = lastCallAt + intervalMs - Date.now()
  if (wait > 0) await sleep(wait)
  lastCallAt = Date.now()
}

/**
 * GET a Semantic Scholar Graph API endpoint. Sends the API key as `x-api-key`,
 * spaces every call through the shared rate gate, and retries 429/5xx with
 * exponential backoff + jitter (honoring Retry-After). 403/404 are non-retriable.
 */
async function s2Get(path: string, fields: string, params: Record<string, string> = {}, maxRetries = 5): Promise<any> {
  const apiKey = getApiKey()
  const headers: Record<string, string> = {}
  if (apiKey) headers['x-api-key'] = apiKey
  const qs = new URLSearchParams({ fields, ...params }).toString()
  const url = `${S2_BASE}${path}?${qs}`

  for (let attempt = 0; ; attempt++) {
    await rateGate()
    const response = await fetch(url, { headers })
    if (response.ok) return response.json()

    if (response.status === 403) throw new Error('Semantic Scholar API returned 403 (invalid API key)')
    if (response.status === 404) throw new Error(`Semantic Scholar has no record for ${path}`)

    const retriable = response.status === 429 || response.status >= 500
    if (!retriable || attempt >= maxRetries) {
      throw new Error(`Semantic Scholar API returned ${response.status}`)
    }
    const retryAfter = Number(response.headers.get('retry-after'))
    const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(1000 * 2 ** attempt, 30000) + Math.floor(Math.random() * 500)
    console.log(`S2 ${response.status} for ${path}, retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`)
    await sleep(backoffMs)
  }
}

/** Single-paper lookup by id expression (e.g. `ARXIV:1706.03762`). */
async function fetchS2(idExpr: string): Promise<S2Response> {
  return s2Get(`/paper/${idExpr}`, S2_FIELDS) as Promise<S2Response>
}

export interface S2Match {
  corpus_id: string | null
  arxiv_id: string | null
  matched_title: string | null
  match_score: number | null
}

/**
 * Resolve a paper title to its Semantic Scholar ids via the title-match endpoint.
 * Returns null when there is no acceptable match. Goes through the shared S2 rate
 * gate + 429 backoff (so it is safe to call in a batch loop).
 */
export async function matchPaperByTitle(title: string): Promise<S2Match | null> {
  try {
    // Note: `matchScore` is returned automatically by the match endpoint and is NOT a
    // valid `fields` value (requesting it yields 400).
    const res = await s2Get('/paper/search/match', 'title,externalIds', { query: title })
    const m = res?.data?.[0]
    if (!m) return null
    const ext = m.externalIds || {}
    const corpus_id = ext.CorpusId != null ? String(ext.CorpusId)
      : (m.corpusId != null ? String(m.corpusId) : null)
    const arxiv_id = ext.ArXiv || null
    if (!corpus_id && !arxiv_id) return null
    return {
      corpus_id,
      arxiv_id,
      matched_title: m.title || null,
      match_score: typeof m.matchScore === 'number' ? m.matchScore : null,
    }
  } catch (e: any) {
    // The match endpoint returns 404 when nothing matches → treat as "no match".
    if (/no record/i.test(e?.message || '')) return null
    throw e
  }
}

/**
 * Map an S2 response onto paper fields. Writes back any external IDs the paper
 * is missing (notably corpus_id), and stores enrichment in metadata. Optional
 * fields S2 omits are skipped. The produced keys (corpus_id, citation_count,
 * influential_citation_count, references) are always written on success.
 */
function mapS2ToPaperFields(data: S2Response, paper: any): Record<string, any> {
  const result: Record<string, any> = {}
  const ext = data.externalIds || {}

  if (!paper.corpus_id && ext.CorpusId !== undefined && ext.CorpusId !== null) {
    result.corpus_id = String(ext.CorpusId)
  }
  if (!paper.arxiv_id && ext.ArXiv) {
    result.arxiv_id = ext.ArXiv
  }

  if (data.title) result.title = data.title
  if (data.abstract) result.abstract = data.abstract
  if (data.authors?.length) result.authors = data.authors.map((a) => a.name)

  result.citation_count = data.citationCount ?? 0
  result.influential_citation_count = data.influentialCitationCount ?? 0
  result.references = (data.references || []).map((r) => ({
    paper_id: r.paperId,
    title: r.title,
    year: r.year,
  }))

  if (data.tldr?.text) result.tldr = data.tldr.text
  const venue = data.venue || data.publicationVenue?.name
  if (venue) result.venue = venue
  if (data.year !== undefined) result.year = data.year
  if (ext.DOI) result.doi = ext.DOI
  if (data.fieldsOfStudy?.length) result.fields_of_study = data.fieldsOfStudy
  if (data.paperId) result.s2_url = `https://www.semanticscholar.org/paper/${data.paperId}`

  return result
}

/** Map one citation-graph edge to a paper_citations row. */
function mapEdge(edge: any, otherKey: 'citedPaper' | 'citingPaper', direction: string, paperId: number, now: string): Record<string, any> {
  const o = edge?.[otherKey] || {}
  const ext = o.externalIds || {}
  return {
    paper_id: paperId,
    direction,
    s2_paper_id: o.paperId ?? null,
    corpus_id: ext.CorpusId !== undefined && ext.CorpusId !== null ? String(ext.CorpusId) : null,
    arxiv_id: ext.ArXiv ?? null,
    doi: ext.DOI ?? null,
    title: o.title ?? null,
    authors: Array.isArray(o.authors) ? JSON.stringify(o.authors.map((a: any) => a.name)) : null,
    year: o.year ?? null,
    venue: o.venue ?? null,
    url: o.url ?? null,
    contexts: edge?.contexts?.length ? JSON.stringify(edge.contexts) : null,
    intents: edge?.intents?.length ? JSON.stringify(edge.intents) : null,
    is_influential: edge?.isInfluential ? 1 : 0,
    created_at: now,
  }
}

/** Replace the stored edges of one direction for a paper (idempotent on re-run). */
function saveEdges(paperId: number, direction: string, rows: Record<string, any>[]): void {
  const db = getDatabase()
  db.delete(schema.paperCitations)
    .where(and(eq(schema.paperCitations.paper_id, paperId), eq(schema.paperCitations.direction, direction)))
    .run()
  for (let i = 0; i < rows.length; i += 200) {
    db.insert(schema.paperCitations).values(rows.slice(i, i + 200)).run()
  }
}

/**
 * Fetch one page each of references (papers this paper cites) and citations
 * (papers that cite this paper), with contexts/intents, and store them in
 * paper_citations. Best-effort: a failure in either direction is logged and does
 * not fail the enrichment.
 */
async function fetchAndSaveEdges(paperId: number, arxivId: string): Promise<void> {
  const now = new Date().toISOString()
  const limit = String(EDGE_PAGE_LIMIT)

  try {
    const refs = await s2Get(`/paper/ARXIV:${arxivId}/references`, REF_FIELDS, { limit })
    const rows = (refs.data || [])
      .map((e: any) => mapEdge(e, 'citedPaper', 'reference', paperId, now))
      .filter((r: Record<string, any>) => r.s2_paper_id || r.title)
    saveEdges(paperId, 'reference', rows)
  } catch (err: any) {
    console.warn(`S2 references fetch failed for paper ${paperId}: ${err.message || err}`)
  }

  try {
    const cites = await s2Get(`/paper/ARXIV:${arxivId}/citations`, CIT_FIELDS, { limit })
    const rows = (cites.data || [])
      .map((e: any) => mapEdge(e, 'citingPaper', 'citation', paperId, now))
      .filter((r: Record<string, any>) => r.s2_paper_id || r.title)
    saveEdges(paperId, 'citation', rows)
  } catch (err: any) {
    console.warn(`S2 citations fetch failed for paper ${paperId}: ${err.message || err}`)
  }
}

/**
 * Fetches Semantic Scholar data for an arxiv paper: resolves corpus_id, stores
 * citation metrics/references/tldr on the paper, and captures the citation graph
 * (references + citations with contexts) into the paper_citations table.
 */
export const semanticScholarService: PaperBoundServiceDef = {
  name: SERVICE_NAME,
  type: 'paper_bound',
  depends_on: ['arxiv_id'],
  produces: ['corpus_id', 'citation_count', 'influential_citation_count', 'references'],

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    const arxivId = paper.arxiv_id
    if (!arxivId) throw new Error('No arxiv_id on paper')

    const data = await fetchS2(`ARXIV:${arxivId}`)
    const result = mapS2ToPaperFields(data, paper)

    // Capture the citation graph (best-effort; does not block enrichment).
    await fetchAndSaveEdges(paperId, arxivId)

    return result
  },
}

// Exported for unit testing (mocked fetch).
export const __test__ = { fetchS2, mapS2ToPaperFields, mapEdge, getApiKey, s2Get, S2_FIELDS }

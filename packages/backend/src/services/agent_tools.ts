import { and, desc, eq, inArray, isNull, like, or, type SQL } from 'drizzle-orm'
import type { S2PaperMeta } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import { ownerVisibilityFilter, type Viewer } from '../auth/visibility.js'
import { resolvePaperContent } from './qa_formatter.js'
import { s2ApiGet } from './semantic_scholar_service.js'
import { cacheS2Records, resolveS2Ids } from './s2_paper_cache.js'
import { existsSync, readFileSync, realpathSync, statSync } from 'fs'
import { basename, join, sep } from 'path'
import { ImageValidationError, storeImage } from './image_store.js'
import type { TokenKind } from './api_tokens.js'

/**
 * Tools for agents (served over MCP by `api/mcp.ts`). Site tools read the paper library with the
 * caller's visibility; S2 tools go through the backend's Semantic Scholar client (key, shared rate
 * gate, backoff) so the agent never sees the key, and cache what they find. All tools are read-only
 * except `upload_image`, which stores an image in the image host. Deep Research rounds get every
 * tool; Q&A runs get only `upload_image`.
 */

export interface AgentToolContext {
  viewer: Viewer
  /** Kind of the bearer token; only agent tokens (Paperland's own Codex runs) may upload by path. */
  token_kind?: TokenKind
}

/** MCP tool annotations; tools without them are listed as read-only. */
export interface AgentToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface AgentToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>, ctx: AgentToolContext) => Promise<unknown>
  annotations?: AgentToolAnnotations
}

/** A failure reported back to the agent as a tool error (not a protocol error). */
export class AgentToolError extends Error {}

type PaperRow = typeof schema.papers.$inferSelect

const S2_PAPER_FIELDS = ['paperId', 'externalIds', 'title', 'authors', 'year', 'venue', 'abstract', 'citationCount', 'url']
const S2_LIST_ABSTRACT_CHARS = 600
const S2_SEARCH_MAX = 100
const S2_EDGE_DEFAULT = 20
const S2_EDGE_MAX = 100
const QA_MAX_ENTRIES = 20
const SAFE_PATH_RE = /^\/[A-Za-z0-9_\-./:%]+$/

// ---- argument helpers ----

function str(args: Record<string, unknown>, key: string, required = true): string | undefined {
  const value = args[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (required) throw new AgentToolError(`"${key}" must be a non-empty string`)
  return undefined
}

function int(args: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = args[key]
  if (value === undefined || value === null) return fallback
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new AgentToolError(`"${key}" must be an integer`)
  return Math.min(Math.max(n, min), max)
}

function paperIdArg(args: Record<string, unknown>): number {
  const id = int(args, 'paper_id', NaN, 1, Number.MAX_SAFE_INTEGER)
  if (!Number.isInteger(id)) throw new AgentToolError('"paper_id" is required')
  return id
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function appLink(paperId: number): string {
  return `paperland://paper/${paperId}`
}

// ---- site paper tools ----

function loadPaper(id: number): PaperRow {
  const paper = getDatabase().select().from(schema.papers).where(eq(schema.papers.id, id)).get()
  if (!paper) throw new AgentToolError(`Paper ${id} not found`)
  return paper
}

function paperMeta(paper: Pick<PaperRow, 'metadata'>): { year: number | null; venue: string | null } {
  const m = parseJson<Record<string, unknown>>(paper.metadata, {})
  return {
    year: typeof m.year === 'number' ? m.year : null,
    venue: typeof m.venue === 'string' && m.venue ? m.venue : null,
  }
}

function libraryPaperIds(viewer: Viewer, paperIds: number[]): Set<number> {
  if (paperIds.length === 0) return new Set()
  return new Set(getDatabase().select({ id: schema.userPapers.paper_id }).from(schema.userPapers)
    .where(and(eq(schema.userPapers.user_id, viewer.id), eq(schema.userPapers.in_library, 1), inArray(schema.userPapers.paper_id, paperIds)))
    .all().map((r) => r.id))
}

function fullTextInfo(paper: Pick<PaperRow, 'contents'>): { source: string; chars: number } | null {
  const content = resolvePaperContent(paper)
  return content ? { source: content.source, chars: content.text.length } : null
}

async function searchPapers(args: Record<string, unknown>, ctx: AgentToolContext) {
  const query = str(args, 'query')!
  const cap = getConfig().agent_tools.search_max_results
  const limit = int(args, 'limit', Math.min(10, cap), 1, cap)
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10)
  const conds: SQL[] = terms.map((t) => {
    const pattern = `%${t.replace(/[%_]/g, '')}%`
    return or(like(schema.papers.title, pattern), like(schema.papers.authors, pattern), like(schema.papers.abstract, pattern))!
  })
  const db = getDatabase()
  const rows = db.select({
    id: schema.papers.id, title: schema.papers.title, authors: schema.papers.authors, abstract: schema.papers.abstract,
    metadata: schema.papers.metadata, s2_paper_id: schema.papers.s2_paper_id, corpus_id: schema.papers.corpus_id, arxiv_id: schema.papers.arxiv_id,
  }).from(schema.papers).where(and(eq(schema.papers.listed, 1), ...conds)).limit(500).all()
  // Rank: terms found in the title count most, then authors, then abstract.
  const score = (r: typeof rows[number]) => terms.reduce((s, t) =>
    s + (r.title.toLowerCase().includes(t) ? 3 : 0) + (r.authors.toLowerCase().includes(t) ? 2 : 0) + ((r.abstract ?? '').toLowerCase().includes(t) ? 1 : 0), 0)
  const top = rows.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s || b.r.id - a.r.id).slice(0, limit).map((x) => x.r)
  const ids = top.map((r) => r.id)
  const contents = new Map(ids.length
    ? db.select({ id: schema.papers.id, contents: schema.papers.contents }).from(schema.papers).where(inArray(schema.papers.id, ids)).all().map((r) => [r.id, r])
    : [])
  const mine = libraryPaperIds(ctx.viewer, ids)
  return {
    total_matches: rows.length,
    papers: top.map((r) => ({
      paper_id: r.id,
      title: r.title,
      authors: parseJson<string[]>(r.authors, []).slice(0, 5),
      ...paperMeta(r),
      s2_paper_id: r.s2_paper_id,
      corpus_id: r.corpus_id,
      arxiv_id: r.arxiv_id,
      has_full_text: !!(contents.get(r.id) && fullTextInfo(contents.get(r.id)!)),
      in_my_library: mine.has(r.id),
      link: appLink(r.id),
    })),
  }
}

async function getPaper(args: Record<string, unknown>, ctx: AgentToolContext) {
  const paper = loadPaper(paperIdArg(args))
  const tags = getDatabase().select({ name: schema.tags.name }).from(schema.paperTags)
    .innerJoin(schema.tags, eq(schema.paperTags.tag_id, schema.tags.id))
    .where(and(eq(schema.paperTags.paper_id, paper.id), eq(schema.tags.user_id, ctx.viewer.id)))
    .all().map((t) => t.name)
  const m = parseJson<Record<string, unknown>>(paper.metadata, {})
  return {
    paper_id: paper.id,
    title: paper.title,
    authors: parseJson<string[]>(paper.authors, []),
    abstract: paper.abstract,
    ...paperMeta(paper),
    s2_paper_id: paper.s2_paper_id,
    corpus_id: paper.corpus_id,
    arxiv_id: paper.arxiv_id,
    doi: typeof m.doi === 'string' ? m.doi : null,
    tldr: typeof m.tldr === 'string' ? m.tldr : null,
    citation_count: typeof m.citation_count === 'number' ? m.citation_count : null,
    source_link: paper.link,
    link: appLink(paper.id),
    listed: paper.listed === 1,
    in_my_library: libraryPaperIds(ctx.viewer, [paper.id]).has(paper.id),
    my_tags: tags,
    full_text: fullTextInfo(paper),
  }
}

/** Markdown headings outside fenced code blocks, with the character offset of their line. */
export function markdownOutline(text: string): Array<{ level: number; title: string; offset: number }> {
  const out: Array<{ level: number; title: string; offset: number }> = []
  let offset = 0
  let fence: string | null = null
  for (const line of text.split('\n')) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null
    } else if (fenceMatch) {
      fence = fenceMatch[1]
    } else {
      const h = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
      if (h) out.push({ level: h[1].length, title: h[2], offset })
    }
    offset += line.length + 1
  }
  return out
}

async function readPaper(args: Record<string, unknown>) {
  const paper = loadPaper(paperIdArg(args))
  const content = resolvePaperContent(paper)
  if (!content) throw new AgentToolError(`Paper ${paper.id} has no full text (not parsed yet)`)
  const total = content.text.length
  if (args.outline === true) {
    return { paper_id: paper.id, source: content.source, total_chars: total, outline: markdownOutline(content.text) }
  }
  const cap = getConfig().agent_tools.read_max_chars
  const offset = int(args, 'offset', 0, 0, total)
  const maxChars = int(args, 'max_chars', cap, 1, cap)
  const end = Math.min(offset + maxChars, total)
  return {
    paper_id: paper.id,
    source: content.source,
    total_chars: total,
    offset,
    next_offset: end < total ? end : null,
    text: content.text.slice(offset, end),
  }
}

async function getPaperQA(args: Record<string, unknown>, ctx: AgentToolContext) {
  const paper = loadPaper(paperIdArg(args))
  const cap = getConfig().agent_tools.qa_answer_max_chars
  const maxChars = int(args, 'max_chars_per_answer', cap, 100, cap)
  const db = getDatabase()
  const visible = ownerVisibilityFilter(ctx.viewer, 'qa', schema.qaEntries.user_id, 'all')
  const entries = db.select().from(schema.qaEntries)
    .where(and(eq(schema.qaEntries.paper_id, paper.id), visible ? or(eq(schema.qaEntries.type, 'template'), visible) : undefined))
    .all()
  if (entries.length === 0) return { paper_id: paper.id, entries: [] }
  const results = db.select().from(schema.qaResults)
    .where(and(inArray(schema.qaResults.qa_entry_id, entries.map((e) => e.id)), eq(schema.qaResults.status, 'done'), isNull(schema.qaResults.deleted_at)))
    .orderBy(desc(schema.qaResults.completed_at))
    .all()
  const latest = new Map<number, typeof results[number]>()
  for (const r of results) if (!latest.has(r.qa_entry_id)) latest.set(r.qa_entry_id, r)
  const byId = new Map(entries.map((e) => [e.id, e]))
  return {
    paper_id: paper.id,
    entries: [...latest.values()].slice(0, QA_MAX_ENTRIES).map((r) => {
      const entry = byId.get(r.qa_entry_id)!
      return {
        entry_id: entry.id,
        type: entry.type,
        question: entry.prompt ?? entry.template_name ?? r.prompt,
        model_name: r.model_name,
        completed_at: r.completed_at,
        answer: truncate(r.answer, maxChars),
        answer_truncated: r.answer.length > maxChars,
      }
    }),
  }
}

// ---- Semantic Scholar tools ----

function s2Failure(error: unknown): AgentToolError {
  const status = (error as { status?: number })?.status
  return new AgentToolError(status ? `Semantic Scholar returned HTTP ${status}` : `Semantic Scholar request failed: ${(error as Error)?.message ?? error}`)
}

async function s2(path: string, params: Record<string, string>): Promise<any> {
  try {
    return await s2ApiGet(path, params)
  } catch (error) {
    throw s2Failure(error)
  }
}

/** In-app links for S2 records that match a library paper (by paperId or CorpusId). */
function libraryLinksFor(records: any[]): Map<string, string> {
  const pids = records.map((r) => r?.paperId).filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase())
  const cids = records.map((r) => r?.externalIds?.CorpusId).filter((x) => x != null).map(String)
  if (!pids.length && !cids.length) return new Map()
  const conds = []
  if (pids.length) conds.push(inArray(schema.papers.s2_paper_id, pids))
  if (cids.length) conds.push(inArray(schema.papers.corpus_id, cids))
  const rows = getDatabase().select({ id: schema.papers.id, s2: schema.papers.s2_paper_id, corpus: schema.papers.corpus_id })
    .from(schema.papers).where(or(...conds)).all()
  const out = new Map<string, string>()
  for (const r of rows) {
    if (r.s2) out.set(`p:${r.s2}`, appLink(r.id))
    if (r.corpus) out.set(`c:${r.corpus}`, appLink(r.id))
  }
  return out
}

function compactS2(rec: any, links: Map<string, string>) {
  const ext = rec.externalIds ?? {}
  const pid = typeof rec.paperId === 'string' ? rec.paperId.toLowerCase() : null
  const corpus = ext.CorpusId != null ? String(ext.CorpusId) : null
  const authors: string[] = Array.isArray(rec.authors) ? rec.authors.map((a: any) => a?.name).filter(Boolean) : []
  return {
    s2_paper_id: pid,
    corpus_id: corpus,
    arxiv_id: ext.ArXiv ?? null,
    title: rec.title ?? null,
    authors: authors.length > 8 ? [...authors.slice(0, 8), `et al. (${authors.length} authors)`] : authors,
    year: rec.year ?? null,
    venue: rec.venue || null,
    citation_count: rec.citationCount ?? null,
    abstract: truncate(rec.abstract, S2_LIST_ABSTRACT_CHARS),
    in_library: (pid && links.get(`p:${pid}`)) || (corpus && links.get(`c:${corpus}`)) || null,
  }
}

function cacheQuietly(records: any[]): void {
  try { cacheS2Records(records) } catch (error) { console.warn('[agent_tools] failed to cache S2 records:', error) }
}

function compactList(records: any[]) {
  const valid = records.filter((r) => r && typeof r.paperId === 'string')
  cacheQuietly(valid)
  const links = libraryLinksFor(valid)
  return valid.map((r) => compactS2(r, links))
}

async function s2Search(args: Record<string, unknown>) {
  const params: Record<string, string> = {
    query: str(args, 'query')!,
    limit: String(int(args, 'limit', 10, 1, S2_SEARCH_MAX)),
    fields: S2_PAPER_FIELDS.join(','),
  }
  const year = str(args, 'year', false)
  if (year) params.year = year
  const res = await s2('/graph/v1/paper/search', params)
  return { total: res?.total ?? null, papers: compactList(res?.data ?? []) }
}

async function s2Match(args: Record<string, unknown>) {
  const title = str(args, 'title')!
  try {
    const res = await s2ApiGet('/graph/v1/paper/search/match', { query: title, fields: S2_PAPER_FIELDS.join(',') })
    const best = res?.data?.[0]
    if (!best) return { match: null }
    const [paper] = compactList([best])
    return { match: { ...paper, match_score: best.matchScore ?? null } }
  } catch (error) {
    if ((error as { status?: number })?.status === 404) return { match: null }
    throw s2Failure(error)
  }
}

function metaForAgent(meta: S2PaperMeta) {
  return {
    s2_paper_id: meta.s2_paper_id,
    corpus_id: meta.corpus_id,
    arxiv_id: meta.arxiv_id,
    doi: meta.doi,
    title: meta.title,
    authors: meta.authors,
    year: meta.year,
    venue: meta.venue,
    citation_count: meta.citation_count,
    tldr: meta.tldr,
    abstract: truncate(meta.abstract, getConfig().research.abstract_char_limit),
  }
}

async function s2Papers(args: Record<string, unknown>) {
  const ids = args.ids
  const max = getConfig().s2_cache.max_ids_per_request
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string')) {
    throw new AgentToolError('"ids" must be a non-empty array of S2 ids')
  }
  if (ids.length > max) throw new AgentToolError(`At most ${max} ids per call`)
  const results = await resolveS2Ids(ids as string[], { allowFetch: true })
  return {
    results: results.map((r) => ({
      id: r.id,
      status: r.status,
      paper: r.paper ? metaForAgent(r.paper) : null,
      in_library: r.library_paper_id != null ? appLink(r.library_paper_id) : null,
    })),
  }
}

function s2IdArg(args: Record<string, unknown>): string {
  const id = str(args, 'id')!
  if (!/^[A-Za-z0-9:._-]+$/.test(id)) throw new AgentToolError('"id" must be an S2 paperId or an id expression such as CorpusId:123 or ARXIV:2106.15928')
  return id
}

async function s2Edges(args: Record<string, unknown>, kind: 'citations' | 'references') {
  const id = s2IdArg(args)
  const side = kind === 'citations' ? 'citingPaper' : 'citedPaper'
  const res = await s2(`/graph/v1/paper/${encodeURIComponent(id)}/${kind}`, {
    fields: ['isInfluential', ...S2_PAPER_FIELDS.map((f) => `${side}.${f}`)].join(','),
    limit: String(int(args, 'limit', S2_EDGE_DEFAULT, 1, S2_EDGE_MAX)),
    offset: String(int(args, 'offset', 0, 0, 9999)),
  })
  const edges: any[] = res?.data ?? []
  const papers = edges.map((e) => e?.[side]).filter((p) => p && typeof p.paperId === 'string')
  cacheQuietly(papers)
  const links = libraryLinksFor(papers)
  return {
    offset: res?.offset ?? 0,
    next_offset: res?.next ?? null,
    papers: edges.filter((e) => e?.[side]?.paperId).map((e) => ({ ...compactS2(e[side], links), is_influential: !!e.isInfluential })),
  }
}

/** Validate an `s2_get` path against the configured allowlist. Returns an error message or null. */
export function s2PathError(path: string): string | null {
  if (!path.startsWith('/')) return 'path must start with "/"'
  if (path.includes('?') || path.includes('#')) return 'put query parameters in "params", not in the path'
  if (path.includes('..') || !SAFE_PATH_RE.test(path)) return 'path contains disallowed characters'
  const prefixes = getConfig().agent_tools.s2_get_path_prefixes
  if (!prefixes.some((p) => path.startsWith(p))) return `path must start with one of: ${prefixes.join(', ')}`
  return null
}

async function s2GetPassthrough(args: Record<string, unknown>) {
  const path = str(args, 'path')!
  const pathError = s2PathError(path)
  if (pathError) throw new AgentToolError(`s2_get rejected: ${pathError}`)
  const params: Record<string, string> = {}
  const raw = args.params
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new AgentToolError('"params" must be an object')
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (['string', 'number', 'boolean'].includes(typeof v)) params[k] = String(v)
      else throw new AgentToolError(`params.${k} must be a string, number, or boolean`)
    }
  }
  const res = await s2(path, params)
  const text = JSON.stringify(res)
  const max = getConfig().agent_tools.s2_get_max_chars
  return text.length > max ? { truncated: true, total_chars: text.length, text: text.slice(0, max) } : res
}

// ---- registry ----

const paperIdSchema = { type: 'integer', description: 'Paperland paper id (from search_papers or a paperland://paper/<id> link)' }

// ---- image upload ----

/** Real paths of `<codex_home>/generated_images` of every configured Codex model that exist. */
function generatedImageRoots(): string[] {
  const homes = new Set(getConfig().models.available.flatMap((m) => m.type === 'codex' && m.codex_home ? [m.codex_home] : []))
  return [...homes].map((home) => join(home, 'generated_images')).filter((dir) => existsSync(dir)).map((dir) => realpathSync(dir))
}

/** Resolve `raw` to a regular file inside a generated-images root, or throw. Nothing is read before this passes. */
function generatedImagePath(raw: string): string {
  if (!raw.startsWith('/')) throw new AgentToolError('"path" must be an absolute path')
  let real: string
  try { real = realpathSync(raw) } catch { throw new AgentToolError(`No such file: ${raw}`) }
  if (!generatedImageRoots().some((root) => real.startsWith(root + sep))) {
    throw new AgentToolError('"path" must be an image generated by Codex (under $CODEX_HOME/generated_images/)')
  }
  if (!statSync(real).isFile()) throw new AgentToolError(`Not a file: ${raw}`)
  return real
}

async function uploadImage(args: Record<string, unknown>, ctx: AgentToolContext) {
  const path = str(args, 'path', false)
  const data = str(args, 'data', false)
  if (!path === !data) throw new AgentToolError('Give exactly one of "path" or "data"')
  const alt = (str(args, 'alt', false) ?? '').replace(/[\[\]\n]/g, ' ').trim()
  let input: string
  let originalName: string | null = null
  if (path) {
    if (ctx.token_kind !== 'agent') throw new AgentToolError('"path" uploads are only available to Paperland\'s own agent runs; send "data" (base64) instead')
    const file = generatedImagePath(path)
    input = readFileSync(file).toString('base64')
    originalName = basename(file)
  } else {
    input = data!
  }
  try {
    const { row, deduped } = storeImage(input, { originalName, userId: ctx.viewer.id })
    const url = `/image/${row.path}`
    return { url, markdown: `![${alt}](${url})`, width: row.width, height: row.height, deduped }
  } catch (error) {
    if (error instanceof ImageValidationError) throw new AgentToolError(error.message)
    throw error
  }
}

export const AGENT_TOOLS: AgentToolDef[] = [
  {
    name: 'search_papers',
    description: 'Search the Paperland library (listed papers) by title, authors, or abstract. Every whitespace-separated term must match. Returns Paperland ids, S2 ids, and whether full text can be read.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1 } }, required: ['query'] },
    handler: searchPapers,
  },
  {
    name: 'get_paper',
    description: 'Metadata of a Paperland paper: title, authors, abstract, year, venue, S2/arXiv ids, your tags, links, and full-text availability.',
    inputSchema: { type: 'object', properties: { paper_id: paperIdSchema }, required: ['paper_id'] },
    handler: getPaper,
  },
  {
    name: 'read_paper',
    description: 'Read the parsed full text (Markdown) of a Paperland paper in pages. Use outline=true first to get section headings with character offsets, then read from an offset. Follow next_offset to continue.',
    inputSchema: {
      type: 'object',
      properties: {
        paper_id: paperIdSchema,
        offset: { type: 'integer', minimum: 0, description: 'Character offset to start from (default 0)' },
        max_chars: { type: 'integer', minimum: 1, description: 'Page size (capped by the server)' },
        outline: { type: 'boolean', description: 'Return only the section outline' },
      },
      required: ['paper_id'],
    },
    handler: (args) => readPaper(args),
  },
  {
    name: 'get_paper_qa',
    description: 'Existing Q&A answers about a Paperland paper that you are allowed to see (latest answer per question, truncated).',
    inputSchema: { type: 'object', properties: { paper_id: paperIdSchema, max_chars_per_answer: { type: 'integer', minimum: 100 } }, required: ['paper_id'] },
    handler: getPaperQA,
  },
  {
    name: 's2_search',
    description: 'Semantic Scholar relevance search. Returns S2 paperIds (use them as s2_id / #cite ids), metadata, and in_library links. Shares a ~1 request/second limit: prefer few, specific queries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        year: { type: 'string', description: 'Year or range, e.g. "2024" or "2020-2023"' },
        limit: { type: 'integer', minimum: 1, maximum: S2_SEARCH_MAX },
      },
      required: ['query'],
    },
    handler: (args) => s2Search(args),
  },
  {
    name: 's2_match',
    description: 'Find the Semantic Scholar paper whose title best matches a known title (the reliable way to get a paper\'s S2 paperId). Returns null when there is no match. Check that title, year, and authors agree.',
    inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    handler: (args) => s2Match(args),
  },
  {
    name: 's2_papers',
    description: 'Batch metadata for S2 ids (40-hex paperId, CorpusId:<n>, or a semanticscholar.org URL), served from the local cache when possible. Use it to verify ids in one call.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1 } }, required: ['ids'] },
    handler: (args) => s2Papers(args),
  },
  {
    name: 's2_citations',
    description: 'One page of papers that cite the given paper (S2 paperId or id expression like CorpusId:123, ARXIV:2106.15928).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: S2_EDGE_MAX }, offset: { type: 'integer', minimum: 0 } }, required: ['id'] },
    handler: (args) => s2Edges(args, 'citations'),
  },
  {
    name: 's2_references',
    description: 'One page of papers referenced by the given paper (S2 paperId or id expression like CorpusId:123, ARXIV:2106.15928).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: S2_EDGE_MAX }, offset: { type: 'integer', minimum: 0 } }, required: ['id'] },
    handler: (args) => s2Edges(args, 'references'),
  },
  {
    name: 's2_get',
    description: 'GET any Semantic Scholar Graph API endpoint, e.g. path "/graph/v1/author/search" with params {"query": "...", "fields": "name,paperCount"}. Only allowed path prefixes work; the response may be truncated.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute API path such as /graph/v1/paper/{id}' },
        params: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
      },
      required: ['path'],
    },
    handler: (args) => s2GetPassthrough(args),
  },
  {
    name: 'upload_image',
    description: 'Upload an image to the Paperland image host and get Markdown to embed it in your answer. After generating an image with the built-in image generation tool, pass its saved file path (under $CODEX_HOME/generated_images/) as "path"; other clients send the image as base64 or a data: URL in "data". Embed the returned "markdown" exactly; never put local file paths in the answer.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of an image generated by Codex' },
        data: { type: 'string', description: 'Image as base64 or a data: URL (PNG, JPEG, GIF or WebP)' },
        alt: { type: 'string', description: 'Short caption used as the image alt text' },
      },
    },
    handler: uploadImage,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
]

const TOOLS_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]))

/** Run a tool; failures come back as `isError` results with a message for the agent. */
export async function callAgentTool(name: string, args: unknown, ctx: AgentToolContext): Promise<{ text: string; isError: boolean }> {
  const tool = TOOLS_BY_NAME.get(name)
  if (!tool) return { text: `Unknown tool: ${name}`, isError: true }
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args as Record<string, unknown> : {}
  try {
    return { text: JSON.stringify(await tool.handler(input, ctx)), isError: false }
  } catch (error) {
    if (error instanceof AgentToolError) return { text: error.message, isError: true }
    console.error(`[agent_tools] ${name} failed:`, error)
    return { text: `Tool ${name} failed: ${(error as Error)?.message ?? 'internal error'}`, isError: true }
  }
}

import { and, desc, eq, inArray, isNull, like, or, type SQL } from 'drizzle-orm'
import type { S2PaperMeta } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import { ownerVisibilityFilter, type Viewer } from '../auth/visibility.js'
import { resolvePaperContent } from './qa_formatter.js'
import { s2ApiGet } from './semantic_scholar_service.js'
import { cacheS2Records, resolveS2Ids } from './s2_paper_cache.js'
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'fs'
import { basename, join, sep } from 'path'
import { ImageValidationError, mediaUploadResult, storeImageBytes } from './image_store.js'
import { fetchRemoteMedia, RemoteFetchError, RemoteUrlNotAllowedError } from './remote_media.js'
import type { TokenKind } from './api_tokens.js'
import {
  PaperActionError, createPaperForUser, getPaperOrThrow, startPdfRefetch, startS2Refresh, storeUploadedPdf, updatePaperFields,
} from './paper_actions.js'
import { derivePdfStatus } from '../utils/pdf_status.js'

/**
 * Tools for agents (served over MCP by `api/mcp.ts`). Site tools read the paper library with the
 * caller's visibility; S2 tools go through the backend's Semantic Scholar client (key, shared rate
 * gate, backoff) so the agent never sees the key, and cache what they find. `upload_image` stores
 * an image in the image host. The paper write tools (`write: true`: add_paper, update_paper,
 * upload_paper_pdf, refresh_paper) are for a user's own external agents (personal tokens only).
 * Deep Research rounds get every non-write tool; Q&A runs get only `upload_image`.
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
  /** Changes papers: personal tokens only, never enabled for Paperland's own agent runs. */
  write?: boolean
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
  const url = str(args, 'url', false)
  if ([path, data, url].filter(Boolean).length !== 1) throw new AgentToolError('Give exactly one of "path", "data" or "url"')
  const alt = (str(args, 'alt', false) ?? '').replace(/[\[\]\n]/g, ' ').trim()
  try {
    let buf: Buffer
    let originalName: string | null = null
    if (path) {
      if (ctx.token_kind !== 'agent') throw new AgentToolError('"path" uploads are only available to Paperland\'s own agent runs; send "url", or upload the file with POST /external-api/v1/images')
      const file = generatedImagePath(path)
      buf = readFileSync(file)
      originalName = basename(file)
    } else if (url) {
      const remote = await fetchRemoteMedia(url)
      buf = remote.buf
      originalName = remote.filename
    } else {
      const comma = data!.indexOf(',')
      buf = Buffer.from(data!.startsWith('data:') && comma !== -1 ? data!.slice(comma + 1) : data!, 'base64')
    }
    return mediaUploadResult(storeImageBytes(buf, { originalName, userId: ctx.viewer.id }), alt)
  } catch (error) {
    if (error instanceof ImageValidationError || error instanceof RemoteFetchError || error instanceof RemoteUrlNotAllowedError) {
      throw new AgentToolError(error.message)
    }
    throw error
  }
}

// ---- skills ----

function skillsDir(): string | null {
  return getConfig().agent_tools.skills_dir || null
}

/** Front matter `name` / `description` of a SKILL.md (simple `key: value` lines). */
function skillFrontMatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  const out: Record<string, string> = {}
  for (const line of (m?.[1] ?? '').split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

function getSkill(args: Record<string, unknown>) {
  const dir = skillsDir()
  if (!dir || !existsSync(dir)) throw new AgentToolError('No skills are available')
  const name = str(args, 'name', false)
  if (!name) {
    const skills = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
      .map((e) => {
        const fm = skillFrontMatter(readFileSync(join(dir, e.name, 'SKILL.md'), 'utf8'))
        return { name: e.name, description: fm.description ?? '' }
      })
    return { skills }
  }
  if (!/^[a-z0-9-]+$/.test(name)) throw new AgentToolError('Invalid skill name')
  const file = join(dir, name, 'SKILL.md')
  if (!existsSync(file)) throw new AgentToolError(`Unknown skill: ${name}`)
  return { name, text: readFileSync(file, 'utf8') }
}

// ---- paper write tools (personal tokens only) ----

function requirePersonal(ctx: AgentToolContext): void {
  if (ctx.token_kind !== 'personal') {
    throw new AgentToolError('Paper write tools need a personal API token; Paperland\'s own agent runs cannot change papers')
  }
}

/** Run a paper action, turning its validation errors into tool errors. */
function action<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    if (error instanceof PaperActionError) throw new AgentToolError(`${error.code}: ${error.message}`)
    throw error
  }
}

/** Decode base64 or a `data:application/pdf;base64,` URL. */
function pdfBytes(data: string): Uint8Array {
  const raw = data.replace(/^data:[^,]*;base64,/, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) throw new AgentToolError('"data" must be base64 (or a data: URL) of a PDF file')
  return new Uint8Array(Buffer.from(raw, 'base64'))
}

function pdfStatusOf(paperId: number) {
  const paper = getPaperOrThrow(paperId)
  const executions = getDatabase().select({
    id: schema.serviceExecutions.id, service_name: schema.serviceExecutions.service_name,
    status: schema.serviceExecutions.status, created_at: schema.serviceExecutions.created_at,
  }).from(schema.serviceExecutions).where(eq(schema.serviceExecutions.paper_id, paperId)).all()
  return derivePdfStatus(paper, executions)
}

function writtenPaper(paper: PaperRow) {
  const meta = parseJson<Record<string, any>>(paper.metadata, {})
  return {
    paper_id: paper.id,
    title: paper.title,
    authors: parseJson<string[]>(paper.authors, []),
    abstract: paper.abstract,
    kind: paper.kind,
    link: paper.link,
    year: meta.year ?? null,
    venue: meta.venue ?? null,
    pdf_url: meta.pdf_url ?? null,
    published_at: meta.published_at ?? null,
    modified_at: meta.modified_at ?? null,
    arxiv_id: paper.arxiv_id,
    app_link: appLink(paper.id),
    ...pdfStatusOf(paper.id),
  }
}

const EDITABLE_FIELDS = ['title', 'authors', 'link', 'abstract', 'year', 'venue', 'kind', 'pdf_url', 'published_at', 'modified_at', 'content'] as const

function pickFields(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) if (args[key] !== undefined) out[key] = args[key]
  return out
}

async function addPaperTool(args: Record<string, unknown>, ctx: AgentToolContext) {
  requirePersonal(ctx)
  const data = str(args, 'pdf_data', false)
  const bytes = data ? pdfBytes(data) : null
  const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()) : undefined
  let result
  try {
    result = await createPaperForUser(ctx.viewer.id, {
      ...pickFields(args),
      arxiv_id: str(args, 'arxiv_id', false),
      corpus_id: str(args, 'corpus_id', false),
      s2_paper_id: str(args, 's2_paper_id', false),
      tags,
    } as any)
  } catch (error) {
    if (error instanceof PaperActionError) throw new AgentToolError(`${error.code}: ${error.message}`)
    throw error
  }
  let pdf_note: string | undefined
  if (bytes) {
    if (result.paper.pdf_path) pdf_note = 'The paper already has a PDF; pdf_data was ignored (use upload_paper_pdf with replace=true).'
    else action(() => storeUploadedPdf(result.paper.id, bytes))
  }
  return { ...writtenPaper(getPaperOrThrow(result.paper.id)), created: result.created, ...(pdf_note ? { pdf_note } : {}) }
}

async function updatePaperTool(args: Record<string, unknown>, ctx: AgentToolContext) {
  requirePersonal(ctx)
  const id = paperIdArg(args)
  return writtenPaper(action(() => updatePaperFields(id, pickFields(args) as any)))
}

async function uploadPaperPdfTool(args: Record<string, unknown>, ctx: AgentToolContext) {
  requirePersonal(ctx)
  const id = paperIdArg(args)
  const data = str(args, 'data', false)
  const url = str(args, 'url', false)
  if (!data === !url) throw new AgentToolError('Give exactly one of "data" or "url"')
  const replace = args.replace === true
  if (data) {
    const bytes = pdfBytes(data)
    const { outcome } = action(() => storeUploadedPdf(id, bytes, replace))
    return { ...writtenPaper(getPaperOrThrow(id)), outcome }
  }
  const paper = action(() => getPaperOrThrow(id))
  if (paper.arxiv_id) throw new AgentToolError('arXiv papers get their PDF from arXiv; send the file as "data" to override it')
  if (paper.pdf_path && !replace) throw new AgentToolError('PDF_EXISTS: This paper already has a PDF; pass replace=true to download the URL and replace it')
  action(() => updatePaperFields(id, { pdf_url: url }))
  // Without a PDF, setting pdf_url schedules url_pdf_service; with one, re-fetch from the new URL.
  if (paper.pdf_path) action(() => startPdfRefetch(id))
  return { ...writtenPaper(getPaperOrThrow(id)), queued: 'url_pdf_service' }
}

async function refreshPaperTool(args: Record<string, unknown>, ctx: AgentToolContext) {
  requirePersonal(ctx)
  const id = paperIdArg(args)
  const pdf = args.pdf === true
  const s2Refresh = args.s2 === true
  if (!pdf && !s2Refresh) throw new AgentToolError('Set "pdf" and/or "s2" to true')
  action(() => getPaperOrThrow(id))
  const queued: string[] = []
  const errors: Record<string, string> = {}
  for (const [target, start] of [['pdf', startPdfRefetch], ['s2', startS2Refresh]] as const) {
    if (target === 'pdf' ? !pdf : !s2Refresh) continue
    try {
      queued.push(start(id).service)
    } catch (error) {
      if (!(error instanceof PaperActionError)) throw error
      errors[target] = `${error.code}: ${error.message}`
    }
  }
  if (queued.length === 0) throw new AgentToolError(Object.values(errors).join('; '))
  return { paper_id: id, queued, ...(Object.keys(errors).length ? { errors } : {}), note: 'Runs in the background; check get_paper later.' }
}

const paperFieldProps = {
  title: { type: 'string' },
  authors: { type: 'array', items: { type: 'string' } },
  link: { type: 'string', description: 'Project page, blog post, or publisher URL' },
  abstract: { type: 'string' },
  year: { type: ['integer', 'null'] },
  venue: { type: 'string', description: 'e.g. "Tech report", "CVPR 2026", or the blog name' },
  kind: { type: 'string', enum: ['paper', 'article'], description: '"article" for web articles such as blog posts' },
  pdf_url: { type: 'string', description: 'http(s) URL of the PDF; Paperland downloads it' },
  published_at: { type: ['string', 'null'], description: 'When the work was first published at its source: ISO 8601 date (YYYY-MM-DD) or date-time; null clears' },
  modified_at: { type: ['string', 'null'], description: 'When the source was last updated (e.g. a blog post\'s dateModified); same format' },
  content: { type: 'string', description: 'Full text as Markdown (e.g. a blog post\'s main content, with figures uploaded via upload_image); shown as the Article view and used for Q&A' },
}
const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }

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
    description: 'Upload an image or video (PNG, JPEG, GIF, WebP, MP4, WebM) to the Paperland image host and get Markdown to embed it. After generating an image with the built-in image generation tool, pass its saved file path (under $CODEX_HOME/generated_images/) as "path". To copy media that is online (e.g. a blog\'s figures and videos), pass its "url" and Paperland downloads it. "data" (base64) is only for tiny images: upload local files such as screenshots with `curl -X POST -H "Authorization: Bearer <your token>" -H "Content-Type: image/png" --data-binary @file.png <paperland origin>/external-api/v1/images` instead. Embed the returned "markdown" exactly (videos use the same ![alt](url) syntax and play inline); never put local file paths in the answer.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of an image generated by Codex' },
        url: { type: 'string', description: 'http(s) URL of an image or video to download' },
        data: { type: 'string', description: 'Small image as base64 or a data: URL' },
        alt: { type: 'string', description: 'Short caption used as the alt text' },
      },
    },
    handler: uploadImage,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'get_skill',
    description: 'Paperland\'s step-by-step guides for agents. Without "name", list them; with a name, return its full text. Call get_skill("blog-import") before importing a blog post or other web article.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Skill name, e.g. "blog-import"' } },
    },
    handler: (args) => getSkill(args),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'add_paper',
    description: 'Add a paper to Paperland and to your library. Give an arxiv_id / corpus_id / s2_paper_id, or for work that is not on a preprint server (a project page with a PDF, a tech report, a blog post) give a title plus link, metadata, and the PDF as pdf_url (downloaded by Paperland) or pdf_data (base64). Papers already in Paperland (same id, or same link for manual papers) are returned with created=false and left unchanged.',
    inputSchema: {
      type: 'object',
      properties: {
        arxiv_id: { type: 'string' },
        corpus_id: { type: 'string' },
        s2_paper_id: { type: 'string' },
        ...paperFieldProps,
        pdf_data: { type: 'string', description: 'The PDF as base64 or a data:application/pdf;base64 URL' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Your tags, applied when the paper is created' },
      },
    },
    handler: addPaperTool,
    annotations: WRITE_ANNOTATIONS,
    write: true,
  },
  {
    name: 'update_paper',
    description: 'Edit a paper\'s metadata: title, authors (locked for arXiv papers), link, abstract, year, venue, kind, pdf_url, content. Only the given fields change; empty strings clear abstract / venue / pdf_url.',
    inputSchema: { type: 'object', properties: { paper_id: paperIdSchema, ...paperFieldProps }, required: ['paper_id'] },
    handler: updatePaperTool,
    annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
    write: true,
  },
  {
    name: 'upload_paper_pdf',
    description: 'Give a paper its PDF: "data" (base64 PDF) is stored directly; "url" is saved as the paper\'s pdf_url and downloaded by Paperland. If the paper already has a PDF, pass replace=true; parsed text and translations are then regenerated from the new file.',
    inputSchema: {
      type: 'object',
      properties: {
        paper_id: paperIdSchema,
        data: { type: 'string', description: 'The PDF as base64 or a data:application/pdf;base64 URL' },
        url: { type: 'string', description: 'http(s) URL of the PDF' },
        replace: { type: 'boolean', description: 'Replace an existing PDF' },
      },
      required: ['paper_id'],
    },
    handler: uploadPaperPdfTool,
    annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
    write: true,
  },
  {
    name: 'refresh_paper',
    description: 'Re-fetch data that changes over time: pdf=true downloads the PDF again from its source (arXiv serves the latest version); s2=true refreshes Semantic Scholar citation counts and the citation graph. Runs in the background.',
    inputSchema: {
      type: 'object',
      properties: { paper_id: paperIdSchema, pdf: { type: 'boolean' }, s2: { type: 'boolean' } },
      required: ['paper_id'],
    },
    handler: refreshPaperTool,
    annotations: WRITE_ANNOTATIONS,
    write: true,
  },
]

/** Every tool except the paper write tools — what Paperland's own agent runs may use. */
export const AGENT_NON_WRITE_TOOL_NAMES = AGENT_TOOLS.filter((t) => !t.write).map((t) => t.name)

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

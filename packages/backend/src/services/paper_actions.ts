import { and, eq, isNull } from 'drizzle-orm'
import type { CreatePaperRequest, PaperKind, UpdatePaperRequest } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import { normalizeS2Ids, S2IdError } from '../utils/s2_ids.js'
import { findOrCreateUserTag } from '../utils/user-tags.js'
import { removeDoc2xArtifacts } from './doc2x_cli.js'
import { ingestPaper, type IngestPaperResult } from './ingest_paper.js'
import { comparePdf, invalidatePdfDerived, isPdf, pdfSourceService, writePdfFile } from './pdf_store.js'
import { serviceRunner } from './service_runner.js'
import { renumberHeadings } from '../utils/markdown_headings.js'
import { addToLibrary } from './user_library.js'

// Paper actions shared by the website routes (`api/papers.ts`), the External API PATCH, and the
// MCP write tools, so every entry point applies the same validation and side effects.

type PaperRow = typeof schema.papers.$inferSelect

/** A rejected action: HTTP status + error code, rendered as `{ error: { code, message } }` or an MCP tool error. */
export class PaperActionError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

const KINDS: PaperKind[] = ['paper', 'article']

function json(value: string | null | undefined): Record<string, any> {
  if (!value) return {}
  try { return JSON.parse(value) } catch { return {} }
}

export function getPaperOrThrow(id: number): PaperRow {
  const paper = Number.isInteger(id)
    ? getDatabase().select().from(schema.papers).where(eq(schema.papers.id, id)).get()
    : undefined
  if (!paper) throw new PaperActionError(404, 'PAPER_NOT_FOUND', `Paper ${id} not found`)
  return paper
}

function invalid(message: string): never {
  throw new PaperActionError(422, 'VALIDATION_ERROR', message)
}

function checkKind(kind: unknown): PaperKind | undefined {
  if (kind === undefined) return undefined
  if (!KINDS.includes(kind as PaperKind)) invalid('kind must be "paper" or "article"')
  return kind as PaperKind
}

function checkYear(year: unknown): number | null | undefined {
  if (year === undefined) return undefined
  if (year === null || year === '') return null
  const n = typeof year === 'string' && /^\d+$/.test(year.trim()) ? Number(year) : year
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1000 || n > 9999) invalid('year must be a four-digit integer')
  return n
}

/** `''` clears; otherwise an http(s) URL. */
/** ISO 8601 date (`YYYY-MM-DD`) or date-time; null/'' clears. Stored as given. */
export function checkSourceDate(value: unknown, name: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const v = typeof value === 'string' ? value.trim() : ''
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v))
  if (!ok) throw new PaperActionError(422, 'INVALID_DATE', `${name} must be an ISO 8601 date (YYYY-MM-DD) or date-time`)
  return v
}

function checkPdfUrl(url: unknown): string | undefined {
  if (url === undefined) return undefined
  if (typeof url !== 'string') invalid('pdf_url must be a string')
  const trimmed = url.trim()
  if (!trimmed) return ''
  let parsed: URL
  try { parsed = new URL(trimmed) } catch { invalid('pdf_url must be an http(s) URL') }
  if (parsed!.protocol !== 'http:' && parsed!.protocol !== 'https:') invalid('pdf_url must be an http(s) URL')
  return trimmed
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined
  if (value !== null && typeof value !== 'string') invalid(`${name} must be a string`)
  return (value ?? '') as string
}

function authorList(authors: unknown): string[] | undefined {
  if (authors === undefined) return undefined
  if (Array.isArray(authors)) return authors.map((a) => String(a).trim()).filter(Boolean)
  if (typeof authors === 'string') return authors.split(',').map((a) => a.trim()).filter(Boolean)
  invalid('authors must be a list of names')
}

/** Apply metadata edits (PATCH /api/papers/:id, External API PATCH, MCP `update_paper`). */
export function updatePaperFields(id: number, body: UpdatePaperRequest): PaperRow {
  const db = getDatabase()
  const paper = getPaperOrThrow(id)
  const { title, link, content, listed } = body
  const authors = authorList(body.authors)
  const abstract = optionalString(body.abstract, 'abstract')
  const venue = optionalString(body.venue, 'venue')
  const kind = checkKind(body.kind)
  const year = checkYear(body.year)
  const pdfUrl = checkPdfUrl(body.pdf_url)
  const publishedAt = checkSourceDate(body.published_at, 'published_at')
  const modifiedAt = checkSourceDate(body.modified_at, 'modified_at')

  // arXiv papers: title/authors come from arXiv
  if (paper.arxiv_id && (title !== undefined || authors !== undefined)) {
    throw new PaperActionError(400, 'ARXIV_LOCKED', 'Cannot modify title or authors for arXiv papers')
  }

  const updates: Record<string, any> = {}
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) invalid('title must be a non-empty string')
    updates.title = title.trim()
  }
  if (authors !== undefined) updates.authors = JSON.stringify(authors)
  if (link !== undefined) updates.link = link || null
  if (abstract !== undefined) updates.abstract = abstract.trim() || null
  if (kind !== undefined) updates.kind = kind

  // Handle content → contents.user_input. Articles (blog posts) get their headings renumbered
  // from level 1 (also when a paper becomes an article).
  const article = (kind ?? paper.kind) === 'article'
  const becameArticle = kind === 'article' && paper.kind !== 'article'
  if (content !== undefined || becameArticle) {
    const existing = json(paper.contents)
    const text = content !== undefined ? content : existing.user_input
    existing.user_input = !text ? null : article ? renumberHeadings(text) : text
    if (content !== undefined || existing.user_input !== json(paper.contents).user_input) updates.contents = JSON.stringify(existing)
  }

  if (year !== undefined || venue !== undefined || pdfUrl !== undefined || publishedAt !== undefined || modifiedAt !== undefined) {
    const meta = json(paper.metadata)
    if (publishedAt !== undefined) { if (publishedAt === null) delete meta.published_at; else meta.published_at = publishedAt }
    if (modifiedAt !== undefined) { if (modifiedAt === null) delete meta.modified_at; else meta.modified_at = modifiedAt }
    if (year !== undefined) { if (year === null) delete meta.year; else meta.year = year }
    if (venue !== undefined) { if (venue.trim()) meta.venue = venue.trim(); else delete meta.venue }
    if (pdfUrl !== undefined) { if (pdfUrl) meta.pdf_url = pdfUrl; else delete meta.pdf_url }
    updates.metadata = JSON.stringify(meta)
  }

  // Promote/demote visibility (加入列表 = listed:true)
  if (listed !== undefined) updates.listed = listed ? 1 : 0

  if (Object.keys(updates).length === 0) return paper

  updates.updated_at = new Date().toISOString()
  db.update(schema.papers).set(updates).where(eq(schema.papers.id, id)).run()
  const updated = getPaperOrThrow(id)

  // Promotion to listed → run the previously-deferred full pipeline; a new PDF URL on a paper
  // without a PDF → url_pdf_service.
  const promoted = listed === true && paper.listed === 0
  const newPdfUrl = !!pdfUrl && !updated.pdf_path && !updated.arxiv_id && updated.listed === 1
  if (promoted || newPdfUrl) serviceRunner.triggerForPaper(id).catch(() => {})
  return updated
}

/** Create (or find) a paper and put it in the user's library (POST /api/papers, MCP `add_paper`). */
export async function createPaperForUser(userId: number, body: CreatePaperRequest): Promise<IngestPaperResult> {
  const { arxiv_id, link, tags: tagNames } = body
  let s2Ids
  try {
    // corpus_id / s2_paper_id accept ids, `CorpusId:<n>`, or semanticscholar.org URLs.
    s2Ids = normalizeS2Ids(body)
  } catch (e) {
    if (e instanceof S2IdError) invalid(e.message)
    throw e
  }
  const { corpus_id, s2_paper_id } = s2Ids
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!arxiv_id && !corpus_id && !s2_paper_id && !title) {
    invalid('Must provide arxiv_id, corpus_id, s2_paper_id, or title')
  }
  const kind = checkKind(body.kind)
  const content = kind === 'article' && body.content ? renumberHeadings(body.content) : body.content
  const year = checkYear(body.year)
  const pdfUrl = checkPdfUrl(body.pdf_url)
  const abstract = optionalString(body.abstract, 'abstract')?.trim() || null
  const venue = optionalString(body.venue, 'venue')?.trim() || null
  const metadata: Record<string, any> = {}
  if (year != null) metadata.year = year
  if (venue) metadata.venue = venue
  if (pdfUrl) metadata.pdf_url = pdfUrl
  const publishedAt = checkSourceDate(body.published_at, 'published_at')
  const modifiedAt = checkSourceDate(body.modified_at, 'modified_at')
  if (publishedAt) metadata.published_at = publishedAt
  if (modifiedAt) metadata.modified_at = modifiedAt

  const result = await ingestPaper({
    arxiv_id, corpus_id, s2_paper_id, title: title || null, authors: authorList(body.authors) ?? null,
    link, content, abstract, kind, metadata: Object.keys(metadata).length ? metadata : null,
  })
  // Adding a paper (new or already in the site-wide list) puts it in the caller's library.
  addToLibrary(userId, result.paper.id)

  // Per-user tags are attached only when this call created the paper.
  if (result.created && tagNames && tagNames.length > 0) {
    const db = getDatabase()
    for (const tagName of tagNames) {
      const tag = findOrCreateUserTag(db, userId, tagName)
      db.insert(schema.paperTags).values({ paper_id: result.paper.id, tag_id: tag.id }).run()
    }
  }
  return result
}

function pdfUploadMaxBytes(): number {
  let mb = 100
  try { mb = getConfig().pdf_upload.max_file_size_mb } catch {}
  return mb * 1024 * 1024
}

export type PdfUploadOutcome = 'set' | 'updated' | 'unchanged'

/**
 * Store a user-supplied PDF (POST /api/papers/:id/pdf, MCP `add_paper`/`upload_paper_pdf`).
 * Without `replace` the paper must not have a PDF yet; with it, identical bytes change nothing and
 * different bytes switch `pdf_path` and drop the data derived from the old file.
 */
export function storeUploadedPdf(id: number, body: Uint8Array, replace = false): { paper: PaperRow; outcome: PdfUploadOutcome } {
  const db = getDatabase()
  const paper = getPaperOrThrow(id)
  if (paper.pdf_path && !replace) throw new PaperActionError(409, 'PDF_EXISTS', 'This paper already has a PDF')
  if (body.length > pdfUploadMaxBytes()) {
    throw new PaperActionError(413, 'PDF_TOO_LARGE', `PDF exceeds pdf_upload.max_file_size_mb (${pdfUploadMaxBytes() / 1024 / 1024} MB)`)
  }
  if (!isPdf(body)) throw new PaperActionError(422, 'INVALID_PDF', 'The uploaded file is not a PDF')

  const now = new Date().toISOString()
  const newPath = writePdfFile(`upload_${id}`, body)
  const meta = json(paper.metadata)
  meta.pdf_fetched_at = now

  if (!paper.pdf_path) {
    // Conditional write guards against a concurrent upload / service download.
    const changed = db.update(schema.papers).set({ pdf_path: newPath, metadata: JSON.stringify(meta), updated_at: now })
      .where(and(eq(schema.papers.id, id), isNull(schema.papers.pdf_path))).run().changes
    if (changed === 0) throw new PaperActionError(409, 'PDF_EXISTS', 'This paper already has a PDF')
    // pdf_path now exists → pdf_parse / doc2x get scheduled; PDF download services are skipped.
    serviceRunner.triggerForPaper(id).catch((err) => console.error(`Failed to trigger services after PDF upload for paper ${id}:`, err))
    return { paper: getPaperOrThrow(id), outcome: 'set' }
  }

  if (comparePdf(paper.pdf_path, newPath) === 'unchanged') {
    db.update(schema.papers).set({ metadata: JSON.stringify(meta) }).where(eq(schema.papers.id, id)).run()
    return { paper: getPaperOrThrow(id), outcome: 'unchanged' }
  }

  const contents = json(paper.contents)
  invalidatePdfDerived(meta, contents, now)
  db.update(schema.papers)
    .set({ pdf_path: newPath, metadata: JSON.stringify(meta), contents: JSON.stringify(contents), updated_at: now })
    .where(eq(schema.papers.id, id)).run()
  removeDoc2xArtifacts(id)
  serviceRunner.triggerForPaper(id).catch(() => {})
  return { paper: getPaperOrThrow(id), outcome: 'updated' }
}

/** Manual PDF re-fetch: run the paper's PDF source service again (POST /api/papers/:id/pdf/refetch). */
export function startPdfRefetch(id: number): { service: string } {
  const paper = getPaperOrThrow(id)
  if (paper.listed === 0) throw new PaperActionError(422, 'NOT_LISTED', 'Add the paper to the library before fetching its PDF')
  const service = pdfSourceService(paper)
  if (!service) throw new PaperActionError(422, 'NO_PDF_SOURCE', 'This paper has no PDF source (arXiv id or PDF URL)')
  if (serviceRunner.isServiceActive(service, id)) throw new PaperActionError(409, 'REFRESH_IN_PROGRESS', 'The PDF is already being fetched')
  serviceRunner.executeServiceForPaper(service, id).catch(() => {})
  return { service }
}

/** Manual Semantic Scholar refresh (POST /api/papers/:id/s2/refresh). */
export function startS2Refresh(id: number): { service: string } {
  const paper = getPaperOrThrow(id)
  const service = 'semantic_scholar_service'
  if (!paper.arxiv_id && !paper.corpus_id && !paper.s2_paper_id) {
    throw new PaperActionError(422, 'NO_S2_ID', 'This paper has no arXiv or Semantic Scholar id')
  }
  if (serviceRunner.isServiceActive(service, id)) throw new PaperActionError(409, 'REFRESH_IN_PROGRESS', 'Semantic Scholar data is already being fetched')
  serviceRunner.executeServiceForPaper(service, id).catch(() => {})
  return { service }
}

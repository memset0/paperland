import type { FastifyInstance } from 'fastify'
import { eq, and, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { requireUser } from '../auth/guards.js'
import { getConfig } from '../config.js'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 1000

// Normalize an optional title: undefined/null/empty all collapse to null (no title).
// Returns { ok, value } so callers can distinguish "too long" (invalid) from "absent".
function normalizeOptionalTitle(raw: unknown): { ok: boolean; value: string | null } {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, value: null }
  const t = raw.trim()
  if (t.length === 0) return { ok: true, value: null }
  if (t.length > TITLE_MAX) return { ok: false, value: null }
  return { ok: true, value: t }
}

function safeCodePoint(n: number): string {
  try { return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '' } catch { return '' }
}

// Decode numeric (&#NNN; / &#xHHH;) plus the common named HTML entities. `&amp;` is decoded
// last so an already-escaped `&amp;lt;` doesn't double-decode.
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
}

function cleanText(s: string): string {
  return decodeEntities(s).replace(/\s+/g, ' ').trim()
}

// Read a <meta>'s content for property|name=key, tolerating either attribute order.
function metaContent(html: string, key: string): string | null {
  const k = key.replace(/:/g, '\\$&')
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*?content=["']([^"']*)["']`, 'i'))
  if (a) return a[1]
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${k}["']`, 'i'))
  return b ? b[1] : null
}

// Best page title: first non-empty of <title>, og:title, twitter:title. Null when none.
function extractTitle(html: string): string | null {
  const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const fromTitle = tm ? cleanText(tm[1]) : ''
  if (fromTitle) return fromTitle
  for (const key of ['og:title', 'twitter:title']) {
    const c = metaContent(html, key)
    if (c) { const t = cleanText(c); if (t) return t }
  }
  return null
}

// A TextDecoder for the page's declared charset, falling back to utf-8 on unknown labels.
function decoderFor(label: string | undefined): TextDecoder {
  const l = (label || 'utf-8').toLowerCase().replace(/^utf8$/, 'utf-8')
  try { return new TextDecoder(l) } catch { return new TextDecoder('utf-8') }
}

// Crawl a url server-side and pull out its page title (<title>, else og:/twitter:title).
// Never throws: on timeout, non-2xx, network error, or no title, `title` is null. `reachable`
// reflects a 2xx response. Buffers at most `max_bytes`, stopping once the <head> is complete,
// then decodes using the page's declared charset (handles GBK/Big5 etc. Chinese sites).
async function fetchPageTitle(url: string): Promise<{ title: string | null; hostname: string; reachable: boolean }> {
  let hostname = ''
  try { hostname = new URL(url).hostname } catch { /* validated upstream; keep '' */ }

  const cfg = getConfig().reference_links
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(cfg.fetch_timeout_ms),
      redirect: 'follow',
      headers: {
        'user-agent': cfg.user_agent,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      },
    })
    if (!res.ok || !res.body) return { title: null, hostname, reachable: res.ok }

    // Buffer raw bytes up to max_bytes, stopping once </head> is seen (title + meta live there).
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    let asciiScan = ''
    while (received < cfg.max_bytes) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      received += value.byteLength
      asciiScan += new TextDecoder('latin1').decode(value) // cheap ascii view to find </head> + charset
      if (/<\/head>/i.test(asciiScan)) break
    }
    try { await reader.cancel() } catch { /* best-effort */ }

    const bytes = new Uint8Array(received)
    let off = 0
    for (const c of chunks) { bytes.set(c, off); off += c.byteLength }

    // Charset from Content-Type header, else a <meta charset> in the head, else utf-8.
    const ctCharset = (res.headers.get('content-type') || '').match(/charset=["']?([\w-]+)/i)?.[1]
    const metaCharset = asciiScan.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
    const html = decoderFor(ctCharset || metaCharset).decode(bytes)

    return { title: extractTitle(html), hostname, reachable: true }
  } catch {
    return { title: null, hostname, reachable: false }
  }
}

// Validate/normalize a url: must be a syntactically valid absolute http(s) URL.
// Returns the trimmed value, or null if invalid.
function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const u = raw.trim()
  if (u.length === 0) return null
  let parsed: URL
  try {
    parsed = new URL(u)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return u
}

// Normalize an optional description: undefined/null/empty all collapse to null.
// Returns { ok, value } so callers can distinguish "too long" (invalid) from "absent".
function normalizeDescription(raw: unknown): { ok: boolean; value: string | null } {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, value: null }
  const d = raw.trim()
  if (d.length === 0) return { ok: true, value: null }
  if (d.length > DESCRIPTION_MAX) return { ok: false, value: null }
  return { ok: true, value: d }
}

export async function referenceLinksRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/papers/:id/reference-links — owner-scoped; anonymous gets an empty list (HTTP 200).
  // Ordered oldest-first (insertion order), id as tiebreaker.
  app.get<{ Params: { id: string } }>('/api/papers/:id/reference-links', async (request) => {
    const paperId = parseInt(request.params.id, 10)
    const userId = request.user?.id
    if (userId == null) return { data: [] }

    const db = getDatabase()
    const data = db.select().from(schema.paperReferenceLinks)
      .where(and(
        eq(schema.paperReferenceLinks.paper_id, paperId),
        eq(schema.paperReferenceLinks.user_id, userId),
      ))
      .orderBy(asc(schema.paperReferenceLinks.created_at), asc(schema.paperReferenceLinks.id))
      .all()
    return { data }
  })

  // GET /api/reference-links/preview?url=… — crawl the page and derive a description.
  // Authenticated only (keeps the crawler from being an open fetch proxy). Returns the page
  // title, the hostname, and `description = "${title} (${hostname})"`. A failed crawl is NOT
  // a client error: respond 200 with a null title/description so the link still saves on the
  // url alone. (Static `preview` segment is matched before `:id`, and only on GET — no clash
  // with PATCH/DELETE /api/reference-links/:id.)
  app.get<{ Querystring: { url?: string } }>(
    '/api/reference-links/preview', { preHandler: requireUser }, async (request, reply) => {
      // requireUser already sent a 401 for an anonymous request, but (unlike for POST) the
      // GET lifecycle doesn't halt in this runtime — return the already-sent reply so we don't
      // crawl on behalf of an unauthenticated caller or attempt a second send.
      if (!request.user) return reply
      const url = normalizeUrl(request.query?.url)
      if (!url) return reply.code(400).send({ error: { message: 'A valid http(s) url is required' } })

      const { title, hostname, reachable } = await fetchPageTitle(url)
      const description = title
        ? `${title} (${hostname})`
        : (reachable && hostname ? hostname : null)
      return { data: { title, hostname, description } }
    },
  )

  // POST /api/papers/:id/reference-links — create a link for the current user.
  // Only `url` is required; `title` is optional and `description` is normally the
  // auto-derived preview string (the frontend sends it; we just validate length).
  app.post<{ Params: { id: string }; Body: { title?: string | null; url?: string; description?: string | null } }>(
    '/api/papers/:id/reference-links', { preHandler: requireUser }, async (request, reply) => {
      const paperId = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const { title: rawTitle, url: rawUrl, description: rawDesc } = request.body || {}

      const url = normalizeUrl(rawUrl)
      if (!url) return reply.code(400).send({ error: { message: 'A valid http(s) url is required' } })
      const title = normalizeOptionalTitle(rawTitle)
      if (!title.ok) return reply.code(400).send({ error: { message: 'Title is too long' } })
      const desc = normalizeDescription(rawDesc)
      if (!desc.ok) return reply.code(400).send({ error: { message: 'Description is too long' } })

      const db = getDatabase()
      const now = new Date().toISOString()
      const created = db.insert(schema.paperReferenceLinks).values({
        user_id: userId, paper_id: paperId, title: title.value, url, description: desc.value, created_at: now, updated_at: now,
      }).returning().get()
      return reply.code(201).send({ data: created })
    },
  )

  // PATCH /api/reference-links/:id — update provided fields; 404 if not owner.
  app.patch<{ Params: { id: string }; Body: { title?: string | null; url?: string; description?: string | null } }>(
    '/api/reference-links/:id', { preHandler: requireUser }, async (request, reply) => {
      const id = parseInt(request.params.id, 10)
      const userId = request.user!.id
      const db = getDatabase()

      const existing = db.select().from(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).get()
      if (!existing || existing.user_id !== userId) {
        return reply.code(404).send({ error: { message: 'Reference link not found' } })
      }

      const { title: rawTitle, url: rawUrl, description: rawDesc } = request.body || {}
      const updates: Record<string, unknown> = {}
      if (rawTitle !== undefined) {
        const title = normalizeOptionalTitle(rawTitle)
        if (!title.ok) return reply.code(400).send({ error: { message: 'Title is too long' } })
        updates.title = title.value // may be null (clearing the title)
      }
      if (rawUrl !== undefined) {
        const url = normalizeUrl(rawUrl)
        if (!url) return reply.code(400).send({ error: { message: 'A valid http(s) url is required' } })
        updates.url = url
      }
      if (rawDesc !== undefined) {
        const desc = normalizeDescription(rawDesc)
        if (!desc.ok) return reply.code(400).send({ error: { message: 'Description is too long' } })
        updates.description = desc.value
      }
      if (Object.keys(updates).length === 0) return { data: existing }

      updates.updated_at = new Date().toISOString()
      db.update(schema.paperReferenceLinks).set(updates).where(eq(schema.paperReferenceLinks.id, id)).run()
      return { data: db.select().from(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).get() }
    },
  )

  // DELETE /api/reference-links/:id — delete; 404 if not owner.
  app.delete<{ Params: { id: string } }>('/api/reference-links/:id', { preHandler: requireUser }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const userId = request.user!.id
    const db = getDatabase()

    const existing = db.select().from(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).get()
    if (!existing || existing.user_id !== userId) {
      return reply.code(404).send({ error: { message: 'Reference link not found' } })
    }

    db.delete(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.id, id)).run()
    return { success: true }
  })
}

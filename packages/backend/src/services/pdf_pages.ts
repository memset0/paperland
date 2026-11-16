import { realpathSync, existsSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { localProcess } from './local_process.js'
import { Semaphore } from './semaphore.js'
import { AgentRichResult } from './agent_result.js'
import { TopicError } from './topic_format.js'

const region = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict().refine((r) => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001, 'Rectangle must fit inside the page')
const inputSchema = z.object({ paper_id: z.number().int().positive(), page: z.number().int().positive(), image: z.boolean().default(false), region: region.optional(), offset: z.number().int().nonnegative().default(0), max_chars: z.number().int().positive().optional() }).strict()
let limiter: Semaphore | undefined, limiterSize = 0, testDataRoot: string | undefined
export function setPdfPageDataRootForTesting(root?: string): void { testDataRoot = root; limiter = undefined; textCache.clear() }

/** Confined real path of a paper's local PDF, or a 404 TopicError. */
function localPdfPath(paperId: number): string {
  const paper = getDatabase().select({ pdf_path: schema.papers.pdf_path }).from(schema.papers).where(eq(schema.papers.id, paperId)).get()
  if (!paper?.pdf_path) throw new TopicError(404, `Paper ${paperId} has no local PDF`)
  try {
    const root = realpathSync(testDataRoot ?? resolve(process.cwd(), 'data'))
    const path = realpathSync(resolve(process.cwd(), paper.pdf_path))
    if (!path.startsWith(root + sep) || !path.toLowerCase().endsWith('.pdf') || !existsSync(path)) throw new Error('outside PDF storage')
    return path
  } catch { throw new TopicError(404, 'The local PDF is unavailable') }
}

function pdfLimiter(): Semaphore {
  const config = getConfig().pdf_pages
  if (!limiter || limiterSize !== config.max_concurrency) { limiter = new Semaphore(config.max_concurrency); limiterSize = config.max_concurrency }
  return limiter
}

// Whole-document rough text for read_paper's fallback; keyed by PDF path + mtime so a replaced PDF re-extracts.
const TEXT_CACHE_SIZE = 8
const textCache = new Map<string, string>()

/**
 * Rough text of a paper's whole local PDF (pdftotext -layout), under the same confinement, concurrency,
 * timeout and output cap as `readPdfPage`. Throws TopicError when the PDF is missing or extraction fails.
 */
export async function readPdfText(paperId: number): Promise<string> {
  const path = localPdfPath(paperId), config = getConfig().pdf_pages
  const key = `${paperId}:${path}:${statSync(path).mtimeMs}`
  const cached = textCache.get(key)
  if (cached !== undefined) { textCache.delete(key); textCache.set(key, cached); return cached }
  const semaphore = pdfLimiter()
  await semaphore.acquire(AbortSignal.timeout(config.timeout_ms))
  let text: string
  try {
    text = (await localProcess(config.pdftotext_path, ['-layout', '-enc', 'UTF-8', path, '-'], { timeout_ms: config.timeout_ms, max_bytes: config.max_image_bytes }))
      .output.toString('utf8').replace(/\f/g, '\n\n').replace(/\n{4,}/g, '\n\n\n').trim()
  } catch {
    throw new TopicError(422, 'Local PDF text extraction failed or exceeded its limits')
  } finally { semaphore.release() }
  if (!text) throw new TopicError(422, 'The PDF has no extractable text')
  for (const k of textCache.keys()) if (k.startsWith(`${paperId}:`)) textCache.delete(k)
  textCache.set(key, text)
  while (textCache.size > TEXT_CACHE_SIZE) textCache.delete(textCache.keys().next().value!)
  return text
}

export async function readPdfPage(raw: Record<string, unknown>): Promise<unknown> {
  const input = inputSchema.parse(raw), config = getConfig().pdf_pages
  const path = localPdfPath(input.paper_id)
  const semaphore = pdfLimiter()
  await semaphore.acquire(AbortSignal.timeout(config.timeout_ms))
  try {
    const run = (command: string, args: string[], maxBytes = config.max_image_bytes) => localProcess(command, args, { timeout_ms: config.timeout_ms, max_bytes: maxBytes })
    const info = (await run(config.pdfinfo_path, [path], 65536)).output.toString('utf8')
    const count = info.match(/^Pages:\s+(\d+)\s*$/m)
    if (!count) throw new TopicError(422, 'PDF page information is unavailable')
    const pageCount = Number(count[1])
    if (input.page > pageCount) throw new TopicError(422, `Page must be between 1 and ${pageCount}`)
    const text = (await run(config.pdftotext_path, ['-f', String(input.page), '-l', String(input.page), '-layout', '-enc', 'UTF-8', path, '-'])).output.toString('utf8').replace(/\f+\s*$/, '')
    if (input.offset > text.length) throw new TopicError(422, 'Offset exceeds this page text')
    const cap = getConfig().agent_tools.read_max_chars
    const end = Math.min(text.length, input.offset + Math.min(input.max_chars ?? cap, cap))
    let url = `paperland://paper/${input.paper_id}?pdf=${input.page}`
    if (input.region) { const r = input.region; url += `&rx=${r.x}&ry=${r.y}&rw=${r.width}&rh=${r.height}` }
    const metadata = { paper_id: input.paper_id, page: input.page, page_count: pageCount, page_numbering: 'physical_pdf_1_based', text: text.slice(input.offset, end), offset: input.offset, total_chars: text.length, next_offset: end < text.length ? end : null, link: url, markdown: `[${input.region ? 'PDF region' : 'PDF page'} ${input.page}](${url})` }
    if (!input.image) return metadata
    const png = (await run(config.pdftoppm_path, ['-f', String(input.page), '-l', String(input.page), '-singlefile', '-scale-to', String(config.max_dimension), '-png', path])).output
    if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || png.readUInt32BE(16) > config.max_dimension || png.readUInt32BE(20) > config.max_dimension) throw new TopicError(422, 'PDF renderer did not produce a bounded PNG image')
    return new AgentRichResult({ ...metadata, width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, [{ type: 'image', mimeType: 'image/png', data: png.toString('base64') }])
  } catch (error) {
    if (error instanceof TopicError || error instanceof z.ZodError) throw error
    // Renderer stderr can contain server paths; return a safe dependency/limit message.
    throw new TopicError(422, 'Local PDF processing failed or exceeded its limits. Check the PDF and configured Poppler executables.')
  } finally { semaphore.release() }
}

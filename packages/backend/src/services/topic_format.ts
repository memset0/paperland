import { z } from 'zod'
import type { TopicDirectory, TopicSnapshot } from '@paperland/shared'
import { parseS2Input } from '../utils/s2_ids.js'
import { parseTopicDocument } from './topic_documents.js'
import { isTopicPage, MAX_TOPIC_PAGES, MAX_TOPIC_FILES, requireSafeTopicPath, topicHomePath } from './topic_paths.js'
import { TopicError } from './topic_error.js'
export { TopicError } from './topic_error.js'

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, 'Use a stable alphanumeric ID (up to 64 characters)')
const title = z.string().trim().min(1).max(500)
const manifest = z.object({ format_version: z.union([z.literal(1), z.literal(2)]), title, description: z.string().max(10000).default('') }).strict()
const directory = z.object({ id, name: title, parent_id: id.nullable().default(null), description: z.string().max(100000).optional() }).strict()
const citation = z.object({ title: z.string().min(1).max(10000), author: z.array(z.string().max(1000)).max(200).optional(), year: z.number().int().min(1000).max(9999).optional(), month: z.string().max(100).optional(), howpublished: z.string().max(10000).optional(), note: z.string().max(100000).optional() }).strict()
const paper = z.object({
  id, title, paper_id: z.number().int().positive().optional(), s2_id: z.string().max(1000).optional(),
  reference_number: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  directory_ids: z.array(id).max(100).default([]), comment: z.string().max(100000).default(''),
  authors: z.array(z.string().max(500)).max(200).optional(), year: z.number().int().min(1000).max(9999).optional(),
  url: z.string().url().max(10000).refine((url) => /^https?:$/.test(new URL(url).protocol), 'Reference URL must use HTTP or HTTPS').optional(),
  citation: citation.optional(), verification: z.enum(['verified', 'unverified']).optional(),
}).strict()
const list = z.object({
  format_version: z.literal(1), directories: z.array(directory).max(1000).default([]), papers: z.array(paper).max(5000),
}).strict()
const reference = paper.omit({ directory_ids: true }).extend({ reference_number: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict()
const references = z.object({ format_version: z.literal(1), references: z.array(reference).max(5000) }).strict()

function decode(raw: string | Uint8Array, file: string, maxBytes: number): string {
  try {
    const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw
    if (bytes.byteLength > maxBytes) throw new Error(`exceeds ${maxBytes} bytes`)
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (value.includes('\0')) throw new Error('contains binary data')
    return value
  } catch (error) { throw new TopicError(422, `${file}: ${(error as Error).message}`) }
}

export function topicAncestors(nodeId: string, directories: TopicDirectory[]): string[] {
  const byId = new Map(directories.map((d) => [d.id, d]))
  const chain = ['root']
  let next: string | null = nodeId === 'root' ? null : nodeId
  while (next != null) {
    if (chain.includes(next)) throw new TopicError(422, 'Directory cycle or reserved root ID')
    const current = byId.get(next)
    if (!current) throw new TopicError(422, `Unknown directory: ${next}`)
    chain.push(next)
    if (chain.length > 64) throw new TopicError(422, 'Directory nesting exceeds 63 levels')
    next = current.parent_id
  }
  return chain
}

/** Pure, offline format validation shared by Git publication and local fixture tests. */
export function parseTopicFiles(files: Record<string, string | Uint8Array>, maxBytes = 2 * 1024 * 1024): TopicSnapshot {
  if (Object.keys(files).length > MAX_TOPIC_FILES) throw new TopicError(422, 'Too many Topic files')
  if (Object.keys(files).filter(isTopicPage).length > MAX_TOPIC_PAGES) throw new TopicError(422, 'Too many Topic pages')
  let totalBytes = 0
  for (const name of Object.keys(files)) {
    requireSafeTopicPath(name)
    const raw = files[name]
    totalBytes += typeof raw === 'string' ? Buffer.byteLength(raw) : raw.byteLength
    if (totalBytes > maxBytes * 8) throw new TopicError(422, 'Topic text bytes exceed the aggregate limit')
    if (typeof raw === 'string' ? Buffer.byteLength(raw) > maxBytes : raw.byteLength > maxBytes) throw new TopicError(422, `${name} exceeds ${maxBytes} bytes`)
  }
  for (const name of ['topic.json']) {
    if (files[name] === undefined) throw new TopicError(422, `Missing required file: ${name}`)
  }
  let result: TopicSnapshot
  try {
    const metadata = manifest.parse(JSON.parse(decode(files['topic.json'], 'topic.json', maxBytes)))
    const home = topicHomePath(metadata.format_version)
    const catalog = metadata.format_version === 2 ? 'references.json' : 'papers.json'
    if (files[home] === undefined) throw new TopicError(422, `Missing required file: ${home}`)
    if (files[catalog] === undefined) throw new TopicError(422, `Missing required file: ${catalog}`)
    result = {
      topic: metadata,
      report: decode(files[home], home, maxBytes),
      list: metadata.format_version === 2
        ? { format_version: 1, directories: [], papers: references.parse(JSON.parse(decode(files[catalog], catalog, maxBytes))).references.map((p) => ({ ...p, directory_ids: [] })) }
        : list.parse(JSON.parse(decode(files[catalog], catalog, maxBytes))),
      ...(Object.keys(files).some((p) => isTopicPage(p) && p !== home) ? { pages: Object.fromEntries(Object.entries(files).filter(([p]) => isTopicPage(p) && p !== home).map(([p, text]) => [p, decode(text, p, maxBytes)])) } : {}),
      ...(files['AGENTS.md'] === undefined ? {} : { agent_instructions: decode(files['AGENTS.md'], 'AGENTS.md', maxBytes) }),
    }
  } catch (error) {
    if (error instanceof TopicError) throw error
    throw new TopicError(422, `Invalid Topic format: ${(error as Error).message}`)
  }
  const dirs = result.list.directories
  for (const [path, text] of Object.entries({ [topicHomePath(result.topic.format_version)]: result.report, ...result.pages })) parseTopicDocument(text, path)
  if (new Set(dirs.map((d) => d.id)).size !== dirs.length || dirs.some((d) => d.id === 'root')) {
    throw new TopicError(422, 'Duplicate directory ID or reserved root ID')
  }
  for (const d of dirs) topicAncestors(d.id, dirs)
  const seen = new Set<string>()
  const referenceNumbers = new Set<number>()
  for (const entry of result.list.papers) {
    if (seen.has(entry.id)) throw new TopicError(422, `Duplicate paper entry ID: ${entry.id}`)
    seen.add(entry.id)
    if (entry.reference_number !== undefined) {
      if (referenceNumbers.has(entry.reference_number)) throw new TopicError(422, `Duplicate reference number: ${entry.reference_number}`)
      referenceNumbers.add(entry.reference_number)
    }
    if ([entry.paper_id, entry.s2_id, entry.url].filter((v) => v !== undefined).length !== 1) throw new TopicError(422, `Entry ${entry.id} needs exactly one of paper_id, s2_id or url`)
    if (entry.url && !entry.citation) throw new TopicError(422, `Reference ${entry.id} needs citation metadata`)
    if (new Set(entry.directory_ids).size !== entry.directory_ids.length) throw new TopicError(422, `Duplicate directory assignment: ${entry.id}`)
    for (const nodeId of entry.directory_ids) topicAncestors(nodeId, dirs)
    if (entry.s2_id !== undefined) {
      let parsed: ReturnType<typeof parseS2Input>
      try { parsed = parseS2Input(entry.s2_id) } catch { parsed = null }
      if (!parsed) throw new TopicError(422, `Invalid Semantic Scholar ID in entry ${entry.id}`)
      entry.s2_id = parsed.s2_paper_id ?? `CorpusId:${parsed.corpus_id}`
    }
  }
  return result
}

export function topicFiles(snapshot: TopicSnapshot): Record<string, string> {
  const catalog = snapshot.topic.format_version === 2 ? 'references.json' : 'papers.json'
  const value = snapshot.topic.format_version === 2 ? { format_version: 1, references: snapshot.list.papers.map(({ directory_ids, ...entry }) => entry) } : snapshot.list
  return { 'topic.json': JSON.stringify(snapshot.topic, null, 2) + '\n', [topicHomePath(snapshot.topic.format_version)]: snapshot.report, [catalog]: JSON.stringify(value, null, 2) + '\n', ...snapshot.pages, ...(snapshot.agent_instructions === undefined ? {} : { 'AGENTS.md': snapshot.agent_instructions }) }
}

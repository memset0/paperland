import { load, JSON_SCHEMA } from 'js-yaml'
import type { TopicDocument, TopicSnapshot } from '@paperland/shared'
import { TopicError } from './topic_error.js'
import { topicDocumentSlug, topicHomePath } from './topic_paths.js'
export { MAX_TOPIC_PAGES } from './topic_paths.js'

export const QUESTIONS_PATH = 'pages/research-questions/index.md'
export function parseTopicDocument(source: string, path: string): { body: string; references?: number[]; title?: string; fonticon?: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) {
    if (/^---\r?\n/.test(source)) throw new TopicError(422, `${path}: frontmatter needs a closing --- line`)
    return { body: source }
  }
  if (match[1].length > 100000) throw new TopicError(422, `${path}: frontmatter is too large`)
  try {
    const data = load(match[1], { schema: JSON_SCHEMA })
    if (data != null && (typeof data !== 'object' || Array.isArray(data))) throw new Error('frontmatter must be a mapping')
    const fields = data as { references?: unknown; title?: unknown; fonticon?: unknown } | undefined | null
    const refs = fields?.references
    if (refs !== undefined && (!Array.isArray(refs) || refs.length > 5000 || !refs.every((n) => Number.isSafeInteger(n) && n > 0) || new Set(refs).size !== refs.length)) throw new Error('references must be a list of unique positive integers')
    if (fields?.title !== undefined && (typeof fields.title !== 'string' || !fields.title.trim() || fields.title.length > 200)) throw new Error('title must contain 1 to 200 characters')
    if (fields?.fonticon !== undefined && (typeof fields.fonticon !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(fields.fonticon))) throw new Error('fonticon must be an icon name')
    return { body: source.slice(match[0].length), ...(refs === undefined ? {} : { references: refs as number[] }), ...(fields?.title === undefined ? {} : { title: (fields.title as string).trim() }), ...(fields?.fonticon === undefined ? {} : { fonticon: fields.fonticon as string }) }
  } catch (error) { throw new TopicError(422, `${path}: ${(error as Error).message}`) }
}

export function topicDocuments(snapshot: TopicSnapshot, numbers: Record<string, number>): TopicDocument[] {
  const all = Object.values(numbers).sort((a, b) => a - b)
  const allowed = new Set(all)
  const home = topicHomePath(snapshot.topic.format_version)
  const questions = snapshot.topic.format_version === 2 ? QUESTIONS_PATH : 'pages/questions.md'
  const sources = { [home]: snapshot.report, ...snapshot.pages }
  const output: TopicDocument[] = Object.entries(sources).map(([path, source]) => {
    const doc = parseTopicDocument(source, path)
    const references = (doc.references ?? (path === home ? all : [])).slice().sort((a, b) => a - b)
    for (const n of references) if (!allowed.has(n)) throw new TopicError(422, `${path}: reference ${n} is not in this version's global catalog`)
    const heading = doc.body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]
    return { path, title: doc.title || (path === questions ? heading || 'Research questions' : path === home ? 'Report' : heading || path.split('/').at(-1)!.slice(0, -3).replace(/[-_]/g, ' ')), body: doc.body, references, exists: true, fonticon: doc.fonticon || (path === home ? 'BookOpen' : path === questions ? 'CircleHelp' : 'FileText'), kind: 'page' as const }
  })
  if (!Object.hasOwn(sources, questions)) output.push({ path: questions, title: 'Research questions', body: '', references: [], exists: false, fonticon: 'CircleHelp' })
  if (snapshot.agent_instructions !== undefined) output.push({ path: 'AGENTS.md', title: 'Agent guide', body: snapshot.agent_instructions, references: [], exists: true, fonticon: 'Bot', kind: 'agent_instructions' })
  const slugs = new Set<string>()
  for (const doc of output) {
    doc.slug = topicDocumentSlug(doc.path, home)
    if (slugs.has(doc.slug)) throw new TopicError(422, `Document route is ambiguous: ${doc.slug}`)
    slugs.add(doc.slug)
  }
  return output
}

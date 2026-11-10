import { TopicError } from './topic_error.js'

export const MAX_TOPIC_PAGES = 32
export const MAX_TOPIC_FILES = 1024
export function safeTopicPath(path: string): boolean {
  return !!path && path.length <= 1024 && !/[\\\x00-\x1f\x7f]/.test(path) && path.split('/').length <= 16
    && path.split('/').every((part) => !!part && part !== '.' && part !== '..' && part.toLowerCase() !== '.git' && part.length <= 128)
}
export function isTopicPage(path: string): boolean {
  return path.startsWith('pages/') && path.endsWith('.md') && safeTopicPath(path)
    && path.split('/').slice(1).every((part) => /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(part))
}
export function topicHomePath(format: number): string { return format === 2 ? 'pages/report.md' : 'report.md' }
export function topicDocumentSlug(path: string, home: string): string {
  if (path === home) return ''
  if (path === 'AGENTS.md') return '_agent'
  const slug = path.replace(/^pages\//, '').replace(/\.md$/, '')
  return slug.endsWith('/index') ? slug.slice(0, -6) : slug
}
export function isTopicText(path: string): boolean {
  return ['topic.json', 'papers.json', 'references.json', 'report.md', 'AGENTS.md'].includes(path) || isTopicPage(path)
}
export function requireSafeTopicPath(path: string): void {
  if (!safeTopicPath(path)) throw new TopicError(422, `Unsafe repository path: ${path}`)
  if (path.startsWith('pages/') && path.endsWith('.md') && !isTopicPage(path)) throw new TopicError(422, `Invalid page path: ${path}`)
}

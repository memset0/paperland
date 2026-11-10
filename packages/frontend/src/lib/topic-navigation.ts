import type { TopicDocument } from '@paperland/shared'

export function documentSlug(path: string, home: string): string {
  if (path === home) return ''
  if (path === 'AGENTS.md') return '_agent'
  const slug = path.replace(/^pages\//, '').replace(/\.md$/, '')
  return slug.endsWith('/index') ? slug.slice(0, -6) : slug
}
export function resolveTopicDocument(documents: TopicDocument[], requested: string, home: string): TopicDocument | undefined {
  requested = requested.replace(/\/+$/, '')
  if (!requested) return documents.find((d) => d.path === home)
  if (requested.split('/').some((p) => p === '.' || p === '..') || requested.includes('\\')) return undefined
  const exact = documents.find((d) => d.path === requested || (d.slug ?? documentSlug(d.path, home)) === requested)
  if (exact) return exact
  if (requested === 'report.md' || requested === 'pages/report.md') return documents.find((d) => d.path === home)
  if (requested === 'pages/questions.md' || requested === 'questions') return documents.find((d) => d.path === 'pages/research-questions/index.md')
  if (!requested.startsWith('pages/') && requested.includes('/')) return undefined
  const basename = requested.replace(/^pages\//, '').split('/').at(-1)!.replace(/\.md$/, '')
  const matching = documents.filter((d) => d.kind !== 'agent_instructions' && d.path.split('/').at(-1)!.replace(/\.md$/, '') === basename)
  return matching.length === 1 ? matching[0] : undefined
}
export function documentUrl(topicId: number, doc: TopicDocument, home: string): string {
  const slug = doc.slug ?? documentSlug(doc.path, home)
  return `/topics/${topicId}${slug ? '/' + slug.split('/').map(encodeURIComponent).join('/') : ''}`
}
export interface TopicTreeNode { key: string; name: string; document?: TopicDocument; children: TopicTreeNode[] }
export function topicDocumentTree(documents: TopicDocument[], home: string): TopicTreeNode[] {
  const roots: TopicTreeNode[] = []
  for (const doc of documents.filter((d) => d.path !== 'AGENTS.md')) {
    const segments = doc.path.replace(/^pages\//, '').split('/')
    let nodes = roots, prefix = 'pages'
    for (const [index, name] of segments.entries()) {
      prefix += '/' + name
      const leaf = index === segments.length - 1
      let node = nodes.find((n) => n.key === prefix)
      if (!node) { node = { key: prefix, name: leaf ? doc.title : name.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()), ...(leaf ? { document: doc } : {}), children: [] }; nodes.push(node) }
      nodes = node.children
    }
  }
  function sort(nodes: TopicTreeNode[]) {
    nodes.sort((a, b) => (a.document?.path === home ? -1 : b.document?.path === home ? 1 : a.children.length && !b.children.length ? -1 : !a.children.length && b.children.length ? 1 : a.key.localeCompare(b.key, undefined, { numeric: true })))
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots); return roots
}

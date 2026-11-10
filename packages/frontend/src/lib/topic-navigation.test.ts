import { describe, test, expect } from 'bun:test'
import type { TopicDocument } from '@paperland/shared'
import { documentSlug, documentUrl, resolveTopicDocument, topicDocumentTree } from './topic-navigation'
import { topicIcon } from './topic-icons'

const doc = (path: string, title = path): TopicDocument => ({ path, title, body: '', references: [], exists: true })
describe('First-class Topic document navigation (offline)', () => {
  test('home, nested pages and folder indexes have clean paths and legacy links resolve', () => {
    const home = 'pages/report.md', docs = [doc(home, 'Overview'), doc('pages/discussions.md', 'Discussion log'), doc('pages/research-questions/index.md'), doc('pages/research-questions/rq6.md'), doc('AGENTS.md')]
    expect(documentUrl(3, docs[0], home)).toBe('/topics/3')
    expect(documentUrl(3, docs[1], home)).toBe('/topics/3/discussions')
    expect(documentSlug(docs[2].path, home)).toBe('research-questions')
    expect(resolveTopicDocument(docs, 'pages/discussions.md', home)?.title).toBe('Discussion log')
    expect(resolveTopicDocument(docs, 'discussions', home)?.path).toBe('pages/discussions.md')
    expect(resolveTopicDocument(docs, 'pages/rq6.md', home)?.path).toBe('pages/research-questions/rq6.md')
    expect(resolveTopicDocument(docs, 'pages/questions.md', home)?.path).toBe(docs[2].path)
    expect(resolveTopicDocument(docs, 'report.md', home)?.path).toBe(home)
    expect(resolveTopicDocument(docs, '../report.md', home)).toBeUndefined()
    expect(resolveTopicDocument(docs, 'workspace/rq6.md', home)).toBeUndefined()
    expect(resolveTopicDocument([...docs, doc('pages/another/rq6.md')], 'pages/rq6.md', home)).toBeUndefined()
  })
  test('folders derive from paths, main report remains first and metadata titles/icons are preserved', () => {
    const docs = [doc('pages/research-questions/rq6.md', 'RSI'), doc('pages/report.md', 'Report'), doc('pages/research-questions/deep/rq7.md', 'Prediction'), doc('AGENTS.md')]
    const tree = topicDocumentTree(docs, 'pages/report.md')
    expect(tree[0].document?.title).toBe('Report')
    expect(tree[1].name).toBe('Research questions')
    expect(tree[1].children[0].name).toBe('Deep')
    expect(tree[1].children[1].document?.title).toBe('RSI')
    expect(tree.some((n) => n.document?.path === 'AGENTS.md')).toBe(false)
    expect(topicIcon('BookOpen')).toBe(topicIcon('book-open'))
    expect(topicIcon('unknown-icon')).toBe(topicIcon('FileText'))
  })
})

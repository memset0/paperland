import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import type { TopicSnapshot } from '@paperland/shared'
import { schema } from '../db/index'
import { topicFixture } from '../testing/topic_fixture'
import { createTopic, getTopic, renameTopic } from './topics'
import { backfillTopicReferences, commitTopicFiles, readTopicCommit } from './topic_git'
import { parseTopicFiles, topicFiles } from './topic_format'
import { parseTopicDocument, topicDocuments } from './topic_documents'
import { planTopicReferences, referenceRegistry } from './topic_references'

let f: ReturnType<typeof topicFixture>
const actor = { user_id: 1, token_id: null, display_name: 'owner' }
beforeEach(() => { f = topicFixture() })
afterEach(() => f.close())
const reference = (id: string, year: number, number?: number) => ({ id, title: id, year, s2_id: `CorpusId:${id === 'a' ? 101 : id === 'b' ? 102 : 103}`, directory_ids: [], comment: '', ...(number == null ? {} : { reference_number: number }) })

describe('Topic documents and stable global references (offline)', () => {
  test('safe pages round trip, strip only frontmatter and validate number lists', () => {
    const snapshot: TopicSnapshot = { topic: { format_version: 1, title: 'Research', description: '' }, report: '# Main', pages: { 'pages/rq6.md': '---\nreferences: [2, 1]\n---\n# RSI\n\n[Other](questions.md)' }, list: { format_version: 1, directories: [], papers: [reference('a', 2025), reference('b', 2010)] } }
    const parsed = parseTopicFiles(topicFiles(snapshot))
    expect(parsed.pages).toEqual(snapshot.pages)
    expect(topicDocuments(parsed, { a: 1, b: 2 }).find((p) => p.path === 'pages/rq6.md')).toMatchObject({ title: 'RSI', references: [1, 2], body: '# RSI\n\n[Other](questions.md)' })
    expect(() => topicDocuments(parsed, { a: 1 })).toThrow('reference 2')
    for (const header of ['references: [0]', 'references: [1, 1]', 'references: ["1"]', 'references: [1.5]', 'references: [missing]']) expect(() => parseTopicDocument(`---\n${header}\n---\nBody`, 'pages/test.md')).toThrow('unique positive integers')
    expect(() => parseTopicDocument('---\nreferences: [1]', 'report.md')).toThrow('closing')
    for (const path of ['pages/../report.md', 'pages/.hidden.md']) expect(() => parseTopicFiles({ ...topicFiles(snapshot), [path]: 'x' })).toThrow()
    expect(parseTopicFiles({ ...topicFiles(snapshot), 'pages/sub/file.md': '# Nested', 'workspace/script.js': '\0' }).pages?.['pages/sub/file.md']).toBe('# Nested')
    expect(() => parseTopicFiles({ ...topicFiles(snapshot), ...Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`pages/p${i}.md`, ''])) })).toThrow('Too many')
  })
  test('numbering follows Topic appearance, reserves deletions, rejects reassignment and survives history backfill', async () => {
    const topic = await createTopic(1, { title: 'Numbered' })
    const snapshot = structuredClone(topic.snapshot)
    snapshot.list.papers = [reference('a', 2025, 1), reference('b', 2010, 2)]
    snapshot.pages!['pages/rq6.md'] = '---\nreferences: [2]\n---\n# RSI\n\nFirst report.'
    const first = await commitTopicFiles(topic.id, topic.commit, topicFiles(snapshot), actor)
    let detail = await getTopic(topic.id, 1)
    expect(detail.reference_numbers).toEqual({ a: 1, b: 2 })
    expect(detail.next_reference_number).toBe(3)
    expect(detail.documents.find((d) => d.path === 'pages/rq6.md')?.references).toEqual([2])
    snapshot.list.papers = [reference('b', 2010, 2), reference('c', 2001, 3)]
    const second = await commitTopicFiles(topic.id, first, topicFiles(snapshot), actor)
    expect((await getTopic(topic.id, 1)).reference_numbers).toEqual({ b: 2, c: 3 })
    snapshot.list.papers = [reference('c', 2001, 3), reference('a', 2025, 1), reference('b', 2010, 2)]
    await commitTopicFiles(topic.id, second, topicFiles(snapshot), actor)
    detail = await getTopic(topic.id, 1)
    expect(detail.reference_numbers).toEqual({ c: 3, a: 1, b: 2 })
    expect(detail.next_reference_number).toBe(4)
    const oldPage = await readTopicCommit(topic.id, first)
    expect(oldPage.pages!['pages/rq6.md']).toContain('First report.')
    const renamed = await renameTopic(topic.id, 1, 'Short', detail.commit)
    expect(renamed.snapshot.pages).toEqual(detail.snapshot.pages)
    const ledger = referenceRegistry(topic.id)
    f.db.delete(schema.topicReferences).where(eq(schema.topicReferences.topic_id, topic.id)).run()
    f.db.update(schema.topics).set({ references_indexed_commit: null }).where(eq(schema.topics.id, topic.id)).run()
    await backfillTopicReferences(topic.id); await backfillTopicReferences(topic.id)
    expect(referenceRegistry(topic.id)).toEqual(ledger)
    expect((await getTopic(topic.id, 1)).commit).toBe(renamed.commit)
    expect((await getTopic(topic.id, 1, first)).reference_numbers).toEqual({ a: 1, b: 2 })
    const forged = structuredClone(snapshot); forged.list.papers[1].reference_number = 8
    expect(() => planTopicReferences(topic.id, [{ commit: 'b'.repeat(40), snapshot: forged, added_at: f.now }])).toThrow('must remain 1')
    forged.list.papers[1] = { ...reference('a', 2025, 1), s2_id: 'CorpusId:999' }
    expect(() => planTopicReferences(topic.id, [{ commit: 'b'.repeat(40), snapshot: forged, added_at: f.now }])).toThrow('another source')
  })
})

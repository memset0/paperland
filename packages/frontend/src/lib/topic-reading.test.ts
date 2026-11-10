import { describe, expect, test } from 'bun:test'
import type { TopicSnapshot } from '@paperland/shared'
import { readTopicSeen, readTopicSurface, saveTopicSurface, surfaceAdditions, topicSurfaceKey, reportBlocks, topicAdditions, TopicReadingGate, topicReadingKey, type TopicSeen, type TopicSurfaceSeen } from './topic-reading'

const snapshot = (report: string, ids = ['a']): TopicSnapshot => ({ topic: { format_version: 1, title: 'Topic', description: '' }, report, list: { format_version: 1, directories: [], papers: ids.map((id) => ({ id, title: id, s2_id: 'CorpusId:1', directory_ids: [], comment: '' })) } })
const seen = (report: string, ids?: string[]): TopicSeen => ({ schema_version: 1, commit: 'a'.repeat(40), snapshot: snapshot(report, ids) })

describe('Topic last-displayed reading cache and pure additions (offline)', () => {
  test('per-document and reference baselines do not consume unseen changes in another page or drawer', () => {
    const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
    const a = topicSurfaceKey(1, 3, 'report.md', 'document'), b = topicSurfaceKey(1, 3, 'pages/rq6.md', 'document'), refs = topicSurfaceKey(1, 3, 'pages/rq6.md', 'references')
    const first: TopicSurfaceSeen = { schema_version: 2, commit: 'a'.repeat(40), body: '# RQ6\n\nOriginal.', entries: [] }
    saveTopicSurface(storage, b, first)
    const latest = { ...first, commit: 'c'.repeat(40), body: first.body + '\n\nSecond.\n\nThird.' }
    saveTopicSurface(storage, a, latest)
    expect(surfaceAdditions(readTopicSurface(storage, b), latest).report).toEqual([2, 3])
    expect(readTopicSurface(storage, refs)).toBeNull()
    expect(readTopicSurface(storage, topicSurfaceKey(2, 3, 'pages/rq6.md', 'document'))).toBeNull()
    saveTopicSurface(storage, b, latest)
    expect(surfaceAdditions(readTopicSurface(storage, b), latest).report).toEqual([])
    const list = { ...first, body: '', entries: snapshot('', ['a']).list.papers }
    saveTopicSurface(storage, refs, list)
    expect(surfaceAdditions(readTopicSurface(storage, refs), { ...list, entries: snapshot('', ['a', 'b', 'c']).list.papers }).papers).toEqual(['b', 'c'])
    expect(readTopicSurface({ getItem() { throw new Error('blocked') }, setItem() {} }, b)).toBeNull()
  })
  test('first and wholly new content do not animate', () => {
    expect(topicAdditions(null, snapshot('New', ['b']))).toEqual({ report: [], papers: [], directories: [] })
    expect(topicAdditions(seen('Old', ['a']), snapshot('New', ['b']))).toEqual({ report: [], papers: [], directories: [] })
  })
  test('compares accumulated updates against last displayed content, with simultaneous report/paper candidates', () => {
    const old = seen('# Report\n\nOriginal.')
    const additions = topicAdditions(old, snapshot('# Report\n\nOriginal.\n\nAdded in commit two.\n\nAdded in commit three.', ['a', 'b', 'c']))
    expect(additions.report).toEqual([2, 3]); expect(additions.papers).toEqual(['b', 'c'])
  })
  test('edits/deletions and stable entry moves are static while pure insertions animate', () => {
    const next = snapshot('# Report\n\nEdited.\n\nAnchor.\n\nAdded.', ['a'])
    expect(topicAdditions(seen('# Report\n\nOriginal.\n\nAnchor.\n\nRemoved.'), next).report).toEqual([])
    expect(topicAdditions(seen('# Report\n\nOriginal.\n\nAnchor.'), next).report).toEqual([3])
    expect(topicAdditions(seen('Same'), snapshot('Same')).papers).toEqual([])
  })
  test('code, tables, math and reference definitions retain full-document block alignment', () => {
    const blocks = reportBlocks('# H\n\n```ts\nconst n = 1\n```\n\n$$\nx^2\n$$\n\n[a]: /source\n\n[a]\n\n| A | B |\n| - | - |\n| 1 | 2 |')
    expect(blocks).toHaveLength(5)
    expect(blocks[1]).toContain('const n = 1'); expect(blocks[2]).toContain('x^2')
    expect(blocks).not.toContain('[a]: /source')
  })
  test('account/page isolation, historical browsing, stale requests and storage failures', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
    const gate = new TopicReadingGate(), a = topicReadingKey(1, 1), b = topicReadingKey(2, 1), c = topicReadingKey(1, 2)
    const first = gate.begin(a), newer = gate.begin(a)
    expect(gate.save(storage, first, seen('Stale'), true)).toBe(false)
    expect(gate.save(storage, newer, seen('Shown'), true)).toBe(true)
    expect(topicAdditions(readTopicSeen(storage, a), snapshot('Shown'))).toEqual({ report: [], papers: [], directories: [] })
    const history = gate.begin(a)
    expect(gate.save(storage, history, seen('History'), false)).toBe(false)
    expect(readTopicSeen(storage, a)?.snapshot.report).toBe('Shown')
    gate.begin(b)
    expect(gate.save(storage, history, seen('Wrong account'), true)).toBe(false)
    expect(readTopicSeen(storage, b)).toBeNull(); expect(readTopicSeen(storage, c)).toBeNull()
    storage.setItem(c, '{broken'); expect(readTopicSeen(storage, c)).toBeNull()
    const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } }
    expect(readTopicSeen(broken, a)).toBeNull()
    const ticket = gate.begin(a); expect(gate.save(broken, ticket, seen('Shown'), true)).toBe(false)
  })
})

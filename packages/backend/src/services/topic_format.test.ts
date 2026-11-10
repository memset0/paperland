import { describe, expect, test } from 'bun:test'
import { parseTopicFiles, topicAncestors, topicFiles } from './topic_format'

function fixture() {
  return {
    topic: { format_version: 1 as const, title: 'Attention', description: '' }, report: '# Report\n\nResearch.',
    list: { format_version: 1 as const, directories: [{ id: 'a', name: 'Methods', parent_id: null }, { id: 'b', name: 'Sparse', parent_id: 'a' }], papers: [{ id: 'paper-one', title: 'External', s2_id: 'CorpusID:123', directory_ids: ['a', 'b'], comment: '' }] },
  }
}
describe('Topic v1 repository contract (offline)', () => {
  test('preserves safe URL citation records and Markdown directory descriptions', () => {
    const value: any = fixture()
    value.list.directories[0].description = 'Original **notes**.'
    value.list.papers = [{ id: 'link', title: 'Project', url: 'https://example.test/project', citation: { title: 'Project', author: ['Author'], year: 2025, howpublished: 'Project page', note: 'Preserved' }, directory_ids: ['a'], comment: 'Comment' }]
    const parsed = parseTopicFiles(topicFiles(value))
    expect(parsed.list.papers[0].citation).toEqual(value.list.papers[0].citation)
    expect(parsed.list.directories[0].description).toBe(value.list.directories[0].description)
    value.list.papers[0].url = 'javascript:alert(1)'
    expect(() => parseTopicFiles(topicFiles(value))).toThrow()
  })
  test('round-trips nested multi-directory external entries without ingestion', () => {
    const parsed = parseTopicFiles(topicFiles(fixture()))
    expect(parsed.list.papers[0].s2_id).toBe('CorpusId:123')
    expect(topicAncestors('b', parsed.list.directories)).toEqual(['root', 'b', 'a'])
    expect(parsed.report).toBe(fixture().report)
  })
  test('accepts a site ID and preserves title and entry identity', () => {
    const value: any = fixture()
    delete value.list.papers[0].s2_id
    value.list.papers[0].paper_id = 5
    expect(parseTopicFiles(topicFiles(value)).list.papers[0]).toMatchObject({ id: 'paper-one', paper_id: 5 })
  })
  test.each(['cycle', 'missing-parent', 'duplicate', 'root'])('rejects %s directories', (kind) => {
    const value = fixture()
    if (kind === 'cycle') value.list.directories[0].parent_id = 'b' as any
    if (kind === 'missing-parent') value.list.directories[1].parent_id = 'absent'
    if (kind === 'duplicate') value.list.directories[1].id = 'a'
    if (kind === 'root') value.list.directories[1].id = 'root'
    expect(() => parseTopicFiles(topicFiles(value))).toThrow()
  })
  test('rejects malformed, ambiguous, duplicate and dangling entries', () => {
    for (const mutate of [
      (v: any) => v.list.papers.push({ ...v.list.papers[0] }),
      (v: any) => { v.list.papers[0].paper_id = 5 },
      (v: any) => { v.list.papers[0].s2_id = 'made-up' },
      (v: any) => { v.list.papers[0].directory_ids = ['absent'] },
    ]) {
      const value = fixture(); mutate(value)
      expect(() => parseTopicFiles(topicFiles(value))).toThrow()
    }
  })
  test('rejects unsafe paths, missing files, binary/invalid UTF-8, future formats and size overflow', () => {
    const files = topicFiles(fixture())
    expect(() => parseTopicFiles({ ...files, '../config.yml': 'no' })).toThrow('Unsafe')
    expect(() => parseTopicFiles({ 'topic.json': files['topic.json'] })).toThrow('Missing')
    expect(() => parseTopicFiles({ ...files, 'report.md': '\0' })).toThrow('binary')
    expect(() => parseTopicFiles({ ...files, 'report.md': new Uint8Array([0xff]) })).toThrow()
    expect(() => parseTopicFiles({ ...files, 'topic.json': '{"format_version":2}' })).toThrow()
    expect(() => parseTopicFiles(files, 3)).toThrow('bytes')
  })
})

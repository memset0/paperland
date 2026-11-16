import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { topicFixture } from '../testing/topic_fixture'
import { parseTopicFiles, topicFiles } from './topic_format'
import { topicSchemaContract, topicSchemaStatus } from './topic_schema'
import { parseTopicReports } from './topic_reports'

let f: ReturnType<typeof topicFixture>
beforeEach(() => { f = topicFixture() })
afterEach(() => f.close())
const files = () => {
  const examples = topicSchemaContract().examples
  return Object.fromEntries(Object.entries(examples).map(([name, value]) => [name, typeof value === 'string' ? value : JSON.stringify(value)]))
}
describe('Topic schema v1 and legacy compatibility (offline)', () => {
  test('the complete MCP example round trips and keeps per-page subsets and the ordered index', () => {
    const snapshot = parseTopicFiles(files())
    expect(topicSchemaStatus(snapshot)).toMatchObject({ schema_version: 1, encoding: 'schema_v1', migration_required: false })
    expect(snapshot.navigation?.reports[1].children?.[0].path).toBe('pages/research-questions/rq1.md')
    expect(parseTopicFiles(topicFiles(snapshot))).toEqual(snapshot)
    expect(JSON.parse(topicFiles(snapshot)['topic.json'])).toEqual({ schema_version: 1, title: 'Research topic', description: '' })
  })
  test('legacy markers remain separate and unsupported or ambiguous versions cannot publish', () => {
    const legacy = { 'topic.json': '{"format_version":2,"title":"Old"}', 'pages/report.md': '# Old', 'references.json': '{"format_version":1,"references":[]}' }
    expect(topicSchemaStatus(parseTopicFiles(legacy))).toMatchObject({ schema_version: null, encoding: 'legacy_format_2', migration_required: true })
    expect(() => parseTopicFiles({ ...files(), 'topic.json': '{"schema_version":2,"title":"Future"}' })).toThrow('Supported schema versions: 1')
    expect(() => parseTopicFiles({ ...files(), 'topic.json': '{"schema_version":1,"format_version":2,"title":"Ambiguous"}' })).toThrow()
    expect(() => topicSchemaContract(2)).toThrow('Supported schema versions: 1')
    expect(() => topicSchemaContract('1')).toThrow()
  })
  test('requires every page once, rejects auxiliary paths, unsafe paths, bad versions and recursive YAML', () => {
    const base = files()
    expect(() => parseTopicFiles({ ...base, 'pages/new.md': '# New' })).toThrow('missing from reports: pages/new.md')
    for (const manifest of [
      'schema_version: 2\ndefault_page: pages/report.md\nreports: []',
      'schema_version: 1\ndefault_page: README.md\nreports: []',
      'schema_version: 1\ndefault_page: pages/report.md\nreports: [{path: pages/report.md}, {path: pages/report.md}]',
      'schema_version: 1\ndefault_page: pages/report.md\nreports: [{path: AGENTS.md}]',
      'schema_version: 1\ndefault_page: pages/report.md\nreports: [{path: pages/../report.md}]',
      'schema_version: 1\ndefault_page: pages/report.md\nreports: [&loop {title: Loop, children: [*loop]}]',
      'schema_version: 1\ndefault_page: pages/report.md\nreports: [{path: pages/report.md, title: Wrong source}]',
    ]) expect(() => parseTopicFiles({ ...base, 'reports.yml': manifest })).toThrow('reports.yml')
    const nested: any = { title: 'Too deep', children: [] }; let item = nested
    for (let i = 0; i < 10; i++) { item.children = [{ title: 'Group', children: [] }]; item = item.children[0] }
    expect(() => parseTopicReports(JSON.stringify({ schema_version: 1, default_page: 'pages/report.md', reports: [nested] }), ['pages/report.md'])).toThrow()
  })
})

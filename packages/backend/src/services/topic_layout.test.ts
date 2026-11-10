import { Database } from 'bun:sqlite'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, afterEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { schema } from '../db/index'
import { topicFixture } from '../testing/topic_fixture'
import { createTopic, getTopic, renameTopic, topicHistory } from './topics'
import { initializeTopicRepo, commitTopicFiles, topicRepoPath } from './topic_git'
import { upgradeTopicLayout } from './topic_layout'
import { referenceRegistry } from './topic_references'
import { parseTopicFiles, topicFiles } from './topic_format'
import { localProcess } from './local_process'
import type { TopicSnapshot } from '@paperland/shared'

let f: ReturnType<typeof topicFixture>
const actor = { user_id: 1, token_id: null, display_name: 'owner' }
beforeEach(() => { f = topicFixture() })
afterEach(() => f.close())
const git = async (id: number, args: string[]) => (await localProcess('git', ['-C', topicRepoPath(id), ...args], { timeout_ms: 5000, max_bytes: 500000 })).output.toString().trim()

describe('V2 published pages and auxiliary Git workspace (offline)', () => {
  test('new Topics default to pages/report.md, a numbered reference catalog and agent guide, not README', async () => {
    const topic = await createTopic(1, { title: 'V2' })
    expect(topic.snapshot.topic.format_version).toBe(2)
    expect(topic.home_page).toBe('pages/report.md')
    const files = (await git(topic.id, ['ls-tree', '-r', '--name-only', 'main'])).split('\n')
    expect(files).toContain('references.json'); expect(files).toContain('AGENTS.md')
    expect(files).toContain('pages/research-questions/index.md'); expect(files).not.toContain('report.md')
    expect(topic.documents.some((p) => p.path === 'README.md')).toBe(false)
    const snapshot = structuredClone(topic.snapshot)
    snapshot.report = '---\ntitle: Overview\nfonticon: BookOpen\nreferences: [1]\n---\n# Content'
    snapshot.list.papers = [{ id: 'first', reference_number: 1, title: 'First', s2_id: 'CorpusId:1', directory_ids: [], comment: '' }]
    snapshot.pages!['pages/research/nested/rq.md'] = '---\ntitle: Future prediction\nfonticon: Compass\nreferences: [1]\n---\n# RQ'
    const fileset = topicFiles(snapshot)
    expect(JSON.parse(fileset['references.json']).references[0].directory_ids).toBeUndefined()
    const parsed = parseTopicFiles({ ...fileset, 'workspace/raw.bin': new Uint8Array([0, 255]), 'workspace/notes.md': '# Not a page' })
    expect(parsed.pages?.['workspace/notes.md']).toBeUndefined()
    await commitTopicFiles(topic.id, topic.commit, { ...fileset, 'workspace/raw.bin': new Uint8Array([0, 255]) }, actor)
    const after = await getTopic(topic.id, 1)
    expect(after.documents.find((p) => p.path === 'pages/research/nested/rq.md')).toMatchObject({ title: 'Future prediction', fonticon: 'Compass', slug: 'research/nested/rq', references: [1] })
    expect(after.documents.some((p) => p.path.startsWith('workspace/'))).toBe(false)
    const renamed = await renameTopic(topic.id, 1, 'Renamed', after.commit)
    expect(await git(topic.id, ['show', `${renamed.commit}:workspace/raw.bin`])).toBe('\0�')
  })
  test('migration is idempotent and preserves report/catalog blobs, reference numbers, auxiliary files and history', async () => {
    const snapshot: TopicSnapshot = { topic: { format_version: 1, title: 'Old', description: '' }, report: '\ufeff# Original\n\nKeep exactly.', list: { format_version: 1, directories: [{ id: 'd', name: 'Old section', parent_id: null, description: 'Old notes' }], papers: [{ id: 'p', title: 'Paper', s2_id: 'CorpusId:1', directory_ids: ['d'], comment: 'Original comment' }] } }
    const row = f.db.insert(schema.topics).values({ owner_id: 1, title: 'Old', created_at: f.now, updated_at: f.now }).returning().get()
    f.db.insert(schema.topicMembers).values({ topic_id: row.id, user_id: 1, role: 'owner' }).run()
    await initializeTopicRepo(row.id, snapshot, actor)
    const initial = (await getTopic(row.id, 1)).commit
    const base = await commitTopicFiles(row.id, initial, { 'workspace/notes.txt': 'Keep workspace', 'workspace/bin.dat': new Uint8Array([0, 255]) }, actor)
    const reportBlob = await git(row.id, ['rev-parse', `${base}:report.md`]), catalogBlob = await git(row.id, ['rev-parse', `${base}:papers.json`])
    const numbers = referenceRegistry(row.id)
    const result = await upgradeTopicLayout(row.id)
    expect(result.skipped).toBe(false)
    expect(await git(row.id, ['rev-parse', `${result.commit}:pages/report.md`])).toBe(reportBlob)
    expect(await git(row.id, ['rev-parse', `${result.commit}:workspace/legacy/papers-${base.slice(0, 12)}.json`])).toBe(catalogBlob)
    expect(await git(row.id, ['show', `${result.commit}:workspace/notes.txt`])).toBe('Keep workspace')
    expect(referenceRegistry(row.id)).toEqual(numbers)
    expect((await getTopic(row.id, 1)).home_page).toBe('pages/report.md')
    expect((await getTopic(row.id, 1, base)).home_page).toBe('report.md')
    const audit = topicHistory(row.id, 1).versions[0]
    expect(audit.pushed_by_user_id).toBeNull(); expect(audit.pushed_by_display_name).toBe('Topic layout migration')
    const count = topicHistory(row.id, 1).total
    expect((await upgradeTopicLayout(row.id)).skipped).toBe(true)
    expect(topicHistory(row.id, 1).total).toBe(count)
    await expect(commitTopicFiles(row.id, result.commit, { 'topic.json': JSON.stringify(snapshot.topic), 'report.md': snapshot.report, 'papers.json': JSON.stringify(snapshot.list) }, actor)).rejects.toThrow('cannot downgrade')
  })
  test('CLI dry run is read-only and applied layout migration safely repeats without new versions', async () => {
    const snapshot: TopicSnapshot = { topic: { format_version: 1, title: 'CLI old', description: '' }, report: '# Original', list: { format_version: 1, directories: [], papers: [] } }
    const row = f.db.insert(schema.topics).values({ owner_id: 1, title: 'CLI old', created_at: f.now, updated_at: f.now }).returning().get()
    f.db.insert(schema.topicMembers).values({ topic_id: row.id, user_id: 1, role: 'owner' }).run()
    await initializeTopicRepo(row.id, snapshot, actor)
    const file = join(f.root, 'layout.db'), config = join(f.root, 'layout-config.yml')
    writeFileSync(file, f.sqlite.serialize())
    writeFileSync(config, readFileSync(join(f.root, 'config.yml'), 'utf8').replace("path: ':memory:'", `path: '${file}'`))
    const cli = async (...args: string[]) => JSON.parse((await localProcess(process.execPath, ['run', 'scripts/migrate-topic-pages.ts', '--config', config, ...args], { cwd: resolve(import.meta.dir, '../../../..'), timeout_ms: 20000, max_bytes: 100000 })).output.toString())
    const before = readFileSync(file)
    expect((await cli('--dry-run')).pending).toEqual([row.id])
    expect(readFileSync(file)).toEqual(before)
    expect((await cli('--apply', '--backup-dir', join(f.root, 'layout-backup'))).migrated).toBe(1)
    expect((await cli('--verify')).topics).toBe(1)
    const db = new Database(file, { readonly: true })
    const count = (db.query('select count(*) n from topic_versions').get() as any).n
    db.close()
    expect((await cli('--apply')).migrated).toBe(0)
    const check = new Database(file, { readonly: true })
    expect((check.query('select count(*) n from topic_versions').get() as any).n).toBe(count)
    check.close()
  })
  test('frontmatter and routes reject malformed metadata and ambiguous nested index routes', async () => {
    const topic = await createTopic(1, { title: 'Routes' })
    for (const body of ['---\ntitle: []\n---\n# Bad', '---\nfonticon: "<svg>"\n---\n# Bad']) await expect(commitTopicFiles(topic.id, topic.commit, { 'pages/bad.md': body }, actor)).rejects.toThrow()
    await expect(commitTopicFiles(topic.id, topic.commit, { 'pages/a.md': '# A', 'pages/a/index.md': '# Another A' }, actor)).rejects.toThrow('ambiguous')
  })
})

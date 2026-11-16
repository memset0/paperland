import { Database } from 'bun:sqlite'
import { beforeEach, afterEach, test, expect } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { TopicSnapshot } from '@paperland/shared'
import { topicFixture } from '../testing/topic_fixture'
import { schema } from '../db/index'
import { commitTopicFiles, initializeTopicRepo, topicRepoPath, setTopicPublicationFaultForTesting, recoverTopicRepositories } from './topic_git'
import { upgradeTopicSchema } from './topic_layout'
import { getTopic, renameTopic, topicHistory } from './topics'
import { referenceRegistry } from './topic_references'
import { localProcess } from './local_process'

let f: ReturnType<typeof topicFixture>
const actor = { user_id: 1, token_id: null, display_name: 'owner' }
beforeEach(() => { f = topicFixture() })
afterEach(() => { setTopicPublicationFaultForTesting(); f.close() })
async function oldTopic(format: 1 | 2) {
  const snapshot: TopicSnapshot = { topic: { format_version: format, title: 'Legacy', description: '' }, report: '# Original\n\nKeep the exact body.\n', pages: { 'pages/rq.md': '---\ntitle: Research\nreferences: [1]\n---\n# Research\n' }, agent_instructions: '# Custom guide\nKeep my instructions.\n', list: { format_version: 1, directories: [], papers: [{ id: 'p', reference_number: 1, title: 'Paper', s2_id: 'CorpusId:1', directory_ids: [], comment: '' }] } }
  const row = f.db.insert(schema.topics).values({ owner_id: 1, title: 'Legacy', created_at: f.now, updated_at: f.now }).returning().get()
  f.db.insert(schema.topicMembers).values({ topic_id: row.id, user_id: 1, role: 'owner' }).run()
  await initializeTopicRepo(row.id, snapshot, actor)
  const current = await getTopic(row.id, 1)
  await commitTopicFiles(row.id, current.commit, { 'workspace/blob.bin': new Uint8Array([0, 255]) }, actor)
  return getTopic(row.id, 1)
}
const git = async (id: number, ...args: string[]) => (await localProcess('git', ['-C', topicRepoPath(id), ...args], { timeout_ms: 5000, max_bytes: 500000 })).output.toString().trim()
for (const format of [1, 2] as const) test(`legacy format ${format} upgrades with exact blobs, references, history and audit, and rejects downgrade`, async () => {
  const old = await oldTopic(format), refs = referenceRegistry(old.id)
  const oldBlob = await git(old.id, 'rev-parse', `${old.commit}:${old.home_page}`)
  const result = await upgradeTopicSchema(old.id)
  const current = await getTopic(old.id, 1)
  expect(current.repository_schema).toMatchObject({ encoding: 'schema_v1', migration_required: false })
  expect(await git(old.id, 'rev-parse', `${result.commit}:pages/report.md`)).toBe(oldBlob)
  expect(await git(old.id, 'rev-parse', `${result.commit}:pages/rq.md`)).toBe(await git(old.id, 'rev-parse', `${old.commit}:pages/rq.md`))
  expect(await git(old.id, 'show', `${result.commit}:workspace/blob.bin`)).toBe('\0�')
  expect(current.snapshot.agent_instructions).toBe(old.snapshot.agent_instructions)
  expect(referenceRegistry(old.id)).toEqual(refs)
  expect((await getTopic(old.id, 1, old.commit)).repository_schema.encoding).toBe(`legacy_format_${format}`)
  expect(topicHistory(old.id, 1).versions[0]).toMatchObject({ pushed_by_user_id: null, pushed_by_display_name: 'Topic schema migration' })
  const renamed = await renameTopic(old.id, 1, 'Short', current.commit)
  expect(JSON.parse(await git(old.id, 'show', `${renamed.commit}:topic.json`))).toEqual({ schema_version: 1, title: 'Short', description: '' })
  const count = topicHistory(old.id, 1).total
  expect((await upgradeTopicSchema(old.id)).skipped).toBe(true)
  expect(topicHistory(old.id, 1).total).toBe(count)
  await expect(commitTopicFiles(old.id, renamed.commit, { 'topic.json': '{"format_version":2,"title":"Downgrade"}' }, actor)).rejects.toThrow('cannot downgrade')
})
test('an interrupted migration recovers the coherent canonical snapshot and original system audit', async () => {
  const old = await oldTopic(2)
  setTopicPublicationFaultForTesting(() => { throw new Error('injected interruption') })
  await expect(upgradeTopicSchema(old.id)).rejects.toThrow('injected interruption')
  setTopicPublicationFaultForTesting()
  await recoverTopicRepositories()
  expect((await getTopic(old.id, 1)).repository_schema.encoding).toBe('schema_v1')
  expect(topicHistory(old.id, 1).versions[0].pushed_by_display_name).toBe('Topic schema migration')
  expect((await upgradeTopicSchema(old.id)).skipped).toBe(true)
})
test('schema CLI dry-run is read-only, apply backs up and repeat/verify are idempotent', async () => {
  const old = await oldTopic(2)
  const file = join(f.root, 'schema.db'), config = join(f.root, 'schema-config.yml')
  writeFileSync(file, f.sqlite.serialize())
  writeFileSync(config, readFileSync(join(f.root, 'config.yml'), 'utf8').replace("path: ':memory:'", `path: '${file}'`))
  const cli = async (...args: string[]) => JSON.parse((await localProcess(process.execPath, ['run', 'scripts/migrate-topic-schema.ts', '--config', config, ...args], { cwd: resolve(import.meta.dir, '../../../..'), timeout_ms: 20000, max_bytes: 100000 })).output.toString())
  const before = readFileSync(file)
  expect((await cli('--dry-run')).pending).toEqual([old.id])
  expect(readFileSync(file)).toEqual(before)
  const result = await cli('--apply', '--backup-dir', join(f.root, 'schema-backup'))
  expect(result.migrated).toBe(1)
  const backup = new Database(result.backup, { readonly: true })
  expect((backup.query('select published_commit from topics where id=?').get(old.id) as any).published_commit).toBe(old.commit)
  backup.close()
  expect((await cli('--verify', '--topics', String(old.id))).topics).toBe(1)
  await expect(cli('--dry-run', '--topics', '9999')).rejects.toThrow()
  expect((await cli('--apply')).migrated).toBe(0)
})

test('legacy reports.yml workspace collisions are readable and rejected without overwriting data', async () => {
  const old = await oldTopic(2)
  const commit = await commitTopicFiles(old.id, old.commit, { 'reports.yml': new Uint8Array([0, 255]) }, actor)
  expect((await getTopic(old.id, 1, commit)).repository_schema.encoding).toBe('legacy_format_2')
  await expect(upgradeTopicSchema(old.id)).rejects.toThrow('already exists in legacy workspace')
  expect((await getTopic(old.id, 1)).commit).toBe(commit)
})

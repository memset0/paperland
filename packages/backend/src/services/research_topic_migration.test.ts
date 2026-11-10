import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { eq } from 'drizzle-orm'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import type { ResearchPaperList } from '@paperland/shared'
import { schema } from '../db/index'
import { topicFixture } from '../testing/topic_fixture'
import { backupResearchMigrationDatabase, migrateResearchToTopics, migrationPlanSummary, planResearchMigration, researchSourceHash, researchSources, verifyResearchTopicMigration } from './research_topic_migration'
import { getTopic, listTopics, renameTopic, topicHistory } from './topics'
import { setTopicPublicationFaultForTesting, topicRepoPath } from './topic_git'
import { topicTagsByPapers } from './topic_index'
import { localProcess } from './local_process'

let f: ReturnType<typeof topicFixture>, sourceIds: number[]
const list = (): ResearchPaperList => ({ title: 'A very long original research name', changes: 'Initial findings', sections: [
  { title: 'Methods', description: 'Original directory **description**.', items: [
    { kind: 'paper', s2_id: 'a'.repeat(40), verification: 'verified', comment: 'First occurrence comment' },
    { kind: 'link', url: 'https://example.test/report', citation: { title: 'An external reference', author: ['Example Author'], year: 2024, month: 'June', howpublished: 'Example proceedings', note: 'Original citation note' }, comment: 'Keep this link comment.' },
  ] },
  { title: 'Second section', items: [{ kind: 'paper', s2_id: 'a'.repeat(40), verification: 'verified', comment: 'A different occurrence comment' }] },
] })
beforeEach(() => {
  f = topicFixture(); sourceIds = []
  for (const owner of [1, 2]) {
    const session = f.db.insert(schema.researchSessions).values({ user_id: owner, topic: 'Original research prompt', created_at: f.now, updated_at: f.now }).returning().get()
    sourceIds.push(session.id)
    const versions = owner === 1 ? 2 : 1
    for (let i = 1; i <= versions; i++) {
      const value = list()
      if (i === 2) { value.title = 'Legacy title edit'; value.sections[0].title = 'Renamed methods'; value.changes = 'Only titles changed' }
      f.db.insert(schema.researchSteps).values({ session_id: session.id, step_index: i, kind: i === 2 ? 'title_edit' : 'agent', status: 'done', user_text: i === 1 ? 'Original instruction' : null, model_name: i === 2 ? null : 'fixture', answer: 'Original raw answer', report: '# Report\n\nExact original report.\n', paper_list: JSON.stringify(value), created_at: f.now, updated_at: f.now, finished_at: f.now }).run()
    }
  }
  f.db.insert(schema.userSharingSettings).values({ user_id: 1, data_type: 'research', shared: 1, updated_at: f.now }).run()
})
afterEach(() => { setTopicPublicationFaultForTesting(); f.close() })

describe('one-time legacy Research migration (offline)', () => {
  test('plans without writes and preserves links, citations, descriptions, occurrence comments and stable renamed directories', () => {
    const before = researchSources(f.db).map(researchSourceHash)
    const plans = planResearchMigration(f.db)
    expect(migrationPlanSummary(plans)).toMatchObject({ sessions: 2, result_versions: 3, paper_occurrences: 6, link_occurrences: 3 })
    expect(plans[0].versions[0].snapshot.list.papers[1].citation).toEqual(list().sections[0].items[1].kind === 'link' ? (list().sections[0].items[1] as any).citation : null)
    expect(plans[0].versions[0].snapshot.list.directories[0].description).toBe('Original directory **description**.')
    expect(plans[0].versions[1].snapshot.list.directories[0].id).toBe(plans[0].versions[0].snapshot.list.directories[0].id)
    expect(plans[0].versions[0].snapshot.list.papers[0].id).not.toBe(plans[0].versions[0].snapshot.list.papers[2].id)
    expect(researchSources(f.db).map(researchSourceHash)).toEqual(before)
    expect(f.db.select().from(schema.topics).all()).toEqual([])
    expect(existsSync(join(f.root, 'repos'))).toBe(false)
  })
  test('imports all versions exactly once under original owners and current shared readers without adding papers', async () => {
    const before = researchSources(f.db).map(researchSourceHash), paperCount = f.db.select().from(schema.papers).all().length
    const results = await migrateResearchToTopics()
    expect(results).toHaveLength(2)
    expect(await verifyResearchTopicMigration()).toEqual({ sessions: 2, result_versions: 3, paper_occurrences: 6, link_occurrences: 3 })
    expect(topicHistory(results[0].topic_id, 1).versions).toHaveLength(2)
    expect(topicHistory(results[0].topic_id, 1).versions[0].pushed_by_user_id).toBeNull()
    expect(topicHistory(results[0].topic_id, 1).versions[0].pushed_by_display_name).toBe('Paperland migration')
    expect(listTopics(3)).toHaveLength(1)
    expect(listTopics(2)).toHaveLength(2)
    expect(listTopics(4)).toHaveLength(1) // Admin receives shared access, never private-topic bypass.
    expect(f.db.select().from(schema.papers).all()).toHaveLength(paperCount)
    expect(researchSources(f.db).map(researchSourceHash)).toEqual(before)
    const again = await migrateResearchToTopics()
    expect(again.every((r) => r.skipped)).toBe(true)
    expect(f.db.select().from(schema.topicVersions).all()).toHaveLength(3)
  })
  test('interrupted publication remains hidden and resumes without duplicate sessions or steps', async () => {
    let calls = 0
    setTopicPublicationFaultForTesting(() => { if (++calls === 2) throw new Error('injected migration interruption') })
    await expect(migrateResearchToTopics()).rejects.toThrow('injected')
    const pending = f.db.select().from(schema.topics).all()[0]
    expect(pending.published_commit).not.toBeNull()
    expect(listTopics(1)).toEqual([])
    await expect(getTopic(pending.id, 1)).rejects.toThrow('migration is in progress')
    expect(topicTagsByPapers([10], 1).size).toBe(0)
    setTopicPublicationFaultForTesting()
    await migrateResearchToTopics()
    expect(await verifyResearchTopicMigration()).toMatchObject({ sessions: 2, result_versions: 3 })
    expect(f.db.select().from(schema.topics).all()).toHaveLength(2)
    expect(f.db.select().from(schema.topicVersions).all()).toHaveLength(3)
    expect(f.db.select().from(schema.topics).all().every((t) => t.legacy_migration_plan === null)).toBe(true)
  })
  test('a completed migration never overwrites user-shortened names and rename only changes topic.json', async () => {
    const imported = await migrateResearchToTopics(), id = imported[0].topic_id
    const before = await getTopic(id, 1)
    const renamed = await renameTopic(id, 1, 'Short name', before.commit)
    expect(renamed.snapshot.report).toBe(before.snapshot.report)
    expect(renamed.snapshot.list).toEqual(before.snapshot.list)
    const diff = await localProcess('git', ['-C', topicRepoPath(id), 'diff-tree', '--no-commit-id', '--name-only', '-r', before.commit, renamed.commit], { timeout_ms: 10000, max_bytes: 10000 })
    expect(diff.output.toString().trim()).toBe('topic.json')
    expect(topicTagsByPapers([10], 1).get(10)?.[0].name).toBe('Short name')
    await expect(renameTopic(id, 1, 'Stale name', before.commit)).rejects.toThrow('changed')
    await expect(renameTopic(id, 3, 'Viewer name', renamed.commit)).rejects.toThrow('permission')
    await migrateResearchToTopics()
    expect((await getTopic(id, 1)).title).toBe('Short name')
    expect(await verifyResearchTopicMigration()).toMatchObject({ result_versions: 3 })
  })
  test('VACUUM INTO takes a consistent snapshot including committed WAL without copying a stale main file', () => {
    const source = new Database(join(f.root, 'wal-source.db'))
    source.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE local_fixture (value TEXT); INSERT INTO local_fixture VALUES (\'latest committed WAL value\')')
    const readOnly = new Database(join(f.root, 'wal-source.db'), { readonly: true }), destination = join(f.root, 'backup', 'before.db')
    try {
      backupResearchMigrationDatabase(readOnly, destination)
      const copy = new Database(destination, { readonly: true })
      try { expect((copy.query('SELECT value FROM local_fixture').get() as any).value).toBe('latest committed WAL value') } finally { copy.close() }
      expect(statSync(destination).mode & 0o777).toBe(0o600)
      expect(() => backupResearchMigrationDatabase(readOnly, destination)).toThrow('overwrite')
    } finally { readOnly.close(); source.close() }
  })
  test('CLI dry run and verify are read-only, and explicit apply is idempotent', async () => {
    const path = join(f.root, 'cli.db'), config = join(f.root, 'cli.yml')
    writeFileSync(path, f.sqlite.serialize())
    writeFileSync(config, readFileSync(join(f.root, 'config.yml'), 'utf8').replace("path: ':memory:'", `path: '${path}'`))
    const fingerprint = () => createHash('sha256').update(readFileSync(path)).digest('hex')
    const run = (mode: string) => localProcess(process.execPath, ['run', 'scripts/migrate-research-to-topics.ts', mode, '--config', config, '--backup-dir', join(f.root, `cli-backup-${Math.random()}`)], { cwd: resolve(import.meta.dir, '../../../..'), timeout_ms: 30000, max_bytes: 100000 })
    const old = fingerprint()
    expect(JSON.parse((await run('--dry-run')).output.toString()).mode).toBe('dry_run')
    expect(fingerprint()).toBe(old)
    expect(JSON.parse((await run('--apply')).output.toString()).created).toBe(2)
    const migrated = fingerprint()
    expect(JSON.parse((await run('--verify')).output.toString()).result_versions).toBe(3)
    expect(fingerprint()).toBe(migrated)
    expect(JSON.parse((await run('--apply')).output.toString()).created).toBe(0)
  })
})

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { join } from 'node:path'
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { schema } from '../db/index'
import { topicFixture } from '../testing/topic_fixture'
import { topicGitRoutes } from '../api/topic_git'
import { initializeTopicRepo, readTopicCommit, recoverTopicRepositories, setTopicPublicationFaultForTesting, topicRepoPath } from './topic_git'
import { issueTopicCredential, setTopicDefaultAccess, setTopicMember } from './topic_access'
import { localProcess } from './local_process'
import { topicFiles } from './topic_format'
import type { TopicSnapshot } from '@paperland/shared'
import { getTopic, renameTopic } from './topics'

let f: ReturnType<typeof topicFixture>, app: FastifyInstance, id: number, token: string, url: string
const snapshot: TopicSnapshot = { topic: { format_version: 1, title: 'Fixture', description: '' }, report: '# Report\n\nOriginal.', list: { format_version: 1, directories: [{ id: 'a', name: 'Methods', parent_id: null }, { id: 'b', name: 'Nested', parent_id: 'a' }], papers: [{ id: 'local', title: 'Local', paper_id: 10, directory_ids: ['b'], comment: '' }, { id: 'external', title: 'External', s2_id: 'CorpusId:123', directory_ids: [], comment: '' }] } }
async function client(args: string[], cwd?: string, codes = [0]) {
  return localProcess('git', ['-c', 'core.hooksPath=/dev/null', '-c', `http.extraHeader=Authorization: Bearer ${token}`, ...(cwd ? ['-C', cwd] : []), ...args], { timeout_ms: 20000, max_bytes: 33554432, allowed_codes: codes, env: { GIT_AUTHOR_NAME: 'Declared author', GIT_AUTHOR_EMAIL: 'declared@example.test', GIT_COMMITTER_NAME: 'Declared committer', GIT_COMMITTER_EMAIL: 'committer@example.test', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } })
}
const current = () => f.db.select().from(schema.topics).where(eq(schema.topics.id, id)).get()!
beforeEach(async () => {
  f = topicFixture()
  id = f.db.insert(schema.topics).values({ owner_id: 1, title: 'Fixture', created_at: f.now, updated_at: f.now, snapshot: JSON.stringify(snapshot) }).returning().get().id
  f.db.insert(schema.topicMembers).values({ topic_id: id, user_id: 1, role: 'owner' }).run()
  await setTopicMember(id, 1, 'editor', 'editor'); await setTopicMember(id, 1, 'viewer', 'viewer')
  await initializeTopicRepo(id, snapshot, { user_id: 1, token_id: null, display_name: 'owner' })
  token = (await issueTopicCredential(id, 2)).token
  app = Fastify(); await app.register(topicGitRoutes)
  const address = await app.listen({ port: 0, host: '127.0.0.1' })
  url = `${address}/topic-git/${id}.git`
})
afterEach(async () => { setTopicPublicationFaultForTesting(); await app.close(); f.close() })

describe('Topic smart HTTP Git clients and publication (offline)', () => {
  test('auxiliary executable/binary files are retained but never run, renamed away or published as documents', async () => {
    const work = join(f.root, 'workspace-client'); await client(['clone', url, work])
    mkdirSync(join(work, 'workspace'))
    const sentinel = join(f.root, 'must-not-run')
    writeFileSync(join(work, 'workspace', 'run.sh'), `#!/bin/sh\ntouch '${sentinel}'\n`); chmodSync(join(work, 'workspace', 'run.sh'), 0o755)
    writeFileSync(join(work, 'workspace', 'raw.bin'), new Uint8Array([0, 255, 1]))
    writeFileSync(join(work, 'workspace', 'notes.md'), '# Not a website page')
    await client(['add', '--', 'workspace/run.sh', 'workspace/raw.bin', 'workspace/notes.md'], work); await client(['commit', '-m', 'Add agent workspace'], work); await client(['push', 'origin', 'main'], work)
    expect(existsSync(sentinel)).toBe(false)
    const before = (await getTopic(id, 1)).commit
    expect((await getTopic(id, 1)).documents.some((d) => d.path.startsWith('workspace/'))).toBe(false)
    const oldTree = (await localProcess('git', ['-C', topicRepoPath(id), 'ls-tree', '-r', before, '--', 'workspace'], { timeout_ms: 5000, max_bytes: 50000 })).output.toString()
    expect(oldTree).toContain('100755 blob')
    const renamed = await renameTopic(id, 1, 'New name', before)
    const newTree = (await localProcess('git', ['-C', topicRepoPath(id), 'ls-tree', '-r', renamed.commit, '--', 'workspace'], { timeout_ms: 5000, max_bytes: 50000 })).output.toString()
    expect(newTree).toBe(oldTree)
    await client(['pull', '--ff-only'], work)
    symlinkSync('/etc/passwd', join(work, 'workspace', 'unsafe-link'))
    await client(['add', '--', 'workspace/unsafe-link'], work); await client(['commit', '-m', 'Unsafe symlink'], work)
    expect((await client(['push', 'origin', 'main'], work, [0, 1, 128])).code).not.toBe(0)
    expect(current().published_commit).toBe(renamed.commit)
  })
  test('public policy and individual grants use the higher permission at Git authorization time', async () => {
    await setTopicDefaultAccess(id, 1, 'viewer')
    token = (await issueTopicCredential(id, 4)).token
    const work = join(f.root, 'public'); await client(['clone', url, work])
    expect((await app.inject({ url: `/topic-git/${id}.git/info/refs?service=git-receive-pack`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(403)
    await setTopicDefaultAccess(id, 1, 'editor')
    writeFileSync(join(work, 'report.md'), 'Public editor update')
    await client(['add', '--', 'report.md'], work); await client(['commit', '-m', 'Public update'], work); await client(['push', 'origin', 'main'], work)
    expect(JSON.parse(current().snapshot!).report).toBe('Public editor update')
    await setTopicMember(id, 1, 'outsider', 'viewer')
    expect((await app.inject({ url: `/topic-git/${id}.git/info/refs?service=git-receive-pack`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200)
    await setTopicMember(id, 1, 'outsider', null)
    expect((await app.inject({ url: `/topic-git/${id}.git/info/refs?service=git-receive-pack`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200)
    await setTopicDefaultAccess(id, 1, 'none')
    expect((await app.inject({ url: `/topic-git/${id}.git/info/refs?service=git-upload-pack`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401)
  })
  test('publishes supplementary pages with numbered subsets and rejects an invalid intermediate subset', async () => {
    const work = join(f.root, 'pages'); await client(['clone', url, work])
    mkdirSync(join(work, 'pages'))
    writeFileSync(join(work, 'pages/rq6.md'), '---\nreferences: [2]\n---\n# RSI\n\nA report.')
    await client(['add', '--', 'pages/rq6.md'], work); await client(['commit', '-m', 'Add RSI page'], work); await client(['push', 'origin', 'main'], work)
    const accepted = current().published_commit!
    expect((await readTopicCommit(id, accepted)).pages?.['pages/rq6.md']).toContain('A report.')
    writeFileSync(join(work, 'pages/rq6.md'), '---\nreferences: [999]\n---\n# Invalid subset')
    await client(['add', '--', 'pages/rq6.md'], work); await client(['commit', '-m', 'Invalid page'], work)
    writeFileSync(join(work, 'pages/rq6.md'), '# Valid tip')
    await client(['add', '--', 'pages/rq6.md'], work); await client(['commit', '-m', 'Valid tip'], work)
    expect((await client(['push', 'origin', 'main'], work, [0, 1, 128])).code).not.toBe(0)
    expect(current().published_commit).toBe(accepted)
  })
  test('clones, pushes and reads coherent versions with actual uploader and ancestor indexing', async () => {
    const work = join(f.root, 'client')
    await client(['clone', url, work])
    const old = current().published_commit!
    writeFileSync(join(work, 'report.md'), '# Report\n\nOriginal.\n\nAdded report paragraph.')
    const next = structuredClone(snapshot); next.list.directories[0].name = 'Renamed methods'
    writeFileSync(join(work, 'papers.json'), topicFiles(next)['papers.json'])
    await client(['add', '--', 'report.md', 'papers.json'], work)
    await client(['commit', '-m', 'Add findings'], work)
    await client(['push', 'origin', 'main'], work)
    const latest = current()
    expect(latest.published_commit).not.toBe(old)
    const version = JSON.parse(latest.snapshot!) as TopicSnapshot
    expect(version.report).toContain('Added report paragraph')
    expect(version.list.directories[0]).toMatchObject({ id: 'a', name: 'Renamed methods' })
    expect((await readTopicCommit(id, old)).report).toBe(snapshot.report)
    const push = f.db.select().from(schema.topicPushes).where(eq(schema.topicPushes.new_commit, latest.published_commit!)).get()!
    expect(push.user_id).toBe(2); expect(push.uploader_name).toBe('editor')
    const rev = f.db.select().from(schema.topicVersions).where(eq(schema.topicVersions.commit, latest.published_commit!)).get()!
    expect(rev.author_name).toBe('Declared author')
    expect(f.db.select().from(schema.topicPapers).where(eq(schema.topicPapers.paper_id, 10)).all().map((r) => r.node_id).sort()).toEqual(['a', 'b', 'root'])
  })
  test('refuses viewer writes, cross-Topic credentials and revoked access while permitting reads', async () => {
    token = (await issueTopicCredential(id, 3)).token
    const basic = `Basic ${Buffer.from(`viewer:${token}`).toString('base64')}`
    expect((await app.inject({ url: `/topic-git/${id}.git/info/refs?service=git-upload-pack`, headers: { authorization: basic } })).statusCode).toBe(200)
    await client(['clone', url, join(f.root, 'viewer')])
    const forbidden = await app.inject({ url: `/topic-git/${id}.git/info/refs?service=git-receive-pack`, headers: { authorization: `Bearer ${token}` } })
    expect(forbidden.statusCode).toBe(403)
    const cross = await app.inject({ url: '/topic-git/999.git/info/refs?service=git-upload-pack', headers: { authorization: `Bearer ${token}` } })
    expect(cross.statusCode).toBe(404)
    await setTopicMember(id, 1, 'viewer', null)
    expect((await app.inject({ url: `/topic-git/${id}.git/info/refs?service=git-upload-pack`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401)
  })
  test('rejects malformed intermediate commits, unsafe modes and extra refs without advancing real main', async () => {
    const work = join(f.root, 'client'); await client(['clone', url, work])
    const old = current().published_commit
    writeFileSync(join(work, 'papers.json'), '{broken')
    await client(['add', '--', 'papers.json'], work); await client(['commit', '-m', 'Broken intermediate'], work)
    writeFileSync(join(work, 'papers.json'), topicFiles(snapshot)['papers.json'])
    await client(['add', '--', 'papers.json'], work); await client(['commit', '-m', 'Valid tip'], work)
    expect((await client(['push', 'origin', 'main'], work, [0, 1, 128])).code).not.toBe(0)
    expect(current().published_commit).toBe(old)
    // The known valid remote commit is pushed to an extra ref; only main is ever promoted.
    expect((await client(['push', 'origin', `${old}:refs/heads/extra`], work, [0, 1, 128])).code).not.toBe(0)
    const refs = await localProcess('git', ['-C', topicRepoPath(id), 'for-each-ref', '--format=%(refname)'], { timeout_ms: 5000, max_bytes: 10000 })
    expect(refs.output.toString().trim()).toBe('refs/heads/main')
  })
  test('stale editors, history rewrites and main deletion cannot overwrite another push', async () => {
    const a = join(f.root, 'a'), b = join(f.root, 'b')
    await client(['clone', url, a]); await client(['clone', url, b])
    for (const [work, text] of [[a, 'First'], [b, 'Second']]) {
      writeFileSync(join(work, 'report.md'), text); await client(['add', '--', 'report.md'], work); await client(['commit', '-m', text], work)
    }
    await client(['push', 'origin', 'main'], a)
    const accepted = current().published_commit
    expect((await client(['push', 'origin', 'main'], b, [0, 1, 128])).code).not.toBe(0)
    expect((await client(['push', '--force', 'origin', 'main'], b, [0, 1, 128])).code).not.toBe(0)
    expect((await client(['push', 'origin', ':main'], b, [0, 1, 128])).code).not.toBe(0)
    expect(current().published_commit).toBe(accepted)
  })
  test('rejects executable files and oversized report blobs before real publication', async () => {
    const work = join(f.root, 'client'); await client(['clone', url, work])
    const old = current().published_commit
    await client(['update-index', '--chmod=+x', 'report.md'], work)
    await client(['commit', '-m', 'Unsafe executable mode'], work)
    expect((await client(['push', 'origin', 'main'], work, [0, 1, 128])).code).not.toBe(0)
    expect(current().published_commit).toBe(old)
    const largeWork = join(f.root, 'large'); await client(['clone', url, largeWork])
    writeFileSync(join(largeWork, 'report.md'), 'x'.repeat(2097153))
    await client(['add', '--', 'report.md'], largeWork); await client(['commit', '-m', 'Oversized report'], largeWork)
    expect((await client(['push', 'origin', 'main'], largeWork, [0, 1, 128])).code).not.toBe(0)
    expect(current().published_commit).toBe(old)
  })
  test('recovers an interruption after Git advances with original uploader and no mixed snapshot', async () => {
    const work = join(f.root, 'client'); await client(['clone', url, work])
    const old = current().published_commit
    writeFileSync(join(work, 'report.md'), 'Recovered report')
    const expanded = structuredClone(snapshot)
    expanded.list.papers.push({ id: 'recover-reference', title: 'Recovered reference', s2_id: 'CorpusId:456', directory_ids: [], comment: '' })
    writeFileSync(join(work, 'papers.json'), topicFiles(expanded)['papers.json'])
    await client(['add', '--', 'report.md', 'papers.json'], work); await client(['commit', '-m', 'Recover me'], work)
    setTopicPublicationFaultForTesting(() => { throw new Error('injected interruption') })
    expect((await client(['push', 'origin', 'main'], work, [0, 1, 128])).code).not.toBe(0)
    expect(current().published_commit).toBe(old)
    expect(JSON.parse(current().snapshot!).report).toBe(snapshot.report)
    const journal = JSON.parse(readFileSync(join(f.root, 'repos', 'journals', `${id}.json`), 'utf8'))
    // The authenticated account can disappear before restart; original audit identity must survive.
    f.db.delete(schema.apiTokens).where(eq(schema.apiTokens.user_id, 2)).run()
    f.db.delete(schema.users).where(eq(schema.users.id, 2)).run()
    token = (await issueTopicCredential(id, 1)).token
    setTopicPublicationFaultForTesting()
    await recoverTopicRepositories()
    expect(f.db.select().from(schema.topicReferences).where(eq(schema.topicReferences.topic_id, id)).all().map((r) => r.reference_number).sort()).toEqual([1, 2, 3])
    await client(['fetch', 'origin'], work)
    expect(JSON.parse(current().snapshot!).report).toBe('Recovered report')
    const push = f.db.select().from(schema.topicPushes).where(eq(schema.topicPushes.new_commit, current().published_commit!)).get()!
    expect(push.user_id).toBeNull(); expect(push.uploader_user_id).toBe(2); expect(push.pushed_at).toBe(journal.pushed_at)
    await client(['fetch', 'origin'], work)
    expect(f.db.select().from(schema.topicPushes).all()).toHaveLength(2)
  })
})

import { mkdirSync, mkdtempSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, rmSync, openSync, fsyncSync, closeSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { TopicSnapshot } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import { localProcess } from './local_process.js'
import { parseTopicFiles, topicFiles, TopicError } from './topic_format.js'
import { rebuildTopicIndex, refreshTopicPaperBindings } from './topic_index.js'
import { withTopicLock } from './topic_lock.js'
import { isTopicText, MAX_TOPIC_FILES, requireSafeTopicPath } from './topic_paths.js'
import { createReferencePlanner, planTopicReferences, type ReferenceAllocation } from './topic_references.js'

type Revision = Omit<typeof schema.topicVersions.$inferInsert, 'topic_id' | 'push_id' | 'sequence'>
interface Publication {
  id: string; topic_id: number; user_id: number; token_id: number | null; uploader_name: string
  old_commit: string | null; new_commit: string; pushed_at: string; versions: Revision[]; snapshot: TopicSnapshot
  reference_allocations?: ReferenceAllocation[]
}
export type PushIdentity = { user_id: number; token_id: number | null; display_name: string }
export interface TopicCommitOptions { message?: string; legacy_research_step_id?: number; author_date?: string; author_name?: string }

export function topicRepoPath(topicId: number): string {
  if (!Number.isSafeInteger(topicId) || topicId < 1) throw new TopicError(404, 'Topic not found')
  return join(resolve(getConfig().topics.repos_dir), `${topicId}.git`)
}
function journalPath(topicId: number) {
  return join(resolve(getConfig().topics.repos_dir), 'journals', `${topicId}.json`)
}
export function hasTopicPublicationJournal(topicId: number): boolean { return existsSync(journalPath(topicId)) }

/** Startup reconciliation does not run any providers or change legacy Research data. */
export async function recoverTopicRepositories(): Promise<void> {
  for (const topic of getDatabase().select().from(schema.topics).all()) {
    try {
      await withTopicLock(topic.id, async () => {
        await backfillTopicReferences(topic.id)
        if (topic.legacy_migration_state === 'pending') {
          if (hasTopicPublicationJournal(topic.id)) await reconcileTopic(topic.id)
          return // The explicit migration CLI resumes its persisted source plan.
        }
        if (!topic.published_commit && !hasTopicPublicationJournal(topic.id) && topic.snapshot) {
          const owner = getDatabase().select().from(schema.users).where(eq(schema.users.id, topic.owner_id)).get()
          if (!owner) throw new Error('Topic owner is unavailable')
          await initializeTopicRepo(topic.id, JSON.parse(topic.snapshot), { user_id: owner.id, token_id: null, display_name: owner.nickname || owner.username })
        } else await reconcileTopic(topic.id)
        await backfillTopicReferences(topic.id)
        refreshTopicPaperBindings(topic.id)
      })
    } catch (error) { console.error(`Topic ${topic.id} recovery failed:`, (error as Error).message) }
  }
}
async function git(repo: string | null, args: string[], input?: Uint8Array | string, allowedCodes?: number[], protocol?: string, commitEnv?: Record<string, string | undefined>) {
  const c = getConfig().topics
  return localProcess(c.git_path, ['-c', 'core.hooksPath=/dev/null', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'protocol.file.allow=always', '-c', 'receive.denyNonFastForwards=true', '-c', 'receive.denyDeletes=true', '-c', 'receive.fsckObjects=true', ...(repo ? ['-C', repo] : []), ...args], {
    input, allowed_codes: allowedCodes, timeout_ms: c.operation_timeout_ms, max_bytes: Math.max(c.max_push_bytes * 4, c.max_file_bytes * 4),
    env: { GIT_PROTOCOL: protocol, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_AUTHOR_NAME: 'Paperland', GIT_AUTHOR_EMAIL: 'paperland@localhost', GIT_COMMITTER_NAME: 'Paperland', GIT_COMMITTER_EMAIL: 'paperland@localhost', ...commitEnv },
  })
}
async function head(repo: string): Promise<string | null> {
  const r = await git(repo, ['rev-parse', '--verify', 'refs/heads/main'], undefined, [0, 128])
  return r.code === 0 ? r.output.toString().trim() : null
}

export async function readTopicCommit(topicId: number, commit: string, repo = topicRepoPath(topicId)): Promise<TopicSnapshot> {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new TopicError(404, 'Topic version not found')
  const listing = (await git(repo, ['ls-tree', '-r', '-l', '-z', '--full-tree', commit])).output.toString('utf8')
  const files: Record<string, Uint8Array> = Object.create(null)
  const entries = listing.split('\0').filter(Boolean)
  if (entries.length > MAX_TOPIC_FILES) throw new TopicError(422, 'Too many Topic files')
  let totalBytes = 0
  for (const entry of entries) {
    const m = entry.match(/^(\d+) (\w+) ([a-f0-9]{40})\s+(\d+|-)\t([\s\S]+)$/)
    if (!m || !['100644', '100755'].includes(m[1]) || m[2] !== 'blob') throw new TopicError(422, 'Only regular files are allowed; symlinks and submodules are not accepted')
    requireSafeTopicPath(m[5])
    if (isTopicText(m[5]) && m[1] !== '100644') throw new TopicError(422, 'Published documents and metadata must be non-executable')
    if (Number(m[4]) > getConfig().topics.max_file_bytes) throw new TopicError(422, `${m[5]} exceeds the configured file limit`)
    totalBytes += Number(m[4])
    if (totalBytes > getConfig().topics.max_file_bytes * 8) throw new TopicError(422, 'Topic text exceeds the aggregate limit')
    if (isTopicText(m[5])) files[m[5]] = (await git(repo, ['cat-file', 'blob', m[3]])).output
  }
  return parseTopicFiles(files, getConfig().topics.max_file_bytes)
}

/** Upgrade derived numbering only; never rewrite existing reports or Git commits. */
export async function backfillTopicReferences(topicId: number): Promise<void> {
  const db = getDatabase(), topic = db.select().from(schema.topics).where(eq(schema.topics.id, topicId)).get()
  if (!topic?.published_commit || topic.references_indexed_commit === topic.published_commit) return
  const versions = db.select({ commit: schema.topicVersions.commit, added_at: schema.topicPushes.pushed_at }).from(schema.topicVersions)
    .innerJoin(schema.topicPushes, eq(schema.topicPushes.id, schema.topicVersions.push_id)).where(eq(schema.topicVersions.topic_id, topicId)).orderBy(schema.topicVersions.sequence).all()
  const planner = createReferencePlanner(topicId)
  for (const v of versions) planner.add({ ...v, snapshot: await readTopicCommit(topicId, v.commit) })
  const allocations = planner.allocations
  db.transaction((tx) => {
    for (const row of allocations) tx.insert(schema.topicReferences).values(row).onConflictDoNothing().run()
    tx.update(schema.topics).set({ references_indexed_commit: topic.published_commit }).where(eq(schema.topics.id, topicId)).run()
  })
}

/** Build directories from validated flat paths instead of passing slashes to mktree. */
type TreeBlob = { hash: string; mode: '100644' | '100755' }
async function buildTree(repo: string, entries: Map<string, TreeBlob>): Promise<string> {
  const root: string[] = [], groups = new Map<string, Map<string, TreeBlob>>()
  const names = new Set<string>()
  for (const [name, blob] of entries) {
    requireSafeTopicPath(name)
    const slash = name.indexOf('/')
    if (slash < 0) { root.push(`${blob.mode} blob ${blob.hash}\t${name}\0`); names.add(name) }
    else {
      const directory = name.slice(0, slash), children = groups.get(directory) ?? new Map<string, TreeBlob>()
      children.set(name.slice(slash + 1), blob); groups.set(directory, children)
    }
  }
  for (const [directory, children] of groups) {
    if (names.has(directory)) throw new TopicError(422, 'A repository path cannot be both a file and a directory')
    root.push(`040000 tree ${await buildTree(repo, children)}\t${directory}\0`)
  }
  return (await git(repo, ['mktree', '-z'], root.join(''))).output.toString().trim()
}

export async function readTopicTextFile(topicId: number, commit: string, path: string): Promise<string | undefined> {
  requireSafeTopicPath(path)
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new TopicError(404, 'Topic version not found')
  const repo = topicRepoPath(topicId)
  const found = await git(repo, ['cat-file', '-e', `${commit}:${path}`], undefined, [0, 128])
  if (found.code !== 0) return undefined
  const raw = (await git(repo, ['show', `${commit}:${path}`])).output
  if (raw.length > getConfig().topics.max_file_bytes) throw new TopicError(422, 'Topic file exceeds its limit')
  try { return new TextDecoder('utf-8', { fatal: true }).decode(raw) } catch { throw new TopicError(422, 'Topic text file is not valid UTF-8') }
}

async function revision(repo: string, commit: string): Promise<Revision> {
  const raw = (await git(repo, ['show', '-s', '--format=%H%x00%P%x00%an%x00%ae%x00%cn%x00%ce%x00%cI%x00%B', commit])).output.toString('utf8')
  const fields = raw.split('\0')
  if (fields.length !== 8 || fields[7].length > 10000) throw new TopicError(422, 'Commit metadata is invalid or too large')
  return { commit: fields[0], parent_commit: fields[1].split(' ')[0] || null, author_name: fields[2], author_email: fields[3], committer_name: fields[4], committer_email: fields[5], committed_at: fields[6], message: fields[7].trim() }
}

function persistJournal(event: Publication): void {
  const dir = join(resolve(getConfig().topics.repos_dir), 'journals')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const destination = journalPath(event.topic_id)
  const temp = `${destination}.${event.id}.tmp`
  const fd = openSync(temp, 'wx', 0o600)
  try { writeFileSync(fd, JSON.stringify(event)); fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temp, destination)
  const folder = openSync(dir, 'r')
  try { fsyncSync(folder) } finally { closeSync(folder) }
}

function publish(event: Publication): void {
  const db = getDatabase()
  db.transaction((tx) => {
    const current = tx.select().from(schema.topics).where(eq(schema.topics.id, event.topic_id)).get()
    if (!current) throw new TopicError(404, 'Topic not found')
    if (current.published_commit === event.new_commit) return
    if (current.published_commit !== event.old_commit) throw new TopicError(409, 'Topic publication state changed; recovery is required')
    const userExists = tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, event.user_id)).get()
    tx.insert(schema.topicPushes).values({ id: event.id, topic_id: event.topic_id, user_id: userExists ? event.user_id : null, uploader_user_id: event.user_id, token_id: event.token_id, uploader_name: event.uploader_name, old_commit: event.old_commit, new_commit: event.new_commit, pushed_at: event.pushed_at }).onConflictDoNothing().run()
    let sequence = tx.select({ next: sql<number>`coalesce(max(${schema.topicVersions.sequence}), -1) + 1` }).from(schema.topicVersions).where(eq(schema.topicVersions.topic_id, event.topic_id)).get()!.next
    for (const v of event.versions) tx.insert(schema.topicVersions).values({ ...v, topic_id: event.topic_id, push_id: event.id, sequence: sequence++ }).onConflictDoNothing().run()
    for (const row of event.reference_allocations ?? []) tx.insert(schema.topicReferences).values(row).onConflictDoNothing().run()
    rebuildTopicIndex(event.topic_id, event.snapshot, tx as unknown as ReturnType<typeof getDatabase>)
    tx.update(schema.topics).set({ title: event.snapshot.topic.title, description: event.snapshot.topic.description, snapshot: JSON.stringify(event.snapshot), published_commit: event.new_commit, references_indexed_commit: event.new_commit, updated_at: event.pushed_at }).where(eq(schema.topics.id, event.topic_id)).run()
  })
}

/** Runs under the per-Topic mutation lock. Website snapshots remain readable on recovery failure. */
export async function reconcileTopic(topicId: number): Promise<void> {
  const topic = getDatabase().select().from(schema.topics).where(eq(schema.topics.id, topicId)).get()
  if (!topic) throw new TopicError(404, 'Topic not found')
  const repo = topicRepoPath(topicId)
  if (!existsSync(repo)) throw new TopicError(503, 'Topic repository is unavailable')
  const current = await head(repo)
  const path = journalPath(topicId)
  if (current === topic.published_commit) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  if (!existsSync(path)) throw new TopicError(503, 'Topic indexing needs recovery; publication journal is missing')
  const event = JSON.parse(readFileSync(path, 'utf8')) as Publication
  if (event.topic_id !== topicId || event.new_commit !== current || event.old_commit !== topic.published_commit) throw new TopicError(503, 'Topic publication journal does not match its repository')
  // Re-read immutable authoritative content; journal preserves authentication identity, not content authority.
  event.snapshot = await readTopicCommit(topicId, event.new_commit)
  if (!event.reference_allocations) {
    await backfillTopicReferences(topicId)
    const planner = createReferencePlanner(topicId)
    for (const v of event.versions) planner.add({ commit: v.commit, snapshot: await readTopicCommit(topicId, v.commit), added_at: event.pushed_at })
    event.reference_allocations = planner.allocations
  }
  publish(event)
  unlinkSync(path)
}

export async function initializeTopicRepo(topicId: number, snapshot: TopicSnapshot, identity: PushIdentity, options: TopicCommitOptions = {}): Promise<void> {
  snapshot = parseTopicFiles(topicFiles(snapshot), getConfig().topics.max_file_bytes)
  const root = resolve(getConfig().topics.repos_dir)
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const repo = topicRepoPath(topicId)
  await git(null, ['init', '--bare', '--template=', '--initial-branch=main', repo])
  const files = { ...topicFiles(snapshot), 'README.md': '# Topic repository\n\nResearch documents live under pages/. Read AGENTS.md for maintenance instructions and use your own Topic token for MCP and Git.\nOther repository files can be agent workspace content; the website does not execute them. Keep credentials and large media outside Git.\n' }
  const tree = new Map<string, TreeBlob>()
  for (const [name, text] of Object.entries(files)) {
    const oid = (await git(repo, ['hash-object', '-w', '--stdin'], text)).output.toString().trim()
    tree.set(name, { hash: oid, mode: '100644' })
  }
  const treeId = await buildTree(repo, tree)
  const commit = (await git(repo, ['commit-tree', treeId], options.message ?? 'Initialize Topic\n', undefined, undefined, { GIT_AUTHOR_NAME: options.author_name ?? 'Paperland', GIT_AUTHOR_DATE: options.author_date })).output.toString().trim()
  const event: Publication = { id: randomUUID(), topic_id: topicId, user_id: identity.user_id, token_id: identity.token_id, uploader_name: identity.display_name, old_commit: null, new_commit: commit, pushed_at: new Date().toISOString(), versions: [{ ...await revision(repo, commit), legacy_research_step_id: options.legacy_research_step_id ?? null }], snapshot }
  event.reference_allocations = planTopicReferences(topicId, [{ commit, snapshot, added_at: event.pushed_at }])
  persistJournal(event)
  await git(repo, ['update-ref', 'refs/heads/main', commit, '0'.repeat(40)])
  afterAdvanceForTesting?.()
  publish(event)
  unlinkSync(journalPath(topicId))
}

/** Controlled server-side write, called under the Topic lock (or the offline migration lock). */
export async function commitTopicFiles(topicId: number, baseCommit: string, replacements: Record<string, string | Uint8Array | { copy_from: string } | null>, identity: PushIdentity, options: TopicCommitOptions = {}): Promise<string> {
  const repo = topicRepoPath(topicId)
  const current = getDatabase().select().from(schema.topics).where(eq(schema.topics.id, topicId)).get()
  if (!current || current.published_commit !== baseCommit || await head(repo) !== baseCommit) throw new TopicError(409, 'Topic changed; reload before updating')
  const entries = new Map<string, TreeBlob>()
  const tree = (await git(repo, ['ls-tree', '-r', '-z', baseCommit])).output.toString().split('\0').filter(Boolean)
  for (const row of tree) {
    const match = row.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/)
    if (!match) throw new TopicError(422, 'Unsupported Topic tree')
    entries.set(match[3], { hash: match[2], mode: match[1] as TreeBlob['mode'] })
  }
  const originalEntries = new Map(entries)
  for (const [name, text] of Object.entries(replacements)) {
    requireSafeTopicPath(name)
    if (text === null) { entries.delete(name); continue }
    if (typeof text === 'object' && 'copy_from' in text) {
      requireSafeTopicPath(text.copy_from)
      const blob = originalEntries.get(text.copy_from)
      if (!blob) throw new TopicError(422, `Copy source does not exist: ${text.copy_from}`)
      entries.set(name, blob); continue
    }
    if ((typeof text === 'string' ? Buffer.byteLength(text) : text.byteLength) > getConfig().topics.max_file_bytes) throw new TopicError(422, 'Topic file exceeds its limit')
    entries.set(name, { hash: (await git(repo, ['hash-object', '-w', '--stdin'], text)).output.toString().trim(), mode: '100644' })
  }
  const treeId = await buildTree(repo, entries)
  const commit = (await git(repo, ['commit-tree', treeId, '-p', baseCommit], options.message ?? 'Update Topic\n', undefined, undefined, { GIT_AUTHOR_NAME: options.author_name ?? 'Paperland', GIT_AUTHOR_DATE: options.author_date })).output.toString().trim()
  const snapshot = await readTopicCommit(topicId, commit)
  if (current.snapshot && JSON.parse(current.snapshot).topic.format_version === 2 && snapshot.topic.format_version !== 2) throw new TopicError(422, 'Repository format cannot downgrade; use pages/report.md')
  const event: Publication = { id: randomUUID(), topic_id: topicId, user_id: identity.user_id, token_id: identity.token_id, uploader_name: identity.display_name, old_commit: baseCommit, new_commit: commit, pushed_at: new Date().toISOString(), versions: [{ ...await revision(repo, commit), legacy_research_step_id: options.legacy_research_step_id ?? null }], snapshot }
  event.reference_allocations = planTopicReferences(topicId, [{ commit, snapshot, added_at: event.pushed_at }])
  persistJournal(event)
  await git(repo, ['update-ref', 'refs/heads/main', commit, baseCommit])
  afterAdvanceForTesting?.()
  publish(event); unlinkSync(journalPath(topicId))
  return commit
}

function packet(text: string): Buffer {
  return Buffer.from((Buffer.byteLength(text) + 4).toString(16).padStart(4, '0') + text)
}
export async function topicGitAdvertisement(topicId: number, service: string, protocol?: string): Promise<Buffer> {
  if (!['git-upload-pack', 'git-receive-pack'].includes(service)) throw new TopicError(400, 'Unsupported Git service')
  const output = (await git(topicRepoPath(topicId), [service.slice(4), '--stateless-rpc', '--advertise-refs', '.'], undefined, undefined, protocol)).output
  return Buffer.concat([packet(`# service=${service}\n`), Buffer.from('0000'), output])
}

/** Test seam simulates an interruption after main advances, before SQLite publication. */
let afterAdvanceForTesting: (() => void) | undefined
export function setTopicPublicationFaultForTesting(fn?: () => void): void { afterAdvanceForTesting = fn }

export async function topicGitRpc(topicId: number, service: string, input: Buffer, identity: PushIdentity, reauthorize: () => void, protocol?: string): Promise<Buffer> {
  const config = getConfig().topics
  if (input.length > config.max_push_bytes) throw new TopicError(413, 'Git request is too large')
  const repo = topicRepoPath(topicId)
  if (service === 'git-upload-pack') return (await git(repo, ['upload-pack', '--stateless-rpc', '.'], input, undefined, protocol)).output
  if (service !== 'git-receive-pack') throw new TopicError(400, 'Unsupported Git service')
  const stageRoot = join(resolve(config.repos_dir), 'staging')
  mkdirSync(stageRoot, { recursive: true, mode: 0o700 })
  const stage = mkdtempSync(join(stageRoot, `${topicId}-`))
  try {
    const oldCommit = await head(repo)
    if (!oldCommit) throw new TopicError(503, 'Topic repository is not initialized')
    await git(null, ['clone', '--bare', '--shared', '--template=', repo, stage])
    const output = (await git(stage, ['receive-pack', '--stateless-rpc', '.'], input, undefined, protocol)).output
    const refs = (await git(stage, ['for-each-ref', '--format=%(refname)'])).output.toString().trim().split('\n')
    if (refs.length !== 1 || refs[0] !== 'refs/heads/main') throw new TopicError(422, 'Only the main branch may be updated; extra refs are not accepted')
    const newCommit = await head(stage)
    if (!newCommit) throw new TopicError(422, 'The main branch cannot be deleted')
    if (newCommit === oldCommit) return output // Native receive-pack already reports stale/non-fast-forward rejection.
    const ancestor = await git(stage, ['merge-base', '--is-ancestor', oldCommit, newCommit], undefined, [0, 1])
    if (ancestor.code !== 0) throw new TopicError(409, 'History rewrites are not allowed; pull and merge before pushing')
    const commits = (await git(stage, ['rev-list', '--reverse', '--topo-order', `${oldCommit}..${newCommit}`])).output.toString().trim().split('\n').filter(Boolean)
    if (commits.length > config.max_commits_per_push) throw new TopicError(422, 'Too many commits in one push')
    let snapshot!: TopicSnapshot
    const versions: Revision[] = []
    const referencePlanner = createReferencePlanner(topicId)
    const pushedAt = new Date().toISOString()
    let format = JSON.parse(getDatabase().select().from(schema.topics).where(eq(schema.topics.id, topicId)).get()!.snapshot!).topic.format_version
    for (const commit of commits) {
      snapshot = await readTopicCommit(topicId, commit, stage)
      if (format === 2 && snapshot.topic.format_version !== 2) throw new TopicError(422, 'Repository format cannot downgrade; use pages/report.md')
      format = snapshot.topic.format_version
      for (const entry of snapshot.list.papers) if (entry.paper_id != null && !getDatabase().select({ id: schema.papers.id }).from(schema.papers).where(eq(schema.papers.id, entry.paper_id)).get()) throw new TopicError(422, `Paper ${entry.paper_id} does not exist; use an external Semantic Scholar entry instead`)
      versions.push(await revision(stage, commit))
      referencePlanner.add({ commit, snapshot, added_at: pushedAt })
    }
    reauthorize()
    const event: Publication = { id: randomUUID(), topic_id: topicId, user_id: identity.user_id, token_id: identity.token_id, uploader_name: identity.display_name, old_commit: oldCommit, new_commit: newCommit, pushed_at: pushedAt, versions, snapshot, reference_allocations: referencePlanner.allocations }
    persistJournal(event)
    await git(repo, ['fetch', '--no-tags', '--no-write-fetch-head', stage, 'refs/heads/main'])
    await git(repo, ['update-ref', 'refs/heads/main', newCommit, oldCommit])
    afterAdvanceForTesting?.()
    publish(event)
    unlinkSync(journalPath(topicId))
    return output
  } finally { rmSync(stage, { recursive: true, force: true }) }
}

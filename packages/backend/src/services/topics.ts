import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { CreatePaperRequest, ResearchSeed, TopicDefaultAccess, TopicDetail, TopicRole, TopicSnapshot, TopicSummary, TopicVersion } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { canViewOwnedRow, type Viewer } from '../auth/visibility.js'
import { requireTopicAccess, topicAccessRole } from './topic_access.js'
import { completeCallCounts } from './mcp_counts.js'
import { parseTopicFiles, topicAncestors, topicFiles, TopicError } from './topic_format.js'
import { commitTopicFiles, hasTopicPublicationJournal, initializeTopicRepo, readTopicCommit, reconcileTopic } from './topic_git.js'
import { withTopicLock } from './topic_lock.js'
import { refreshTopicPaperBindings, resolveTopicPaper } from './topic_index.js'
import { createPaperForUser } from './paper_actions.js'
import { parseS2Input } from '../utils/s2_ids.js'
import { addToLibrary, libraryIds } from './user_library.js'
import { updatePaperFields } from './paper_actions.js'
import { topicReferenceInfo } from './topic_references.js'
import { topicHomePath } from './topic_paths.js'
import { QUESTIONS_PATH } from './topic_documents.js'
import { TOPIC_AGENT_GUIDE } from './topic_layout.js'
import { topicArxivId } from './topic_paper_source.js'

export function topicId(value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new TopicError(404, 'Topic not found')
  return Number(value)
}
export function scopedTopicId(value: unknown, credentialTopicId?: number): number {
  const id = topicId(value ?? credentialTopicId)
  if (credentialTopicId != null && id !== credentialTopicId) throw new TopicError(404, 'Topic not found')
  return id
}
function activeUser(userId: number) {
  const user = getDatabase().select().from(schema.users).where(and(eq(schema.users.id, userId), eq(schema.users.status, 'active'))).get()
  if (!user) throw new TopicError(401, 'Active user required')
  return user
}
function summary(topic: typeof schema.topics.$inferSelect, permission: string): TopicSummary {
  const owner = getDatabase().select({ username: schema.users.username, nickname: schema.users.nickname }).from(schema.users).where(eq(schema.users.id, topic.owner_id)).get()
  return { id: topic.id, owner_id: topic.owner_id, owner_display_name: owner?.nickname || owner?.username || 'Former user', title: topic.title, description: topic.description, permission: permission as TopicRole, default_access: topic.default_access as TopicDefaultAccess, published_commit: topic.published_commit, created_at: topic.created_at, updated_at: topic.updated_at, legacy_research_session_id: topic.legacy_research_session_id }
}

export function listTopics(userId: number, scope = 'all', credentialTopicId?: number): TopicSummary[] {
  activeUser(userId)
  return getDatabase().select({ topic: schema.topics, role: topicAccessRole(userId) }).from(schema.topics)
    .where(and(isNotNull(topicAccessRole(userId)), isNotNull(schema.topics.published_commit), sql`(${schema.topics.legacy_migration_state} is null or ${schema.topics.legacy_migration_state} = 'complete')`, scope === 'mine' ? eq(schema.topics.owner_id, userId) : undefined, credentialTopicId != null ? eq(schema.topics.id, credentialTopicId) : undefined))
    .orderBy(desc(schema.topics.updated_at), desc(schema.topics.id)).all().map((r) => summary(r.topic, r.role!))
}

export function topicSeedPreview(resultId: number, viewer: Viewer): ResearchSeed {
  const db = getDatabase()
  const result = db.select().from(schema.qaResults).where(and(eq(schema.qaResults.id, resultId), isNull(schema.qaResults.deleted_at), eq(schema.qaResults.status, 'done'))).get()
  if (!result) throw new TopicError(404, 'Q&A answer not found')
  const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get()
  if (!entry || (entry.type !== 'template' && !canViewOwnedRow(viewer, entry.user_id, 'qa'))) throw new TopicError(404, 'Q&A answer not found')
  const paper = db.select().from(schema.papers).where(eq(schema.papers.id, entry.paper_id)).get()
  return { paper_id: entry.paper_id, paper_title: paper?.title || '', qa_entry_id: entry.id, qa_result_id: result.id, question: entry.prompt ?? result.prompt, answer: result.answer, model_name: result.model_name }
}

export async function createTopic(userId: number, input: { title: string; description?: string; seed_result_id?: number; default_access?: TopicDefaultAccess }, origin = ''): Promise<TopicDetail> {
  const user = activeUser(userId)
  if (input.default_access !== undefined && !['none', 'viewer', 'editor'].includes(input.default_access)) throw new TopicError(422, 'Default access must be none, viewer or editor')
  let snapshot: TopicSnapshot = { topic: { format_version: 2, title: input.title, description: input.description ?? '' }, report: '', agent_instructions: TOPIC_AGENT_GUIDE, list: { format_version: 1, directories: [], papers: [] } }
  snapshot.pages = { [QUESTIONS_PATH]: '---\ntitle: Research questions\nfonticon: CircleHelp\nreferences: []\n---\n# Research questions\n' }
  if (input.seed_result_id != null) {
    const seed = topicSeedPreview(input.seed_result_id, user)
    snapshot.report = `# ${input.title}\n\n${seed.question}\n\n${seed.answer}\n\n[Source Q&A](paperland://paper/${seed.paper_id}?qa=${seed.qa_entry_id}&result=${seed.qa_result_id})\n`
    snapshot.list.papers.push({ id: 'source-paper', reference_number: 1, title: seed.paper_title || `Paper ${seed.paper_id}`, paper_id: seed.paper_id, directory_ids: [], comment: 'Source paper' })
  }
  snapshot = parseTopicFiles(topicFiles(snapshot), getConfig().topics.max_file_bytes)
  const now = new Date().toISOString(), db = getDatabase()
  const topic = db.transaction((tx) => {
    const row = tx.insert(schema.topics).values({ owner_id: userId, title: snapshot.topic.title, description: snapshot.topic.description, default_access: input.default_access ?? 'none', snapshot: JSON.stringify(snapshot), created_at: now, updated_at: now }).returning().get()
    tx.insert(schema.topicMembers).values({ topic_id: row.id, user_id: userId, role: 'owner' }).run()
    return row
  })
  await withTopicLock(topic.id, () => initializeTopicRepo(topic.id, snapshot, { user_id: userId, token_id: null, display_name: user.nickname || user.username }))
  return getTopic(topic.id, userId, undefined, origin)
}

export async function getTopic(id: number, userId: number, commit?: string, origin = ''): Promise<TopicDetail> {
  requireTopicAccess(id, userId)
  if (hasTopicPublicationJournal(id)) {
    await withTopicLock(id, async () => {
      try { await reconcileTopic(id) }
      catch (error) { console.error(`Topic ${id} pending recovery:`, (error as Error).message) }
    })
  }
  const access = requireTopicAccess(id, userId)
  if (!access.topic.published_commit || !access.topic.snapshot) throw new TopicError(503, 'Topic initialization is still recovering')
  const selected = commit || access.topic.published_commit
  if (!getDatabase().select().from(schema.topicVersions).where(and(eq(schema.topicVersions.topic_id, id), eq(schema.topicVersions.commit, selected))).get()) throw new TopicError(404, 'Topic version not found')
  const snapshot: TopicSnapshot = selected === access.topic.published_commit ? JSON.parse(access.topic.snapshot) : await readTopicCommit(id, selected)
  const counts = completeCallCounts(access.member.mcp_call_counts)
  const bindings = Object.fromEntries(snapshot.list.papers.map((entry) => [entry.id, resolveTopicPaper(entry)]))
  const inLibrary = libraryIds(userId, Object.values(bindings).filter((id): id is number => id != null))
  const referenceInfo = topicReferenceInfo(id, snapshot)
  referenceInfo.documents = referenceInfo.documents.map((doc) => ({ ...doc, url: `${origin}/topics/${id}${doc.slug ? '/' + doc.slug.split('/').map(encodeURIComponent).join('/') : ''}${commit ? '?version=' + selected : ''}` }))
  return {
    ...summary(access.topic, access.member.role), commit: selected, snapshot,
    home_page: topicHomePath(snapshot.topic.format_version),
    ...referenceInfo,
    paper_bindings: bindings,
    paper_in_library: Object.fromEntries(Object.entries(bindings).map(([entry, paperId]) => [entry, paperId != null && inLibrary.has(paperId)])),
    paper_importable: Object.fromEntries(snapshot.list.papers.map((entry) => [entry.id, !!bindings[entry.id] || !!entry.s2_id || !!topicArxivId(entry.url)])),
    git_url: `${origin}/topic-git/${id}.git`, mcp_url: `${origin}/mcp`, my_mcp_call_counts: counts,
    directories: snapshot.list.directories.map((d) => ({ ...d, depth: topicAncestors(d.id, snapshot.list.directories).length - 2 })),
  }
}

export async function renameTopic(id: number, userId: number, title: string, baseCommit: string): Promise<TopicDetail> {
  requireTopicAccess(id, userId, 'editor')
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 500) throw new TopicError(422, 'Topic name must contain 1 to 500 characters')
  await withTopicLock(id, async () => {
    await reconcileTopic(id)
    const { topic, user } = requireTopicAccess(id, userId, 'editor')
    if (baseCommit !== topic.published_commit) throw new TopicError(409, 'This Topic changed while you were editing. Refresh before saving the name again.')
    if (topic.title === title.trim()) return
    const snapshot: TopicSnapshot = JSON.parse(topic.snapshot!)
    await commitTopicFiles(id, baseCommit, { 'topic.json': JSON.stringify({ ...snapshot.topic, title: title.trim() }, null, 2) + '\n' }, { user_id: userId, token_id: null, display_name: user.nickname || user.username }, { message: 'Rename topic' })
  })
  return getTopic(id, userId)
}

export function topicHistory(id: number, userId: number, offset = 0, limit = 50) {
  requireTopicAccess(id, userId)
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new TopicError(422, 'Invalid history pagination')
  const db = getDatabase()
  const total = db.select({ count: sql<number>`count(*)` }).from(schema.topicVersions).where(eq(schema.topicVersions.topic_id, id)).get()!.count
  const rows = db.select({ version: schema.topicVersions, push: schema.topicPushes }).from(schema.topicVersions)
    .innerJoin(schema.topicPushes, eq(schema.topicPushes.id, schema.topicVersions.push_id)).where(eq(schema.topicVersions.topic_id, id))
    .orderBy(desc(schema.topicVersions.sequence)).limit(limit).offset(offset).all()
  const versions: TopicVersion[] = rows.map(({ version: v, push: p }) => ({ commit: v.commit, parent_commit: v.parent_commit, message: v.message, author_name: v.author_name, author_email: v.author_email, committer_name: v.committer_name, committer_email: v.committer_email, committed_at: v.committed_at, pushed_at: p.pushed_at, pushed_by_user_id: p.uploader_user_id || p.user_id, pushed_by_display_name: p.uploader_name }))
  return { versions, total, next_offset: offset + rows.length < total ? offset + rows.length : null }
}

// Injectable ingestion boundary: recurring tests never contact S2 or schedule a live service.
let importPaper = createPaperForUser
export function setTopicImporterForTesting(fn?: typeof createPaperForUser): void { importPaper = fn ?? createPaperForUser }
export async function importTopicEntry(id: number, userId: number, entryId: string, commit?: string) {
  const detail = await getTopic(id, userId, commit)
  const entry = detail.snapshot.list.papers.find((p) => p.id === entryId)
  if (!entry) throw new TopicError(404, 'Topic paper entry not found')
  const arxivId = topicArxivId(entry.url)
  if (entry.url && !arxivId) throw new TopicError(422, 'This entry is a reference link. Only Semantic Scholar or recognized arXiv paper entries can be imported.')
  const identifiers = entry.s2_id ? parseS2Input(entry.s2_id) : null
  const existingId = resolveTopicPaper(entry)
  let body: CreatePaperRequest
  if (existingId != null) {
    const existing = getDatabase().select().from(schema.papers).where(eq(schema.papers.id, existingId)).get()!
    // Already imported entries only need caller-library membership, with no external service work.
    if (existing.listed === 0) updatePaperFields(existing.id, { listed: true })
    addToLibrary(userId, existing.id)
    refreshTopicPaperBindings()
    return { paper_id: existing.id, created: false, in_library: true }
  } else if (identifiers) body = { ...identifiers, title: entry.title, authors: entry.authors, year: entry.year }
  else if (arxivId) body = { arxiv_id: arxivId, title: entry.title, authors: entry.authors ?? entry.citation?.author, year: entry.year ?? entry.citation?.year }
  else throw new TopicError(404, 'The original paper is unavailable')
  const result = await importPaper(userId, body)
  refreshTopicPaperBindings()
  return { paper_id: result.paper.id, created: result.created, in_library: true }
}

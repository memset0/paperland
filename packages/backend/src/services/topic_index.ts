import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import type { TopicPaper, TopicSnapshot, TopicTag } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { parseS2Input } from '../utils/s2_ids.js'
import { topicAncestors, TopicError } from './topic_format.js'
import { requireTopicAccess, topicAccessRole } from './topic_access.js'
import { topicArxivId } from './topic_paper_source.js'

type DB = ReturnType<typeof getDatabase>

export function resolveTopicPaper(entry: TopicPaper, db: DB = getDatabase()): number | null {
  if (entry.paper_id != null) return db.select({ id: schema.papers.id }).from(schema.papers).where(eq(schema.papers.id, entry.paper_id)).get()?.id ?? null
  if (entry.url) {
    const arxiv = topicArxivId(entry.url)
    return arxiv ? db.select({ id: schema.papers.id }).from(schema.papers).where(eq(schema.papers.arxiv_id, arxiv)).get()?.id ?? null : null
  }
  const key = parseS2Input(entry.s2_id || '')
  if (!key) return null
  const condition = key.s2_paper_id ? eq(schema.papers.s2_paper_id, key.s2_paper_id) : eq(schema.papers.corpus_id, key.corpus_id!)
  const paper = db.select({ id: schema.papers.id }).from(schema.papers).where(condition).get()
  if (paper) return paper.id
  const cached = db.select().from(schema.s2Papers).where(key.s2_paper_id ? eq(schema.s2Papers.s2_paper_id, key.s2_paper_id) : eq(schema.s2Papers.corpus_id, key.corpus_id!)).get()
  if (!cached) return null
  const keys = []
  if (cached.s2_paper_id) keys.push(eq(schema.papers.s2_paper_id, cached.s2_paper_id))
  if (cached.corpus_id) keys.push(eq(schema.papers.corpus_id, cached.corpus_id))
  if (cached.arxiv_id) keys.push(eq(schema.papers.arxiv_id, cached.arxiv_id))
  return keys.length ? db.select({ id: schema.papers.id }).from(schema.papers).where(or(...keys)).get()?.id ?? null : null
}

/** Called inside publication's transaction: only this Topic's generated rows are replaced. */
export function rebuildTopicIndex(topicId: number, snapshot: TopicSnapshot, db: DB = getDatabase()): void {
  db.delete(schema.topicPapers).where(eq(schema.topicPapers.topic_id, topicId)).run()
  db.delete(schema.topicNodes).where(eq(schema.topicNodes.topic_id, topicId)).run()
  db.insert(schema.topicNodes).values({ topic_id: topicId, node_id: 'root', parent_id: null, name: snapshot.topic.title, position: -1 }).run()
  for (const [position, dir] of snapshot.list.directories.entries()) db.insert(schema.topicNodes).values({ topic_id: topicId, node_id: dir.id, parent_id: dir.parent_id ?? 'root', name: dir.name, position }).run()
  for (const entry of snapshot.list.papers) {
    const nodes = new Set(['root', ...entry.directory_ids.flatMap((id) => topicAncestors(id, snapshot.list.directories))])
    const paperId = resolveTopicPaper(entry, db)
    for (const nodeId of nodes) db.insert(schema.topicPapers).values({ topic_id: topicId, node_id: nodeId, entry_id: entry.id, paper_id: paperId, s2_id: entry.s2_id ?? null }).run()
  }
}

/** An explicit import may enrich current bindings without changing committed content. */
export function refreshTopicPaperBindings(topicId?: number): void {
  const db = getDatabase()
  db.transaction((tx) => {
    const entries = tx.selectDistinct({ topic_id: schema.topicPapers.topic_id, entry_id: schema.topicPapers.entry_id, s2_id: schema.topicPapers.s2_id }).from(schema.topicPapers).where(and(isNotNull(schema.topicPapers.s2_id), topicId === undefined ? undefined : eq(schema.topicPapers.topic_id, topicId))).all()
    for (const entry of entries) {
      const paperId = resolveTopicPaper({ id: entry.entry_id, title: '', s2_id: entry.s2_id!, directory_ids: [], comment: '' }, tx as unknown as DB)
      tx.update(schema.topicPapers).set({ paper_id: paperId }).where(and(eq(schema.topicPapers.topic_id, entry.topic_id), eq(schema.topicPapers.entry_id, entry.entry_id))).run()
    }
    // URL identities stay pinned in Git; explicit import may enrich canonical site availability.
    for (const topic of tx.select({ id: schema.topics.id, snapshot: schema.topics.snapshot }).from(schema.topics).where(and(isNotNull(schema.topics.snapshot), topicId === undefined ? undefined : eq(schema.topics.id, topicId))).all()) {
      const snapshot = JSON.parse(topic.snapshot!) as TopicSnapshot
      for (const entry of snapshot.list.papers.filter((p) => !!topicArxivId(p.url))) {
        const paperId = resolveTopicPaper(entry, tx as unknown as DB)
        tx.update(schema.topicPapers).set({ paper_id: paperId }).where(and(eq(schema.topicPapers.topic_id, topic.id), eq(schema.topicPapers.entry_id, entry.id))).run()
      }
    }
  })
}

export function topicTagsByPapers(paperIds: number[], userId: number | null): Map<number, TopicTag[]> {
  const result = new Map<number, TopicTag[]>()
  if (userId == null || paperIds.length === 0) return result
  const rows = getDatabase().selectDistinct({ paper_id: schema.topicPapers.paper_id, topic_id: schema.topics.id, name: schema.topics.title })
    .from(schema.topicPapers).innerJoin(schema.topics, eq(schema.topics.id, schema.topicPapers.topic_id))
    .where(and(inArray(schema.topicPapers.paper_id, paperIds), eq(schema.topicPapers.node_id, 'root'), isNotNull(topicAccessRole(userId)), or(isNull(schema.topics.legacy_migration_state), eq(schema.topics.legacy_migration_state, 'complete')))).all()
  for (const row of rows) {
    const badges = result.get(row.paper_id!) ?? []
    badges.push({ topic_id: row.topic_id, node_id: 'root', name: row.name }); result.set(row.paper_id!, badges)
  }
  return result
}

export function topicPaperFilter(topicId: number, nodeId: string, userId: number) {
  requireTopicAccess(topicId, userId)
  const db = getDatabase()
  if (!db.select().from(schema.topicNodes).where(and(eq(schema.topicNodes.topic_id, topicId), eq(schema.topicNodes.node_id, nodeId))).get()) throw new TopicError(404, 'Topic directory not found')
  return inArray(schema.papers.id, db.select({ id: schema.topicPapers.paper_id }).from(schema.topicPapers)
    .where(and(eq(schema.topicPapers.topic_id, topicId), eq(schema.topicPapers.node_id, nodeId), isNotNull(schema.topicPapers.paper_id))))
}

import { eq } from 'drizzle-orm'
import type { TopicPaper, TopicSnapshot } from '@paperland/shared'
import { getDatabase, schema } from '../db/index.js'
import { TopicError } from './topic_format.js'
import { topicDocuments } from './topic_documents.js'

export type ReferenceAllocation = typeof schema.topicReferences.$inferSelect
export interface ReferenceVersion { commit: string; snapshot: TopicSnapshot; added_at: string }
export function referenceSource(entry: TopicPaper): string {
  return entry.paper_id != null ? `paper:${entry.paper_id}` : entry.s2_id ? `s2:${entry.s2_id}` : `url:${entry.url}`
}
export function referenceRegistry(topicId: number): ReferenceAllocation[] {
  return getDatabase().select().from(schema.topicReferences).where(eq(schema.topicReferences.topic_id, topicId)).all()
}

/** Pure planning atop persisted reservations; prepared before Git advances and journaled. */
export function planTopicReferences(topicId: number, versions: ReferenceVersion[]): ReferenceAllocation[] {
  const planner = createReferencePlanner(topicId)
  for (const version of versions) planner.add(version)
  return planner.allocations
}

/** Validate intermediate versions incrementally; do not retain every page snapshot in a push. */
export function createReferencePlanner(topicId: number) {
  const previous = referenceRegistry(topicId), registry = new Map(previous.map((r) => [r.entry_id, r]))
  let next = previous.reduce((max, r) => Math.max(max, r.reference_number), 0) + 1
  const allocations: ReferenceAllocation[] = []
  function add(version: ReferenceVersion) {
    const numbers: Record<string, number> = {}
    for (const entry of version.snapshot.list.papers) {
      let found = registry.get(entry.id)
      if (!found) {
        if (entry.reference_number != null && entry.reference_number !== next) throw new TopicError(422, `New entry ${entry.id} must use the next reference number ${next}`)
        found = { topic_id: topicId, entry_id: entry.id, reference_number: next++, source_key: referenceSource(entry), first_commit: version.commit, added_at: version.added_at }
        registry.set(entry.id, found); allocations.push(found)
      }
      if (entry.reference_number != null && found.reference_number !== entry.reference_number) throw new TopicError(422, `Reference number for ${entry.id} must remain ${found.reference_number}`)
      if (found.source_key !== referenceSource(entry)) throw new TopicError(422, `Reference ${found.reference_number} cannot be reassigned to another source; add a new entry ID`)
      numbers[entry.id] = found.reference_number
    }
    topicDocuments(version.snapshot, numbers)
  }
  return { allocations, add }
}

export function topicReferenceInfo(topicId: number, snapshot: TopicSnapshot) {
  const registry = referenceRegistry(topicId), lookup = new Map(registry.map((r) => [r.entry_id, r.reference_number]))
  const numbers = Object.fromEntries(snapshot.list.papers.map((p) => {
    const number = lookup.get(p.id)
    if (!number) throw new TopicError(503, 'Topic reference numbering needs recovery')
    return [p.id, number]
  }))
  return { reference_numbers: numbers, next_reference_number: registry.reduce((max, r) => Math.max(max, r.reference_number), 0) + 1, documents: topicDocuments(snapshot, numbers) }
}

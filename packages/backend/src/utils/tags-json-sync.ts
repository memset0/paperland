import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'

/**
 * Rebuild tags_json for a single paper from paper_tags + tags tables.
 */
export function syncPaperTagsJson(paperId: number): void {
  const db = getDatabase()
  const rows = db.select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.paperTags)
    .innerJoin(schema.tags, eq(schema.paperTags.tag_id, schema.tags.id))
    .where(eq(schema.paperTags.paper_id, paperId))
    .all()

  const json = JSON.stringify(rows.map(r => ({ id: r.id, name: r.name })))
  db.update(schema.papers)
    .set({ tags_json: json })
    .where(eq(schema.papers.id, paperId))
    .run()
}

/**
 * Rebuild tags_json for ALL papers associated with a given tag_id.
 * Used after rename, merge, or delete operations on a tag.
 */
export function syncTagsJsonForTag(tagId: number): void {
  const db = getDatabase()
  const paperIds = db.select({ paper_id: schema.paperTags.paper_id })
    .from(schema.paperTags)
    .where(eq(schema.paperTags.tag_id, tagId))
    .all()
    .map(r => r.paper_id)

  for (const paperId of paperIds) {
    syncPaperTagsJson(paperId)
  }
}

/**
 * Rebuild tags_json for a list of specific paper IDs.
 */
export function syncTagsJsonForPapers(paperIds: number[]): void {
  for (const paperId of paperIds) {
    syncPaperTagsJson(paperId)
  }
}

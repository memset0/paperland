import { eq, and, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { randomTagColor } from './tag-colors.js'

type DB = ReturnType<typeof getDatabase>
export type TagInfo = { id: number; name: string; color: string }

/** Find a tag by name within a user's tag set, creating it if missing. */
export function findOrCreateUserTag(db: DB, userId: number, name: string) {
  let tag = db.select().from(schema.tags)
    .where(and(eq(schema.tags.user_id, userId), eq(schema.tags.name, name)))
    .get()
  if (!tag) {
    tag = db.insert(schema.tags)
      .values({ user_id: userId, name, color: randomTagColor() })
      .returning().get()
  }
  return tag
}

/** Find a tag by name within a user's tag set (no creation). */
export function findUserTagByName(db: DB, userId: number, name: string) {
  return db.select().from(schema.tags)
    .where(and(eq(schema.tags.user_id, userId), eq(schema.tags.name, name)))
    .get()
}

/** The current user's tags applied to a paper ([] for anonymous). */
export function userTagsForPaper(db: DB, paperId: number, userId: number | null): TagInfo[] {
  if (userId == null) return []
  return db.select({ id: schema.tags.id, name: schema.tags.name, color: schema.tags.color })
    .from(schema.paperTags)
    .innerJoin(schema.tags, eq(schema.paperTags.tag_id, schema.tags.id))
    .where(and(eq(schema.paperTags.paper_id, paperId), eq(schema.tags.user_id, userId)))
    .all()
}

/** Map of paperId → current user's tags, for a batch of papers ([] for anonymous). */
export function userTagsByPapers(db: DB, paperIds: number[], userId: number | null): Map<number, TagInfo[]> {
  const map = new Map<number, TagInfo[]>()
  if (userId == null || paperIds.length === 0) return map
  const rows = db.select({
    paper_id: schema.paperTags.paper_id,
    id: schema.tags.id,
    name: schema.tags.name,
    color: schema.tags.color,
  })
    .from(schema.paperTags)
    .innerJoin(schema.tags, eq(schema.paperTags.tag_id, schema.tags.id))
    .where(and(inArray(schema.paperTags.paper_id, paperIds), eq(schema.tags.user_id, userId)))
    .all()
  for (const r of rows) {
    const list = map.get(r.paper_id) || []
    list.push({ id: r.id, name: r.name, color: r.color })
    map.set(r.paper_id, list)
  }
  return map
}

/** Remove only the current user's tag associations from a paper (other users untouched). */
export function clearUserPaperTags(db: DB, paperId: number, userId: number): void {
  const userTagIds = db.select({ id: schema.tags.id }).from(schema.tags)
    .where(eq(schema.tags.user_id, userId)).all().map(t => t.id)
  if (userTagIds.length === 0) return
  db.delete(schema.paperTags)
    .where(and(eq(schema.paperTags.paper_id, paperId), inArray(schema.paperTags.tag_id, userTagIds)))
    .run()
}

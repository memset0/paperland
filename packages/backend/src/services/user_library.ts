import { and, eq, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { ingestPaper } from './ingest_paper.js'

// Personal paper library: the user's private view over the shared `papers` table, stored in
// `user_papers` (see schema). A paper is "in the library" when its row has in_library = 1.

/** Put a paper in the user's library (upsert; idempotent). */
export function addToLibrary(userId: number, paperId: number): void {
  const now = new Date().toISOString()
  getDatabase().insert(schema.userPapers)
    .values({ user_id: userId, paper_id: paperId, in_library: 1, created_at: now, updated_at: now })
    .onConflictDoUpdate({
      target: [schema.userPapers.user_id, schema.userPapers.paper_id],
      set: { in_library: 1, updated_at: now },
    })
    .run()
}

/** Take a paper out of the user's library. Keeps the row (and all other user data on the paper). */
export function removeFromLibrary(userId: number, paperId: number): void {
  getDatabase().update(schema.userPapers)
    .set({ in_library: 0, updated_at: new Date().toISOString() })
    .where(and(eq(schema.userPapers.user_id, userId), eq(schema.userPapers.paper_id, paperId)))
    .run()
}

/** Which of `paperIds` are in the user's library (empty set for anonymous / no ids). */
export function libraryIds(userId: number | null, paperIds: number[]): Set<number> {
  if (userId == null || paperIds.length === 0) return new Set()
  const rows = getDatabase().select({ paper_id: schema.userPapers.paper_id }).from(schema.userPapers)
    .where(and(
      eq(schema.userPapers.user_id, userId),
      eq(schema.userPapers.in_library, 1),
      inArray(schema.userPapers.paper_id, paperIds),
    ))
    .all()
  return new Set(rows.map(r => r.paper_id))
}

function starterArxivId(): string {
  try { return getConfig().library.starter_arxiv_id.trim() } catch { return '1706.03762' }
}

/** Give a (new) user the starter paper, if it exists. */
export function addStarterPaper(userId: number): void {
  const arxivId = starterArxivId()
  if (!arxivId) return
  const paper = getDatabase().select({ id: schema.papers.id }).from(schema.papers)
    .where(eq(schema.papers.arxiv_id, arxivId)).get()
  if (paper) addToLibrary(userId, paper.id)
}

/**
 * Startup seeding: when the database has no papers at all, ingest the starter paper and put it in
 * every existing user's library. Returns the seeded paper id, or null when nothing was done.
 */
export async function seedStarterPaper(): Promise<number | null> {
  const arxivId = starterArxivId()
  if (!arxivId) return null
  const db = getDatabase()
  if (db.select({ id: schema.papers.id }).from(schema.papers).limit(1).get()) return null
  const { paper } = await ingestPaper({ arxiv_id: arxivId })
  for (const u of db.select({ id: schema.users.id }).from(schema.users).all()) addToLibrary(u.id, paper.id)
  return paper.id
}

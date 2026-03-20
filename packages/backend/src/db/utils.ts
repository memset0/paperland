import { eq } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { papers } from './schema.js'

export function touchPaperUpdatedAt(db: BunSQLiteDatabase, paperId: number): void {
  db.update(papers)
    .set({ updated_at: new Date().toISOString() })
    .where(eq(papers.id, paperId))
    .run()
}

/**
 * Extract paper ID from a highlight pathname like "/papers/42".
 * Returns null if the pathname doesn't match.
 */
export function parsePaperIdFromPathname(pathname: string): number | null {
  const match = pathname.match(/^\/papers\/(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

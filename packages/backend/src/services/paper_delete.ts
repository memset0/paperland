import { eq, inArray, like } from 'drizzle-orm'
import { getDatabase, getSqliteDatabase, schema } from '../db/index.js'
import { removeDoc2xArtifacts } from './doc2x_cli.js'
import { isActiveQAResultStatus, recomputeQAEntryState } from './qa_runtime.js'

/** Hard-delete a paper and everything hanging off it (web `DELETE /api/papers/:id` and MCP `delete_paper`). */
export function deletePaperCascade(paper: Pick<typeof schema.papers.$inferSelect, 'id' | 'pdf_path'>): void {
  const db = getDatabase()
  const id = paper.id
  // Cascade delete in a transaction using raw sqlite
  const sqlite = getSqliteDatabase()
  const tx = sqlite.transaction(() => {
    // 1. Delete qa_results via qa_entries
    const entryIds = db.select({ id: schema.qaEntries.id }).from(schema.qaEntries).where(eq(schema.qaEntries.paper_id, id)).all().map(e => e.id)
    if (entryIds.length > 0) {
      const resultIds = db.select({ id: schema.qaResults.id }).from(schema.qaResults)
        .where(inArray(schema.qaResults.qa_entry_id, entryIds)).all().map((result) => result.id)
      if (resultIds.length > 0) {
        db.update(schema.highlights).set({ qa_result_id: null })
          .where(inArray(schema.highlights.qa_result_id, resultIds)).run()
      }
      db.delete(schema.qaResults).where(inArray(schema.qaResults.qa_entry_id, entryIds)).run()
    }
    // 2. Delete qa_entries
    db.delete(schema.qaEntries).where(eq(schema.qaEntries.paper_id, id)).run()
    // 3. Delete service_executions
    db.delete(schema.serviceExecutions).where(eq(schema.serviceExecutions.paper_id, id)).run()
    // 3b. Delete S2 citation graph
    db.delete(schema.paperCitations).where(eq(schema.paperCitations.paper_id, id)).run()
    // 4. Delete paper_tags
    db.delete(schema.paperTags).where(eq(schema.paperTags.paper_id, id)).run()
    // 4a. Delete per-user library rows
    db.delete(schema.userPapers).where(eq(schema.userPapers.paper_id, id)).run()
    // 4b. Delete per-user reference links
    db.delete(schema.paperReferenceLinks).where(eq(schema.paperReferenceLinks.paper_id, id)).run()
    // 5. Delete highlights by pdf_path pattern
    if (paper.pdf_path) {
      db.delete(schema.highlights).where(like(schema.highlights.pathname, `%${paper.pdf_path}%`)).run()
    }
    // 6. Delete the paper
    db.delete(schema.papers).where(eq(schema.papers.id, id)).run()
  })
  tx()
  removeDoc2xArtifacts(id)
}

export class QADeleteError extends Error {
  constructor(public status: 404 | 409, public code: 'NOT_FOUND' | 'RESULT_ACTIVE', message: string) { super(message) }
}

/**
 * Soft-delete a Q&A result (web `DELETE /api/qa/results/:id` and MCP `delete_qa_answer`): not while
 * active; free answers only by their owner (or an admin); template answers are shared.
 */
export function softDeleteQAResult(resultId: number, user: { id: number; role: string }): void {
  const db = getDatabase()
  const result = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, resultId)).get()
  if (!result || result.deleted_at) throw new QADeleteError(404, 'NOT_FOUND', 'QA result not found')
  if (isActiveQAResultStatus(result.status)) throw new QADeleteError(409, 'RESULT_ACTIVE', 'Cancel the active result before deleting it')
  const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get()
  if (entry && entry.type === 'free' && entry.user_id !== user.id && user.role !== 'admin') throw new QADeleteError(404, 'NOT_FOUND', 'QA result not found')
  // Soft delete: the row stays so follow-ups keep their history; every user-facing read skips it.
  const now = new Date().toISOString()
  db.update(schema.highlights).set({ qa_result_id: null }).where(eq(schema.highlights.qa_result_id, resultId)).run()
  db.update(schema.qaResults).set({ deleted_at: now, updated_at: now }).where(eq(schema.qaResults.id, resultId)).run()
  recomputeQAEntryState(db, result.qa_entry_id)
}

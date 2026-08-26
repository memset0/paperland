import type { Database } from 'bun:sqlite'
import { markdownContentHash } from '../services/content_hash.js'
import { parsePaperIdFromPathname } from './utils.js'

/** Idempotent application backfill for values SQLite cannot derive without an MD5 function. */
export function backfillQAReadingAttribution(sqlite: Database): { results: number; highlights: number } {
  const resultRows = sqlite.query('SELECT id, answer FROM qa_results WHERE content_hash IS NULL')
    .all() as Array<{ id: number; answer: string }>
  const updateResult = sqlite.query('UPDATE qa_results SET content_hash = ? WHERE id = ? AND content_hash IS NULL')

  const highlightRows = sqlite.query('SELECT id, pathname, content_hash FROM highlights WHERE qa_result_id IS NULL')
    .all() as Array<{ id: number; pathname: string; content_hash: string }>
  const findResults = sqlite.query(`
    SELECT r.id
    FROM qa_results r
    JOIN qa_entries e ON e.id = r.qa_entry_id
    WHERE e.paper_id = ? AND r.content_hash = ?
    ORDER BY r.id
    LIMIT 2
  `)
  const updateHighlight = sqlite.query('UPDATE highlights SET qa_result_id = ? WHERE id = ? AND qa_result_id IS NULL')

  let resultCount = 0
  let highlightCount = 0
  const tx = sqlite.transaction(() => {
    for (const row of resultRows) {
      const changed = updateResult.run(markdownContentHash(row.answer), row.id).changes
      resultCount += Number(changed)
    }
    for (const row of highlightRows) {
      const paperId = parsePaperIdFromPathname(row.pathname)
      if (paperId == null) continue
      const matches = findResults.all(paperId, row.content_hash) as Array<{ id: number }>
      if (matches.length !== 1) continue
      const changed = updateHighlight.run(matches[0].id, row.id).changes
      highlightCount += Number(changed)
    }
  })
  tx()

  return { results: resultCount, highlights: highlightCount }
}

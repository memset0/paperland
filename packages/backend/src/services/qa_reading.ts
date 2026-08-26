import { and, eq, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { markdownContentHash } from './content_hash.js'

export function extractPaperlandBlockHashes(body: string, paperId: number): string[] {
  const hashes: string[] = []
  const pattern = /paperland:\/\/paper\/(\d+)\?([^\s<>"')\]]+)/g
  for (const match of body.matchAll(pattern)) {
    if (Number(match[1]) !== paperId) continue
    const params = new URLSearchParams(match[2].replace(/&amp;/g, '&'))
    if (params.has('pdf')) continue
    const hash = params.get('h')
    if (hash) hashes.push(hash)
  }
  return hashes
}

export function loadQAReadingIndicators(
  db: ReturnType<typeof getDatabase>,
  userId: number | null,
  entries: Array<{ id: number; paper_id: number }>,
  resultsByEntry: Map<number, any[]>,
): { highlightByEntry: Map<number, number>; noteByEntry: Map<number, number> } {
  const highlightByEntry = new Map<number, number>()
  const noteByEntry = new Map<number, number>()
  if (userId == null || entries.length === 0) return { highlightByEntry, noteByEntry }

  const resultToEntry = new Map<number, number>()
  const hashEntriesByPaper = new Map<number, Map<string, Set<number>>>()
  for (const entry of entries) {
    let hashEntries = hashEntriesByPaper.get(entry.paper_id)
    if (!hashEntries) {
      hashEntries = new Map()
      hashEntriesByPaper.set(entry.paper_id, hashEntries)
    }
    for (const result of resultsByEntry.get(entry.id) || []) {
      // Active/failed partial answers do not have a stable content hash and cannot
      // safely participate in persisted highlights or note-anchor attribution.
      if (result.status && result.status !== 'done') continue
      resultToEntry.set(result.id, entry.id)
      const hash = result.content_hash || markdownContentHash(result.answer)
      const entryIds = hashEntries.get(hash) || new Set<number>()
      entryIds.add(entry.id)
      hashEntries.set(hash, entryIds)
    }
  }

  const resultIds = [...resultToEntry.keys()]
  if (resultIds.length > 0) {
    const highlights = db.select({ result_id: schema.highlights.qa_result_id })
      .from(schema.highlights)
      .where(and(
        eq(schema.highlights.user_id, userId),
        inArray(schema.highlights.qa_result_id, resultIds),
      ))
      .all()
    for (const highlight of highlights) {
      if (highlight.result_id == null) continue
      const entryId = resultToEntry.get(highlight.result_id)
      if (entryId != null) highlightByEntry.set(entryId, (highlightByEntry.get(entryId) || 0) + 1)
    }
  }

  const paperIds = [...new Set(entries.map((entry) => entry.paper_id))]
  const notes = db.select({ paper_id: schema.notes.paper_id, body: schema.notes.body })
    .from(schema.notes)
    .where(and(eq(schema.notes.user_id, userId), inArray(schema.notes.paper_id, paperIds)))
    .all()
  for (const note of notes) {
    const hashEntries = hashEntriesByPaper.get(note.paper_id)
    if (!hashEntries) continue
    for (const hash of extractPaperlandBlockHashes(note.body, note.paper_id)) {
      const entryIds = hashEntries.get(hash)
      if (!entryIds || entryIds.size !== 1) continue
      const entryId = entryIds.values().next().value as number
      noteByEntry.set(entryId, (noteByEntry.get(entryId) || 0) + 1)
    }
  }

  return { highlightByEntry, noteByEntry }
}

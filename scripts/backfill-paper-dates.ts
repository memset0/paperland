// One-off: fill metadata.published_at / modified_at on existing papers (run from the project root).
//   bun run scripts/backfill-paper-dates.ts [--dry-run]
// arXiv papers: <published>/<updated> from the arXiv API (id_list batches of 50, 3 s apart).
// Other papers: published_at from the s2_papers cache's publication_date.
// Never overwrites a date that is already set, so reruns are harmless. Makes live arXiv calls.
import { Database } from 'bun:sqlite'
import { resolve } from 'path'
import { loadConfig } from '../packages/backend/src/config.ts'
import { parseArxivDates } from '../packages/backend/src/services/arxiv_service.ts'

const BATCH = 50
const DELAY_MS = 3000
const dryRun = process.argv.includes('--dry-run')

const config = loadConfig()
const db = new Database(resolve(process.cwd(), config.database.path || './data/paperland.db'))

const setDate = db.query(`
  UPDATE papers SET metadata = json_set(coalesce(metadata, '{}'), '$.' || ?1, ?2)
  WHERE id = ?3 AND json_extract(coalesce(metadata, '{}'), '$.' || ?1) IS NULL
`)
let updated = 0
function fill(id: number, key: 'published_at' | 'modified_at', value: string | null) {
  if (!value) return false
  if (dryRun) return true
  return setDate.run(key, value, id).changes > 0
}

/** arXiv id without its version suffix, from an entry's <id> URL. */
function entryArxivId(entry: string): string | null {
  const url = entry.match(/<id>\s*([^<]+?)\s*<\/id>/)?.[1]
  const id = url?.split('/abs/')[1]
  return id ? id.replace(/v\d+$/, '') : null
}

const arxivRows = db.query(`
  SELECT id, arxiv_id FROM papers WHERE arxiv_id IS NOT NULL
    AND (json_extract(coalesce(metadata, '{}'), '$.published_at') IS NULL
      OR json_extract(coalesce(metadata, '{}'), '$.modified_at') IS NULL)
`).all() as { id: number; arxiv_id: string }[]
console.log(`arXiv papers missing dates: ${arxivRows.length}`)

for (let i = 0; i < arxivRows.length; i += BATCH) {
  const batch = arxivRows.slice(i, i + BATCH)
  const byId = new Map(batch.map((r) => [r.arxiv_id.replace(/v\d+$/, ''), r.id]))
  const url = `https://export.arxiv.org/api/query?id_list=${batch.map((r) => encodeURIComponent(r.arxiv_id)).join(',')}&max_results=${BATCH}`
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`batch ${i / BATCH + 1}: arXiv returned ${res.status}; skipped`)
  } else {
    const xml = await res.text()
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const aid = entryArxivId(m[1])
      const paperId = aid ? byId.get(aid) : undefined
      if (paperId == null) continue
      const { published, updated: modified } = parseArxivDates(m[1])
      const a = fill(paperId, 'published_at', published)
      const b = fill(paperId, 'modified_at', modified)
      if (a || b) updated++
    }
    console.log(`batch ${i / BATCH + 1}/${Math.ceil(arxivRows.length / BATCH)} done`)
  }
  if (i + BATCH < arxivRows.length) await Bun.sleep(DELAY_MS)
}

// Non-arXiv papers: the S2 cache's publication date, matched by S2 paperId or corpus id.
const s2Rows = db.query(`
  SELECT p.id, c.publication_date AS date FROM papers p
  JOIN s2_papers c ON (p.s2_paper_id IS NOT NULL AND c.s2_paper_id = p.s2_paper_id)
                   OR (p.corpus_id IS NOT NULL AND c.corpus_id = p.corpus_id)
  WHERE p.arxiv_id IS NULL AND c.publication_date IS NOT NULL
    AND json_extract(coalesce(p.metadata, '{}'), '$.published_at') IS NULL
`).all() as { id: number; date: string }[]
for (const r of s2Rows) if (fill(r.id, 'published_at', r.date)) updated++

console.log(`${dryRun ? '[dry run] would update' : 'updated'} ${updated} papers (${s2Rows.length} from the S2 cache)`)

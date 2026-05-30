/**
 * One-off data correction: un-list OpenReview-only papers.
 *
 * A paper is "OpenReview-only" when it is `listed=1` yet has one or more OpenReview
 * (conference_papers) links and no canonical source — no `arxiv_id`, no `corpus_id`,
 * and no `link` pointing at arxiv.org. Such papers cannot run the fetch pipeline and
 * were listed by a now-fixed bug (e.g. paper 217).
 *
 * Usage (run from the PROJECT ROOT so the DB path resolves correctly):
 *   bun run packages/backend/scripts/fix-openreview-only-listed.ts            # dry-run: list affected papers
 *   bun run packages/backend/scripts/fix-openreview-only-listed.ts --apply    # set listed=0 on them
 *   bun run packages/backend/scripts/fix-openreview-only-listed.ts --apply --db ./data/paperland.db
 */
import { Database } from 'bun:sqlite'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const dbIdx = args.indexOf('--db')
const dbPath = dbIdx >= 0 ? args[dbIdx + 1] : './data/paperland.db'

const db = apply
  ? new Database(dbPath, { readwrite: true, create: false })
  : new Database(dbPath, { readonly: true })

// OpenReview-only & currently listed. The `link NOT LIKE '%arxiv.org%'` mirrors the
// "an arxiv.org link counts as an arxiv source" rule in utils/listing.ts.
const SELECT = `
  SELECT p.id, p.title, p.arxiv_id, p.corpus_id, p.link
  FROM papers p
  WHERE p.listed = 1
    AND p.arxiv_id IS NULL
    AND p.corpus_id IS NULL
    AND (p.link IS NULL OR p.link NOT LIKE '%arxiv.org%')
    AND EXISTS (
      SELECT 1 FROM conference_papers cp
      WHERE cp.paper_id = p.id AND cp.link IS NOT NULL AND cp.link != ''
    )
  ORDER BY p.id
`

const affected = db.query(SELECT).all() as Array<{ id: number; title: string }>

console.log(`DB: ${dbPath}`)
console.log(`Found ${affected.length} OpenReview-only paper(s) currently listed=1:`)
for (const p of affected) console.log(`  - #${p.id}  ${p.title}`)

if (affected.length === 0) {
  console.log('Nothing to correct.')
  process.exit(0)
}

if (!apply) {
  console.log('\nDry-run only. Re-run with --apply to set listed=0 on the papers above.')
  process.exit(0)
}

const ids = affected.map((p) => p.id)
const now = new Date().toISOString()
const stmt = db.prepare(`UPDATE papers SET listed = 0, updated_at = ? WHERE id = ?`)
const tx = db.transaction(() => {
  for (const id of ids) stmt.run(now, id)
})
tx()
console.log(`\nApplied: set listed=0 on ${ids.length} paper(s): ${ids.join(', ')}`)

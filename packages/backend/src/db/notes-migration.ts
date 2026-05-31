import type { Database } from 'bun:sqlite'
import { performBackup } from './backup.js'

/**
 * One-time, in-place migration from the old per-(user, paper) note TREE (a `root` note plus
 * child `note` rows) to a single Markdown DOCUMENT per (user, paper). Each tree is flattened
 * into one Markdown string (the same shape the old walkthrough produced — title → depth-based
 * heading, body following, body headings re-leveled to nest under, root body as preamble — but
 * WITHOUT the render-time auto-numbering), written into one surviving row; the other rows are
 * deleted. The destructive column drop (`kind`/`parent_id`/`title`/`sort_order`) and the new
 * `(user_id, paper_id)` unique index are handled by the generated drizzle migration that runs
 * right after this in `initDatabase()`; collapsing to one row per (user, paper) here is what
 * lets that unique index apply cleanly.
 *
 * Runs BEFORE `migrate()` (it needs the old columns) and is idempotent: it no-ops once the
 * `kind` column is gone, and re-running on an already-collapsed single row yields that row's
 * body unchanged.
 */

interface OldNoteRow {
  id: number
  user_id: number
  paper_id: number
  kind: string
  parent_id: number | null
  title: string | null
  body: string
  sort_order: number
}

const FENCE_RE = /^\s*(```+|~~~+)/
const HEADING_RE = /^(#{1,6})\s+(.*)$/

/**
 * Re-level the ATX headings authored inside a note body so they nest *under* a note rendered
 * at `noteLevel`: the body's shallowest authored heading sits at `noteLevel + 1`, deeper
 * authored levels keep their relative nesting (mapped to contiguous ranks), clamped at H6.
 * Headings inside fenced code blocks and all non-heading lines pass through unchanged.
 */
function relevelBody(body: string, noteLevel: number): string {
  if (!body.trim()) return ''
  const lines = body.split('\n')
  let inFence = false
  const levels = new Set<number>()
  for (const line of lines) {
    if (FENCE_RE.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = HEADING_RE.exec(line)
    if (m) levels.add(m[1].length)
  }
  if (levels.size === 0) return body
  const rank = new Map([...levels].sort((a, b) => a - b).map((lv, i) => [lv, i]))
  inFence = false
  return lines.map((line) => {
    if (FENCE_RE.test(line)) { inFence = !inFence; return line }
    const m = inFence ? null : HEADING_RE.exec(line)
    if (!m) return line
    const newLevel = Math.min(noteLevel + 1 + rank.get(m[1].length)!, 6)
    return `${'#'.repeat(newLevel)} ${m[2].trim()}`
  }).join('\n')
}

/**
 * Flatten one (user, paper) tree (the full set of its rows) into a single Markdown string.
 * Top-level notes (the root's direct children, or all parentless notes if no root row exists)
 * render at H2; each deeper level adds one (clamped H6). The root note's body becomes the
 * leading preamble. Exported for unit testing.
 */
export function flattenTreeToMarkdown(rows: OldNoteRow[]): string {
  const root = rows.find((r) => r.kind === 'root')
  const ids = new Set(rows.map((r) => r.id))
  const childrenOf = new Map<number, OldNoteRow[]>()
  for (const r of rows) {
    if (r.kind === 'root' || r.parent_id == null) continue
    const list = childrenOf.get(r.parent_id) ?? []
    list.push(r)
    childrenOf.set(r.parent_id, list)
  }
  const sortFn = (a: OldNoteRow, b: OldNoteRow) => a.sort_order - b.sort_order

  let topLevel: OldNoteRow[]
  if (root) {
    topLevel = (childrenOf.get(root.id) ?? []).slice().sort(sortFn)
  } else {
    // No root row: parentless notes (or notes whose parent is missing) are the top level.
    topLevel = rows
      .filter((r) => r.kind === 'note' && (r.parent_id == null || !ids.has(r.parent_id)))
      .slice()
      .sort(sortFn)
  }

  const blocks: string[] = []
  const preamble = (root?.body ?? '').trim()
  if (preamble) blocks.push(preamble)

  const walk = (node: OldNoteRow, depth: number) => {
    const level = Math.min(2 + depth, 6)
    const title = node.title?.trim() || '(untitled)'
    blocks.push(`${'#'.repeat(level)} ${title}`)
    const body = relevelBody(node.body ?? '', level).trim()
    if (body) blocks.push(body)
    const kids = (childrenOf.get(node.id) ?? []).slice().sort(sortFn)
    for (const k of kids) walk(k, depth + 1)
  }
  for (const n of topLevel) walk(n, 0)
  return blocks.join('\n\n')
}

/** Detect the OLD tree schema by the presence of the `kind` column. */
function isOldSchema(sqlite: Database): boolean {
  const cols = sqlite.query(`PRAGMA table_info(notes)`).all() as { name: string }[]
  if (cols.length === 0) return false // table doesn't exist yet (fresh DB) — migrate() will create it
  return cols.some((c) => c.name === 'kind')
}

/** Run the in-place flatten if (and only if) the old tree schema is present. Idempotent. */
export function migrateNotesToSingleDoc(sqlite: Database): void {
  if (!isOldSchema(sqlite)) return

  const rows = sqlite
    .query(`SELECT id, user_id, paper_id, kind, parent_id, title, body, sort_order FROM notes`)
    .all() as OldNoteRow[]
  if (rows.length === 0) return // nothing to flatten; the reshape migration handles the empty table

  // Back up before the destructive collapse (idempotent: skips if today's backup already exists).
  try { performBackup() } catch (err) { console.error('Notes migration backup failed:', err) }

  const groups = new Map<string, OldNoteRow[]>()
  for (const r of rows) {
    const k = `${r.user_id}:${r.paper_id}`
    const list = groups.get(k) ?? []
    list.push(r)
    groups.set(k, list)
  }

  const update = sqlite.query(`UPDATE notes SET body = ? WHERE id = ?`)
  const del = sqlite.query(`DELETE FROM notes WHERE id = ?`)
  const collapse = sqlite.transaction(() => {
    for (const list of groups.values()) {
      const markdown = flattenTreeToMarkdown(list)
      // Keep the root row if present, else the lowest-id row; collapse the rest into it.
      const survivor = list.find((r) => r.kind === 'root') ?? list.reduce((a, b) => (a.id <= b.id ? a : b))
      update.run(markdown, survivor.id)
      for (const r of list) if (r.id !== survivor.id) del.run(r.id)
    }
  })
  // Disable FK enforcement for the collapse: the app runs with `foreign_keys = ON`, and
  // deleting a child `note` row whose parent is also being deleted would otherwise trip the
  // self-referential `parent_id` FK depending on delete order. Any transient dangling ref is
  // moot — migration 0017 recreates the table WITHOUT the `parent_id` column. (PRAGMA
  // foreign_keys is a no-op inside a transaction, so it must be toggled out here.)
  sqlite.exec('PRAGMA foreign_keys = OFF')
  try {
    collapse()
  } finally {
    sqlite.exec('PRAGMA foreign_keys = ON')
  }
  console.log(`Notes migrated to single-document model: ${groups.size} (user, paper) document(s).`)
}

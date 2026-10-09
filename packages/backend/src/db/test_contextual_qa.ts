import type { Database } from 'bun:sqlite'

/**
 * Test helper: bring a hand-written in-memory schema up to the contextual-Q&A columns/tables
 * (migration 0030) so drizzle selects on qa_entries/qa_results keep working. Only adds what is
 * missing, so it is safe to call after positional INSERTs into the older column layout.
 */
export function addContextualQATestSchema(sqlite: Database): void {
  const columns = (table: string) => new Set(
    (sqlite.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name),
  )
  const entries = columns('qa_entries')
  if (entries.size > 0) {
    if (!entries.has('instruction')) sqlite.exec('ALTER TABLE qa_entries ADD instruction TEXT')
    if (!entries.has('inputs')) sqlite.exec('ALTER TABLE qa_entries ADD inputs TEXT')
    if (!entries.has('parent_entry_id')) sqlite.exec('ALTER TABLE qa_entries ADD parent_entry_id INTEGER')
  }
  const results = columns('qa_results')
  if (results.size > 0 && !results.has('deleted_at')) sqlite.exec('ALTER TABLE qa_results ADD deleted_at TEXT')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS qa_result_cites (
      id INTEGER PRIMARY KEY AUTOINCREMENT, qa_result_id INTEGER NOT NULL, paper_id INTEGER NOT NULL,
      cite_id TEXT NOT NULL, id_kind TEXT NOT NULL, link_text TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE (qa_result_id, cite_id)
    );
    CREATE TABLE IF NOT EXISTS paper_citations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, paper_id INTEGER NOT NULL, direction TEXT NOT NULL,
      s2_paper_id TEXT, corpus_id TEXT, arxiv_id TEXT, doi TEXT, title TEXT, authors TEXT, year INTEGER,
      venue TEXT, url TEXT, contexts TEXT, intents TEXT, is_influential INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS images (
      hash TEXT PRIMARY KEY, ext TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER,
      height INTEGER, path TEXT NOT NULL, original_name TEXT, uploaded_by INTEGER, created_at TEXT NOT NULL
    );
  `)
}

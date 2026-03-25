import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { mkdirSync } from 'fs'
import { getConfig } from '../config.js'
import * as schema from './schema.js'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database | null = null

export function initDatabase(): ReturnType<typeof drizzle> {
  const config = getConfig()
  const dbPath = resolve(process.cwd(), config.database.path || './data/paperland.db')

  // Ensure directory exists
  mkdirSync(dirname(dbPath), { recursive: true })

  _sqlite = new Database(dbPath)

  // Enable WAL mode
  _sqlite.exec('PRAGMA journal_mode = WAL')
  _sqlite.exec('PRAGMA foreign_keys = ON')

  _db = drizzle(_sqlite, { schema })

  // Run migrations
  const migrationsFolder = resolve(dirname(new URL(import.meta.url).pathname), 'migrations')
  try {
    migrate(_db, { migrationsFolder })
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('does not exist')) {
      throw err
    }
  }

  // Backfill qa_entries.created_at for rows that still have the default empty string
  _sqlite.exec(`
    UPDATE qa_entries SET created_at = COALESCE(
      (SELECT MIN(completed_at) FROM qa_results WHERE qa_results.qa_entry_id = qa_entries.id),
      datetime('now')
    ) WHERE created_at = ''
  `)

  // Backfill papers.tags_json from paper_tags for existing data
  _sqlite.exec(`
    UPDATE papers SET tags_json = COALESCE(
      (SELECT json_group_array(json_object('id', t.id, 'name', t.name))
       FROM paper_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.paper_id = papers.id),
      '[]'
    ) WHERE tags_json IS NULL
  `)

  return _db
}

export function getDatabase(): ReturnType<typeof drizzle> {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _db
}

export function getSqliteDatabase(): Database {
  if (!_sqlite) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _sqlite
}

export function closeDatabase(): void {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}

export { schema }

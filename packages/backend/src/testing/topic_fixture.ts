import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadConfig } from '../config.js'
import { setDatabaseForTesting, schema } from '../db/index.js'

/** Entirely local fixtures. No initDatabase, provider subprocesses or network dependencies. */
export function topicFixture() {
  const root = mkdtempSync(join(tmpdir(), 'paperland-topics-test-'))
  const config = join(root, 'config.yml')
  writeFileSync(config, `database: { type: sqlite, path: ':memory:' }
auth: { enabled: true }
services: {}
models: { default: fixture, available: [{ name: fixture, type: openai_api, endpoint: 'http://invalid.test' }] }
qa: [{ name: summary, prompt: Summary }]
library: { starter_arxiv_id: '' }
topics: { repos_dir: '${join(root, 'repos')}' }
image_host: { dir: '${join(root, 'images')}' }
`)
  loadConfig(config)
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve(import.meta.dir, '../db/migrations') })
  setDatabaseForTesting(db)
  const now = new Date().toISOString()
  for (const [id, username, role, status] of [[1, 'owner', 'user', 'active'], [2, 'editor', 'user', 'active'], [3, 'viewer', 'user', 'active'], [4, 'outsider', 'admin', 'active'], [5, 'inactive', 'user', 'pending']] as const) {
    db.insert(schema.users).values({ id, username, role, status, password_hash: 'fixture', created_at: now }).run()
  }
  db.insert(schema.papers).values({ id: 10, title: 'Local fixture', authors: '[]', s2_paper_id: 'a'.repeat(40), created_at: now, updated_at: now }).run()
  return { root, db, sqlite, now, close() { sqlite.close(); rmSync(root, { recursive: true, force: true }) } }
}

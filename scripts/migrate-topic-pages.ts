import { Database } from 'bun:sqlite'
import { resolve, join } from 'node:path'
import { loadConfig } from '../packages/backend/src/config.js'
import { closeDatabase, initDatabase } from '../packages/backend/src/db/index.js'
import { backupResearchMigrationDatabase } from '../packages/backend/src/services/research_topic_migration.js'
import { readTopicCommit } from '../packages/backend/src/services/topic_git.js'
import { upgradeTopicLayout } from '../packages/backend/src/services/topic_layout.js'

if (process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Run this script from the project root')
const args = process.argv.slice(2), modes = ['--dry-run', '--apply', '--verify']
if (args.filter((arg) => modes.includes(arg)).length > 1) throw new Error('Choose one migration mode')
const allowed = new Set([...modes, '--config', '--backup-dir'])
for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`); if (args[i] === '--config' || args[i] === '--backup-dir') i++ }
const option = (flag: string) => { const i = args.indexOf(flag); if (i < 0) return undefined; if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${flag} requires a path`); return args[i + 1] }
const config = loadConfig(option('--config')), readonly = new Database(resolve(config.database.path || './data/paperland.db'), { readonly: true })
let initialized = false
try {
  const topics = readonly.query("SELECT id,published_commit,snapshot FROM topics WHERE published_commit IS NOT NULL AND (legacy_migration_state IS NULL OR legacy_migration_state='complete') ORDER BY id").all() as Array<{ id: number; published_commit: string; snapshot: string }>
  const pending = topics.filter((t) => JSON.parse(t.snapshot).topic.format_version !== 2)
  if (!args.includes('--apply') && !args.includes('--verify')) console.log(JSON.stringify({ mode: 'dry_run', topics: topics.length, pending: pending.map((t) => t.id), home: 'pages/report.md', catalog: 'references.json' }))
  else if (args.includes('--verify') || pending.length === 0) {
    for (const topic of topics) if ((await readTopicCommit(topic.id, topic.published_commit)).topic.format_version !== 2) throw new Error(`Topic ${topic.id} has not migrated`)
    console.log(JSON.stringify({ mode: args.includes('--verify') ? 'verify' : 'applied', topics: topics.length, migrated: 0, skipped: topics.length, backup: null }))
  } else {
    for (const table of ['qa_results', 'research_steps', 'service_executions']) if ((readonly.query(`SELECT count(*) n FROM ${table} WHERE status IN ('pending','queued','running','awaiting_output','streaming')`).get() as { n: number }).n) throw new Error('Active work exists; quiesce the service before migration')
    const backup = join(resolve(option('--backup-dir') || join(config.database.backup?.dir || './data/backups', 'topic-pages', new Date().toISOString().replace(/[:.]/g, '-'))), 'before-layout-migration.db')
    backupResearchMigrationDatabase(readonly, backup); readonly.close()
    initDatabase({ maintenance: true }); initialized = true
    const results = []
    for (const topic of topics) results.push(await upgradeTopicLayout(topic.id))
    console.log(JSON.stringify({ mode: 'applied', backup, topics: topics.length, migrated: results.filter((r) => !r.skipped).length, skipped: results.filter((r) => r.skipped).length, mappings: results }))
  }
} catch (error) { console.error((error as Error).message); process.exitCode = 1 }
finally { try { readonly.close() } catch {}; if (initialized) closeDatabase() }

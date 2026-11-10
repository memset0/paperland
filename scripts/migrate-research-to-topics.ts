import { Database } from 'bun:sqlite'
import { resolve, join } from 'node:path'
import { loadConfig } from '../packages/backend/src/config.js'
import { closeDatabase, initDatabase } from '../packages/backend/src/db/index.js'
import { backupResearchMigrationDatabase, migrateResearchToTopics, migrationPlanSummary, planReadOnlyResearchMigration, verifyReadOnlyResearchMigration, verifyResearchTopicMigration } from '../packages/backend/src/services/research_topic_migration.js'

if (process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Run this script from the project root')
const args = process.argv.slice(2), allowed = new Set(['--dry-run', '--apply', '--verify', '--config', '--backup-dir'])
if (args.filter((arg) => ['--dry-run', '--apply', '--verify'].includes(arg)).length > 1) throw new Error('Choose only one of --dry-run, --apply or --verify')
for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`); if (args[i] === '--config' || args[i] === '--backup-dir') i++ }
const value = (flag: string) => { const index = args.indexOf(flag); if (index < 0) return undefined; if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${flag} requires a path`); return args[index + 1] }
const config = loadConfig(value('--config')), dbPath = resolve(config.database.path || './data/paperland.db')
const readOnly = new Database(dbPath, { readonly: true })
let initialized = false
try {
  const plans = planReadOnlyResearchMigration(readOnly)
  if (!args.includes('--apply') && !args.includes('--verify')) {
    console.log(JSON.stringify({ mode: 'dry_run', ...migrationPlanSummary(plans) }))
  } else if (args.includes('--verify') && !args.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'verify', ...await verifyReadOnlyResearchMigration(readOnly) }))
  } else {
    const columns = readOnly.query("PRAGMA table_info('topics')").all() as Array<{ name: string }>
    const completed = columns.some((column) => column.name === 'legacy_research_session_id') && plans.every((plan) => !!readOnly.query("SELECT id FROM topics WHERE legacy_research_session_id = ? AND legacy_migration_state = 'complete'").get(plan.session_id))
    if (completed) {
      console.log(JSON.stringify({ mode: 'applied', backup: null, ...await verifyReadOnlyResearchMigration(readOnly), created: 0, skipped: plans.length }))
      process.exitCode = 0
    } else {
    const active = [['qa_results', ['queued', 'awaiting_output', 'streaming']], ['research_steps', ['queued', 'awaiting_output', 'streaming']], ['service_executions', ['pending', 'running']]] as const
    for (const [table, states] of active) if ((readOnly.query(`SELECT count(*) AS n FROM ${table} WHERE status IN (${states.map(() => '?').join(',')})`).get(...states) as any).n) throw new Error('Active work exists; quiesce the service before migration')
    const directory = resolve(value('--backup-dir') ?? join(config.database.backup?.dir ?? './data/backups', 'research-to-topics', new Date().toISOString().replace(/[:.]/g, '-')))
    const backup = join(directory, 'before-migration.db')
    backupResearchMigrationDatabase(readOnly, backup)
    readOnly.close()
    initDatabase({ maintenance: true }); initialized = true
    const results = await migrateResearchToTopics(plans)
    const verified = await verifyResearchTopicMigration()
    console.log(JSON.stringify({ mode: 'applied', backup, ...verified, created: results.filter((r) => !r.skipped).length, skipped: results.filter((r) => r.skipped).length, mappings: results }))
    }
  }
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
} finally { try { readOnly.close() } catch {}; if (initialized) closeDatabase() }

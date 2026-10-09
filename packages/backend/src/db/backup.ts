import { existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'fs'
import { resolve, join } from 'path'
import { getConfig } from '../config.js'

export function performBackup(): void {
  const config = getConfig()
  const backupConfig = config.database.backup

  if (!backupConfig?.enabled) return

  const backupDir = resolve(process.cwd(), backupConfig.dir)
  mkdirSync(backupDir, { recursive: true })

  const date = new Date().toISOString().split('T')[0]
  const backupPath = join(backupDir, `paperland_${date}.db`)

  // Skip if today's backup already exists
  if (existsSync(backupPath)) return

  const dbPath = resolve(process.cwd(), config.database.path || './data/paperland.db')

  try {
    // Use file copy — safe with WAL mode as SQLite handles consistency
    copyFileSync(dbPath, backupPath)
    cleanupOldBackups(backupDir, backupConfig.keep_daily_days, backupConfig.keep_checkpoint_days)
    console.log(`Backup created: ${backupPath}`)
  } catch (err) {
    console.error('Backup failed:', err)
  }
}

const BACKUP_NAME = /^paperland_(\d{4}-\d{2}-\d{2})\.db$/
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Tiered retention for automatic backups (`paperland_YYYY-MM-DD.db`; other files are ignored).
 * Age is whole days between the file-name date and `today` (UTC).
 *   - age 0..keepDailyDays          → keep all
 *   - each checkpoint interval (prev, c] (prev starts at keepDailyDays) → keep only the oldest,
 *     so a checkpoint ages through the interval instead of being replaced daily
 *   - older than the last checkpoint → delete
 */
export function selectBackupsToDelete(
  fileNames: string[],
  today: string,
  keepDailyDays: number,
  checkpointDays: number[],
): string[] {
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  const checkpoints = [...new Set(checkpointDays)].filter((c) => c > keepDailyDays).sort((a, b) => a - b)
  const buckets = new Map<number, Array<{ name: string; age: number }>>()
  const toDelete: string[] = []

  for (const name of fileNames) {
    const m = BACKUP_NAME.exec(name)
    if (!m) continue
    const dateMs = Date.parse(`${m[1]}T00:00:00Z`)
    if (Number.isNaN(dateMs)) continue
    const age = Math.floor((todayMs - dateMs) / DAY_MS)
    if (age <= keepDailyDays) continue
    const bucket = checkpoints.findIndex((c) => age <= c)
    if (bucket === -1) {
      toDelete.push(name)
      continue
    }
    if (!buckets.has(bucket)) buckets.set(bucket, [])
    buckets.get(bucket)!.push({ name, age })
  }

  for (const files of buckets.values()) {
    files.sort((a, b) => b.age - a.age)
    toDelete.push(...files.slice(1).map((f) => f.name))
  }
  return toDelete
}

function cleanupOldBackups(backupDir: string, keepDailyDays: number, checkpointDays: number[]): void {
  try {
    const today = new Date().toISOString().split('T')[0]
    for (const file of selectBackupsToDelete(readdirSync(backupDir), today, keepDailyDays, checkpointDays)) {
      unlinkSync(join(backupDir, file))
    }
  } catch (err) {
    console.error('Backup cleanup failed:', err)
  }
}

export function startBackupScheduler(): void {
  const config = getConfig()
  if (!config.database.backup?.enabled) return

  // Run immediately on startup
  performBackup()

  // Then every 24 hours
  setInterval(performBackup, 24 * 60 * 60 * 1000)
}

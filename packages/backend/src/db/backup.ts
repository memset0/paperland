import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync, copyFileSync } from 'fs'
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
    cleanupOldBackups(backupDir, backupConfig.retention_days)
    console.log(`Backup created: ${backupPath}`)
  } catch (err) {
    console.error('Backup failed:', err)
  }
}

function cleanupOldBackups(backupDir: string, retentionDays: number): void {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000

  try {
    const files = readdirSync(backupDir)
    for (const file of files) {
      if (!file.startsWith('paperland_') || !file.endsWith('.db')) continue

      const filePath = join(backupDir, file)
      const stat = statSync(filePath)

      if (stat.mtimeMs < cutoff) {
        unlinkSync(filePath)
      }
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

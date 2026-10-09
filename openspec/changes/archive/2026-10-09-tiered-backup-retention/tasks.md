## 1. Config

- [x] 1.1 Replace `retention_days` with `keep_daily_days` (default 7) and `keep_checkpoint_days` (default `[14, 28]`) in `config.ts` (and the shared config type if any), `config.example.yml`, and the local `config.yml` backup block; verify config loads with and without the keys

## 2. Retention logic

- [x] 2.1 Add a pure `selectBackupsToDelete(fileNames, today, keepDailyDays, checkpointDays)` in `db/backup.ts` (name-date ages, interval-oldest checkpoints, ignore non-matching names) and make `cleanupOldBackups` use it
- [x] 2.2 Add `db/backup.test.ts` covering every scenario in the delta spec, including the 60-day daily simulation; verify it passes

## 3. Docs and verification

- [x] 3.1 Update the backup sections of `docs/tech-stack.md` (strategy table, flow, config example)
- [x] 3.2 Run the new test plus `config.test.ts`, then dry-run the selection against the real `data/backups/` listing (without deleting) and confirm the expected keep set
- [x] 3.3 Run `npx openspec validate tiered-backup-retention --strict` and verify it passes

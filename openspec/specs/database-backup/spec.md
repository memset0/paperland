# database-backup Specification

## Purpose
TBD - created by archiving change project-init. Update Purpose after archive.

## Requirements

### Requirement: Daily automatic backup
The system SHALL perform a daily SQLite database backup when `database.backup.enabled` is true in config.yml. The backup SHALL use SQLite's backup API via better-sqlite3.

#### Scenario: Backup on schedule
- **WHEN** the server is running and 24 hours have passed since the last backup (or no backup exists today)
- **THEN** the system SHALL create a backup file named `paperland_YYYY-MM-DD.db` in the configured backup directory

#### Scenario: Backup on first startup
- **WHEN** the server starts and no backup exists for today
- **THEN** the system SHALL perform an immediate backup

### Requirement: Backup file naming
Backup files SHALL be named `paperland_YYYY-MM-DD.db` where the date is the current date in UTC.

#### Scenario: Backup file created
- **WHEN** a backup runs on 2026-03-18
- **THEN** the file `data/backups/paperland_2026-03-18.db` SHALL be created

### Requirement: Backup directory creation
The system SHALL create the backup directory if it does not exist.

#### Scenario: Missing backup directory
- **WHEN** the configured backup directory `data/backups/` does not exist
- **THEN** the system SHALL create it recursively before performing the backup

### Requirement: Retention policy
After each backup the system SHALL apply tiered retention to automatic backup files named `paperland_YYYY-MM-DD.db`, computing each file's age in whole days from the UTC date in its file name (not from file mtime). Configuration keys are `database.backup.keep_daily_days` (default 7) and `database.backup.keep_checkpoint_days` (default `[14, 28]`):
- Every file with age 0..`keep_daily_days` inclusive SHALL be kept.
- Checkpoint values SHALL be sorted ascending, de-duplicated, and values ≤ `keep_daily_days` ignored. For each checkpoint `c_i`, among files with age in (`c_{i-1}`, `c_i`] (where `c_0` = `keep_daily_days`), only the oldest SHALL be kept and the others deleted.
- Files older than the largest checkpoint (or older than `keep_daily_days` when no checkpoint remains) SHALL be deleted.
- Files not matching the automatic backup name pattern (e.g. manual `pre-*.db` backups) SHALL NOT be deleted.

#### Scenario: Recent backups preserved
- **WHEN** a backup completes and backups exist for each of the last 8 days (ages 0–7)
- **THEN** all of them SHALL be kept

#### Scenario: One checkpoint per interval
- **WHEN** a backup completes with defaults and backups exist with ages 9, 12 and 14
- **THEN** only the age-14 backup SHALL be kept among them

#### Scenario: Checkpoint ages into the next interval
- **WHEN** backups run daily for 60 consecutive days with defaults
- **THEN** after every run the directory SHALL contain the 8 backups aged 0–7, exactly one backup aged 8–14, and exactly one backup aged 15–28, and nothing older than 28 days

#### Scenario: Old backups cleaned up
- **WHEN** a backup completes and an automatic backup older than 28 days exists
- **THEN** it SHALL be deleted

#### Scenario: Manual backups untouched
- **WHEN** a backup completes and `pre-notes-root_20260529_224753.db` exists in the backup directory
- **THEN** that file SHALL NOT be deleted

### Requirement: Backup disabled
When `database.backup.enabled` is false or the backup section is missing from config.yml, the system SHALL NOT perform any backups.

#### Scenario: Backup disabled in config
- **WHEN** config.yml has `database.backup.enabled: false`
- **THEN** no backup scheduler SHALL be started and no backup files SHALL be created

### Requirement: Backup safety during operation
The backup SHALL be safe to perform while the database is in use (reads and writes ongoing).

#### Scenario: Backup during active use
- **WHEN** a backup runs while other requests are reading from and writing to the database
- **THEN** the backup SHALL complete without corrupting the source database or the backup file

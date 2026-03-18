## ADDED Requirements

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
The system SHALL delete backup files older than `database.backup.retention_days` (default 30) after each backup.

#### Scenario: Old backups cleaned up
- **WHEN** a backup completes and backup files older than 30 days exist in the backup directory
- **THEN** those files SHALL be deleted

#### Scenario: Recent backups preserved
- **WHEN** a backup completes and all backup files are within 30 days
- **THEN** no files SHALL be deleted

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

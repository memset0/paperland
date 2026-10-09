## MODIFIED Requirements

### Requirement: Database configuration
The config SHALL support database configuration with `type` (sqlite or postgresql), `path` (for SQLite), and optional `backup` settings.

#### Scenario: SQLite database config
- **WHEN** config.yml contains `database.type: sqlite` and `database.path: ./data/paperland.db`
- **THEN** the system SHALL use SQLite with the specified file path

#### Scenario: Backup configuration
- **WHEN** config.yml contains `database.backup.enabled: true`, `database.backup.dir`, `database.backup.keep_daily_days`, and `database.backup.keep_checkpoint_days`
- **THEN** the system SHALL use these values for the backup scheduler and tiered retention

#### Scenario: Backup retention defaults
- **WHEN** config.yml enables backup but omits `keep_daily_days` and `keep_checkpoint_days`
- **THEN** the system SHALL default them to `7` and `[14, 28]`, and SHALL ignore a legacy `retention_days` key

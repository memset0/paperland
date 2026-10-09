## MODIFIED Requirements

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

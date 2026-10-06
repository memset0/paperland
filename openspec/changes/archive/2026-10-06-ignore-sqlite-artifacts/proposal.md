## Why

SQLite backup WAL and SHM files currently appear as untracked files because the ignore rules cover sidecars only directly under data/. Local databases and their sidecars must be excluded recursively from ordinary Git staging.

## What Changes

- Ignore .db, .sqlite, and .sqlite3 database files and their -journal, -wal, and -shm sidecars at any directory depth.
- Preserve the files on disk and all existing unrelated ignore rules.

## Capabilities

### New Capabilities

None. This is repository tooling only; skip_specs is enabled.

### Modified Capabilities

None. Database runtime and backup behavior are unchanged.

## Impact

Only .gitignore and this change's OpenSpec artifacts. No application code, API, dependency, or behavior documentation changes.

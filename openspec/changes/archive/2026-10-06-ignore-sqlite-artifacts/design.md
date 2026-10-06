## Context

See proposal.md. Existing data/*.db-* rules do not match backup-directory sidecars.

## Goals / Non-Goals

Cover SQLite databases and the three standard sidecar suffixes at all directory depths. Keep local files and unrelated ignore entries intact.

## Decisions

Use slash-free .gitignore patterns for .db, .sqlite, and .sqlite3 plus -journal, -wal, and -shm. These apply recursively and cover both live and backup databases without ignoring unrelated backup content. No application code or behavior documentation changes are necessary.

## Risks / Trade-offs

Already tracked files are not affected by ignore rules; audit tracked SQLite paths before committing.

## Migration Plan

Replace the five narrow database rules with the recursive patterns. Verify real and representative nested paths with git check-ignore, confirm normal source files remain visible, and review the exact commit paths.

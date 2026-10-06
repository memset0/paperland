## 1. Ignore SQLite artifacts

- [x] 1.1 Replace directory-specific database patterns with recursive .db/.sqlite/.sqlite3 and journal/WAL/SHM patterns; verify all twelve extension/suffix combinations and both existing backup sidecars with git check-ignore.
- [x] 1.2 Audit tracked database artifacts and verify unrelated source paths remain unignored; confirm local backup sidecars still exist and git status excludes them. See docs/tech-stack.md for the SQLite storage and backup context.

## 2. Validate

- [x] 2.1 Run strict OpenSpec validation and review the .gitignore diff to confirm only the intended repository tooling changed.

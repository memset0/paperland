# Tasks

## 1. Versioned repository contract

- [x] 1.1 Implement canonical schema v1 and bounded complete reports.yml parsing/serialization with legacy readers; verify malformed/unknown versions, manifest omissions/duplicates/nesting and old snapshots through offline fixtures.
- [x] 1.2 Add schema discovery/status and migration examples to MCP and initialize guidance, update docs/topics.md and docs/external-api.md, and verify scoped API/tool results with offline tests.

## 2. Curated reading navigation

- [x] 2.1 Render ordered nested manifest entries with one row for group overview, independent keyboard-accessible expansion, selected ancestor expansion and legacy fallback; verify tree helpers and desktop/mobile browser behavior offline.
- [x] 2.2 Update docs/frontend-architecture.md and docs/tech-stack.md; verify frontend type checking and the focused diff.

## 3. Migration and deployment

- [x] 3.1 Provide idempotent backed-up dry-run/apply/verify schema migration with preserved page blobs, reference numbers, history, audit and workspace; verify upgrades, retries and downgrade rejection with offline Git fixtures and a disposable production copy.
- [x] 3.2 Strictly validate OpenSpec, run focused offline checks, deploy root queued build/backend, migrate current repositories and maintain Topic3's curated index through its MCP/Git identity; verify public health/assets, current/history reads and desktop/mobile UI, and record evidence.

## Workflow follow-up

- Keep this change active for user review; archive, sync, bump and commit/push only after its own explicit archive authorization.

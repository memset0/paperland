## 1. Database Schema & Migration

- [x] 1.1 Add `created_at` column to `qa_entries` in `packages/backend/src/db/schema.ts`
- [x] 1.2 Generate Drizzle migration with `bunx drizzle-kit generate`
- [x] 1.3 Write backfill logic: update existing `qa_entries.created_at` from `MIN(qa_results.completed_at)`, fallback to current timestamp
- [x] 1.4 Update all backend code that inserts `qa_entries` to set `created_at` to current ISO 8601 timestamp

## 2. Shared Types

- [x] 2.1 Add `QAFeedEntry` type in `packages/shared/` with fields: `entry_id`, `paper_id`, `paper_title`, `status`, `error`, `prompt`, `created_at`, `results`

## 3. Backend API

- [x] 3.1 Add `GET /api/qa/free` endpoint in `packages/backend/src/api/qa.ts` — query all free QA entries joined with papers and results, ordered by `created_at DESC`
- [x] 3.2 Return response shape: `{ data: QAFeedEntry[] }` with paper title included

## 4. Frontend — QA Store

- [x] 4.1 Add `feedEntries` state (array of `QAFeedEntry`) and `feedLoading` flag to QA store
- [x] 4.2 Add `fetchFeed()` action that calls `GET /api/qa/free` and updates `feedEntries`
- [x] 4.3 Add feed-level polling: `startFeedPolling()` / `stopFeedPolling()` that polls while any entry has status pending/running

## 5. Frontend — QA Feed Page Components

- [x] 5.1 Create `QAFeedPanel.vue` — collapsible panel with header (paper title link, question, status, created_at) and body (reuses `QAResultView.vue`)
- [x] 5.2 Rewrite `QAPage.vue` — remove paper selector, render list of `QAFeedPanel.vue` from `feedEntries`, handle empty state
- [x] 5.3 Wire up actions in `QAFeedPanel.vue`: regenerate, delete, copy, pin — delegate to existing QA store actions, refetch feed after mutations

## 6. Highlight Pathname Fix

- [x] 6.1 Update `QAFeedPanel.vue` to pass `highlightPathname="/papers/${paper_id}"` when rendering QA content
- [x] 6.2 Update highlight loading in `QAResultView.vue` (or `MarkdownContent`) to accept and use an explicit pathname prop instead of defaulting to `route.path`
- [x] 6.3 Verify highlights created on /qa page are stored with paper pathname and visible on paper detail page

## 7. Docs & Cleanup

- [x] 7.1 Update `docs/frontend-architecture.md` with new /qa page architecture
- [x] 7.2 Update `docs/tech-stack.md` if any new dependencies or patterns added
- [x] 7.3 Remove unused paper-selector code from old QAPage implementation

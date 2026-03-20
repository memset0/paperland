## 1. Database Schema & Migration

- [x] 1.1 Add `updated_at` column to `papers` table in `packages/backend/src/db/schema.ts`
- [x] 1.2 Generate Drizzle migration via `bunx drizzle-kit generate` (from `packages/backend/`)
- [x] 1.3 Add custom SQL to migration to backfill `updated_at = created_at` for existing rows

## 2. Shared Types

- [x] 2.1 Add `updated_at: string` field to `Paper` interface in `packages/shared/src/types.ts`

## 3. Backend — touchPaperUpdatedAt Helper

- [x] 3.1 Create `touchPaperUpdatedAt(db, paperId)` helper function in a shared location (e.g., `packages/backend/src/db/utils.ts` or inline in relevant modules)

## 4. Backend — QA Route Touch Points

- [x] 4.1 Call `touchPaperUpdatedAt` in `POST /api/papers/:id/qa/free` after creating QA entry
- [x] 4.2 Call `touchPaperUpdatedAt` in `POST /api/papers/:id/qa/template` after triggering (only if `triggered.length > 0`)
- [x] 4.3 Call `touchPaperUpdatedAt` in `POST /api/papers/:id/qa/template/:name/regenerate`
- [x] 4.4 Call `touchPaperUpdatedAt` in `POST /api/qa/:entryId/regenerate` (extract `paper_id` from entry)

## 5. Backend — Highlights Route Touch Points

- [x] 5.1 Add `parsePaperIdFromPathname(pathname)` helper to extract paper ID from `/papers/:id` pattern
- [x] 5.2 Call `touchPaperUpdatedAt` in `POST /api/highlights` after creating highlight
- [x] 5.3 Call `touchPaperUpdatedAt` in `PUT /api/highlights/:id` after updating highlight
- [x] 5.4 Call `touchPaperUpdatedAt` in `DELETE /api/highlights/:id` before deleting highlight (read pathname first)

## 6. Backend — Paper Creation

- [x] 6.1 Set `updated_at: now` when inserting new papers in `POST /api/papers` (`packages/backend/src/api/papers.ts`)
- [x] 6.2 Set `updated_at: now` when inserting papers via external API (`packages/backend/src/external-api/papers.ts`)

## 7. Backend — Sort API

- [x] 7.1 Add `sort_by` and `sort_order` query params to `GET /api/papers` with validation (allowed: `created_at`, `updated_at`; default: `created_at` desc)
- [x] 7.2 Apply dynamic `orderBy` based on sort params instead of hardcoded `desc(schema.papers.created_at)`

## 8. Frontend — Papers Store

- [x] 8.1 Add `sortBy` and `sortOrder` reactive refs to papers store
- [x] 8.2 Pass `sort_by` and `sort_order` params in `fetchPapers()` API call

## 9. Frontend — Paper List UI

- [x] 9.1 Add sort dropdown control next to search bar with options: "添加时间" (created_at) and "最近修改" (updated_at)
- [x] 9.2 Update date column header to show "添加日期" or "修改日期" based on current sort mode
- [x] 9.3 Display `updated_at` or `created_at` in date column based on sort mode
- [x] 9.4 Fix author column overflow — apply `truncate` CSS class to author cell for consistent row heights

## 10. Documentation

- [x] 10.1 Update `docs/frontend-architecture.md` with sort controls description
- [x] 10.2 Update `docs/external-api.md` to document `updated_at` field in paper responses and sort params

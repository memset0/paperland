## Context

Papers currently only have a `created_at` timestamp. The paper list is hardcoded to sort by `created_at DESC` with no user control. Users frequently interact with papers (QA, highlights, content edits) but have no way to find recently-active papers. Additionally, long author names cause inconsistent row heights in the paper list table.

Key touch points that modify paper-related data:
- **QA routes** (`qa.ts`): free question, template trigger, regenerate
- **Highlights routes** (`highlights.ts`): create, update, delete — keyed by `pathname` (e.g., `/papers/42`)
- **Paper routes** (`papers.ts`): create paper (with content)
- **Services**: update paper fields (title, abstract, contents, metadata) via `service_runner`

## Goals / Non-Goals

**Goals:**
- Add `updated_at` column to papers table, backfilled from `created_at`
- Auto-update `updated_at` on QA, highlight, and content operations
- Expose sort options (`created_at`, `updated_at`) with order (`asc`, `desc`) on `GET /api/papers`
- Add sort dropdown to paper list frontend
- Fix author column overflow with text truncation
- Include `updated_at` in shared `Paper` type and all API responses

**Non-Goals:**
- Full-text search ranking or relevance sorting
- Per-field modification tracking or audit log
- Sorting by title, author count, or other fields
- Updating `updated_at` from automated service executions (only user-initiated actions)

## Decisions

### 1. Store `updated_at` in papers table (not computed at query time)

**Decision**: Add a persistent `updated_at` text column to the `papers` table.

**Rationale**: Computing from joins across qa_entries, highlights, service_executions on every list query would be expensive and complex. A denormalized column is simpler, faster, and enables direct `ORDER BY`.

**Alternative considered**: SQL view or subquery joining max timestamps — rejected due to query complexity and performance with pagination.

### 2. Helper function `touchPaperUpdatedAt(paperId)`

**Decision**: Create a shared utility `touchPaperUpdatedAt(db, paperId)` that sets `updated_at = new Date().toISOString()` on the paper. Call it from each route handler that performs a user-initiated modification.

**Rationale**: Centralizes the update logic. Each route calls it explicitly, keeping it visible and debuggable.

**Touch points**:
- `POST /api/papers/:id/qa/free` — after creating QA entry
- `POST /api/papers/:id/qa/template` — after triggering templates (only if any were triggered)
- `POST /api/papers/:id/qa/template/:name/regenerate` — after regenerating
- `POST /api/qa/:entryId/regenerate` — after regenerating (extract paper_id from entry)
- `POST /api/highlights` — extract paper_id from pathname `/papers/:id`
- `PUT /api/highlights/:id` — extract paper_id from existing highlight's pathname
- `DELETE /api/highlights/:id` — extract paper_id from existing highlight's pathname
- Paper creation — set `updated_at = created_at` at insert time

### 3. Extract paper ID from highlight pathname

**Decision**: Parse pathname with pattern `/papers/:id` to extract paper_id. If the pathname doesn't match this pattern, skip the `updated_at` touch (highlights could theoretically be on non-paper pages).

### 4. Sort API parameters

**Decision**: Add `sort_by` (default: `created_at`) and `sort_order` (default: `desc`) query params to `GET /api/papers`. Validate `sort_by` against allowed values `['created_at', 'updated_at']`.

### 5. Frontend sort UI

**Decision**: Add a compact sort dropdown next to the search bar, showing current sort mode. Options: "添加时间" (created_at) and "最近修改" (updated_at), each with asc/desc toggle. Store the user's sort preference in the papers Pinia store (reset on page reload is acceptable).

### 6. Author column truncation

**Decision**: Apply `truncate` (CSS `text-overflow: ellipsis; overflow: hidden; white-space: nowrap`) to the author cell, matching how paper titles already use `line-clamp-1`. The column already has a fixed `w-40` width.

### 7. Migration strategy

**Decision**: Drizzle Kit migration adds `updated_at` column with a default. Custom SQL in migration backfills `updated_at = created_at` for all existing rows. For new papers, `updated_at` is set equal to `created_at` at insert time.

## Risks / Trade-offs

- **Missed touch points**: If a new route later modifies paper-related data without calling `touchPaperUpdatedAt`, the timestamp goes stale. → Mitigation: Document the pattern; add a comment in the helper function listing all current callers.
- **Highlight pathname parsing**: Relies on pathname format `/papers/:id`. → Mitigation: Simple regex; if format doesn't match, silently skip (no crash).
- **Service-driven updates not tracked**: Automated service runs (arxiv fetch, pdf parse) won't update `updated_at`. → This is intentional — only user-initiated actions count as "modifications".

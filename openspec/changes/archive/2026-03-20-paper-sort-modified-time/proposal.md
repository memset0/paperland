## Why

The paper list currently only supports sorting by creation time (`created_at`). Users need to find papers they recently interacted with — asked questions about, added highlights to, or updated content for — but there is no way to surface these recently-active papers. Adding a persistent `updated_at` field to papers and exposing multiple sort options will make the paper list far more useful for daily workflows.

## What Changes

- **Add `updated_at` column** to the `papers` table in the database schema. Migration backfills existing rows with `created_at`.
- **Auto-update `updated_at`** whenever a paper is meaningfully modified:
  - Free Q&A question submitted (`POST /api/papers/:id/qa/free`)
  - Template Q&A triggered (`POST /api/papers/:id/qa/template`)
  - Q&A entry regenerated
  - Highlight created, updated, or deleted for the paper
  - Paper content updated (user_input changes, metadata updates)
- **Add sort parameter** to `GET /api/papers` — support `sort_by` (e.g. `created_at`, `updated_at`) and `sort_order` (`asc`, `desc`).
- **Frontend sort controls** on the paper list page allowing users to switch between sort modes.
- **Display `updated_at`** in the paper list and paper detail views.
- **Fix author column overflow** — long author names currently cause line wrapping and inconsistent row heights. Truncate with ellipsis like paper titles (`line-clamp-1`).

## Capabilities

### New Capabilities
- `paper-modified-time`: Tracks paper last-modified time via `updated_at` column, auto-updated on QA, highlight, and content operations
- `paper-list-sorting`: Adds configurable sort options (created_at, updated_at) with sort order to the paper list API and UI

### Modified Capabilities
- `database-schema`: Adding `updated_at` column to papers table with migration

## Impact

- **Database**: New column + migration on `papers` table; all existing rows backfilled with `created_at`
- **Backend API**: `GET /api/papers` gains `sort_by` and `sort_order` query params; QA, highlight, and paper update routes gain `updated_at` side-effect writes
- **Shared types**: `Paper` interface adds `updated_at: string` field
- **Frontend**: Paper list view adds sort dropdown; paper detail shows `updated_at`; papers store passes sort params
- **External API**: `GET /external-api/v1/papers` responses include `updated_at`

## Context

Tags in Paperland are currently always shown in the paper list's tag filter bar. As users accumulate tags (especially via Zotero sync), the filter bar becomes cluttered with low-value tags. Users need a way to hide tags from the paper list without deleting them.

The tag management page (`TagManagement.vue`) already supports rename, color change, merge, and delete. The `tags` table has `id`, `name`, `color`. The `GET /api/tags` endpoint returns all tags with paper counts. The paper list fetches tags from the store and renders them all in the filter bar.

## Goals / Non-Goals

**Goals:**
- Allow toggling tag visibility from the tag management page via an icon button
- Hide non-visible tags from the paper list filter bar
- Default new tags to visible
- Persist visibility in the database

**Non-Goals:**
- Hiding tags from TagSelector (paper edit) — all tags remain selectable when editing a paper
- Hiding tags from paper detail view — assigned tags always show on papers
- Bulk visibility toggle
- Visibility per-user (single-user system, global setting is sufficient)

## Decisions

### 1. New `visible` column on `tags` table

Add `visible integer NOT NULL DEFAULT 1` to the `tags` table. SQLite has no native boolean — use integer 0/1 consistent with Drizzle ORM conventions.

**Alternative**: Store visibility in a separate table or config. Rejected — adds complexity for a simple per-tag boolean.

### 2. Toggle via existing `PATCH /api/tags/:id` endpoint

Extend the existing endpoint to accept `{ visible: boolean }` alongside the existing `name` and `color` fields. No new endpoint needed.

**Alternative**: New dedicated endpoint `POST /api/tags/:id/toggle-visibility`. Rejected — PATCH already handles partial updates to tag properties.

### 3. Filter visibility on the frontend

The `GET /api/tags` endpoint returns `visible` for all tags. The paper list component filters client-side to only show `visible` tags in the filter bar. The tag management page shows all tags with their visibility state.

**Alternative**: Server-side filter via query param `?visible=true`. Rejected — the frontend needs all tags for the management page, and the dataset is small enough that client-side filtering is trivial.

### 4. Eye / eye-off icon button in tag management

Add an icon button in each tag row. Uses Lucide icons (`Eye` / `EyeOff`). Clicking sends `PATCH /api/tags/:id { visible: !current }`. No confirmation dialog needed — the action is instantly reversible.

## Risks / Trade-offs

- **Migration**: Adding a column with a default value is safe for SQLite. All existing tags become visible by default — no behavior change. → No risk.
- **tags_json denormalization**: `tags_json` on papers does not include `visible`. This is correct — `tags_json` is for display on paper cards, where all assigned tags should show regardless of visibility. → No change to sync logic.

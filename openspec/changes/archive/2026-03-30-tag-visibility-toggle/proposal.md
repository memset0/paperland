## Why

All tags currently appear in the paper management page's tag filter bar, regardless of relevance. Users accumulate many tags (e.g., from Zotero sync) but only a subset are useful for filtering papers. There's no way to hide low-value tags from the paper list without deleting them.

## What Changes

- Add a `visible` boolean column to the `tags` table (default `true`)
- Add a toggle icon button in the tag management page for each tag to switch visibility
  - Visible: eye icon; Hidden: eye-off icon
- Paper list tag filter bar only shows tags where `visible = true`
- Tags remain fully functional (assignment, search, etc.) regardless of visibility — this only controls the filter bar display

## Capabilities

### New Capabilities
- `tag-visibility`: Toggle whether a tag appears in the paper list's tag filter bar. Managed via icon button on tag management page. Default visible.

### Modified Capabilities

## Impact

- **Database**: New `visible` column on `tags` table (migration required)
- **Backend API**: `GET /api/tags` returns `visible` field; `PATCH /api/tags/:id` accepts `visible` toggle
- **Frontend**: Tag management page gets toggle button; paper list filters by visibility
- **Shared types**: `Tag` type gains `visible: boolean`

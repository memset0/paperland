## 1. Database Schema & Migration

- [x] 1.1 Add `color` column to `tags` table in `packages/backend/src/db/schema.ts` (text, not null, default empty string)
- [x] 1.2 Add `tags_json` column to `papers` table in `packages/backend/src/db/schema.ts` (text, nullable)
- [x] 1.3 Generate Drizzle migration with `bunx drizzle-kit generate` from `packages/backend/`
- [x] 1.4 Create backfill script/migration to populate `tags_json` for existing papers from `paper_tags` table
- [x] 1.5 Update shared types in `packages/shared/src/types.ts`: add `color` to `Tag`, add `tags_json` to `Paper`

## 2. Backend — Tag Color Utilities

- [x] 2.1 Create color palette constant (array of ~20 preset hex colors) and random color assignment function in `packages/backend/src/utils/tag-colors.ts`
- [x] 2.2 Update existing tag creation logic in External API (`packages/backend/src/external-api/tags.ts`) to assign random color when creating new tags
- [x] 2.3 Update existing tag creation logic in External API papers (`packages/backend/src/external-api/papers.ts`) to assign random color when creating tags via paper creation

## 3. Backend — tags_json Sync Helper

- [x] 3.1 Create `packages/backend/src/utils/tags-json-sync.ts` with helper function to rebuild `tags_json` for a given paper_id (query paper_tags + tags, write JSON to papers.tags_json)
- [x] 3.2 Create batch sync helper to update tags_json for all papers associated with a given tag_id (for rename/merge/delete operations)
- [x] 3.3 Integrate sync helper into existing External API tag endpoints (PUT/PATCH `/external-api/v1/papers/:id/tags`) so they update tags_json after changes

## 4. Backend — Internal API Tag Routes

- [x] 4.1 Create `packages/backend/src/api/tags.ts` with `GET /api/tags` — returns all tags with id, name, color, paper_count
- [x] 4.2 Add `PATCH /api/tags/:id` — update tag name and/or color; return 409 if name conflicts with existing tag
- [x] 4.3 Add `POST /api/tags/:id/merge` — merge source tag into target tag (move associations, delete source, sync tags_json)
- [x] 4.4 Add `DELETE /api/tags/:id` — delete tag, cascade paper_tags, sync affected papers' tags_json
- [x] 4.5 Register tags routes in Fastify server (`packages/backend/src/index.ts`)

## 5. Backend — Internal API Paper Tag Routes

- [x] 5.1 Add `GET /api/papers/:id/tags` — return paper's tags as `[{id, name, color}]`
- [x] 5.2 Add `PUT /api/papers/:id/tags` — replace all paper tags (accept `{ tags: string[] }`, create missing tags with color, sync tags_json)
- [x] 5.3 Add `PATCH /api/papers/:id/tags` — add/remove tags (accept `{ add?: string[], remove?: string[] }`, create missing tags, sync tags_json)
- [x] 5.4 Update `GET /api/papers` to accept `tag_ids` query parameter for filtering papers by tags (AND logic)
- [x] 5.5 Update `GET /api/papers` response to include `tags_json` parsed as tags array in paper objects
- [x] 5.6 Update `POST /api/papers` to accept optional `tags` array for manual paper creation (create tags if needed, sync tags_json)

## 6. Frontend — Tags Pinia Store

- [x] 6.1 Create `packages/frontend/src/stores/tags.ts` with state: `tags` array, `colorMap` computed, `fetchTags()` action
- [x] 6.2 Add `renameTag(id, name)`, `mergeTag(sourceId, targetId)`, `deleteTag(id)`, `updateTagColor(id, color)` actions
- [x] 6.3 Add `getTagColor(tagId)` getter that returns color from cached colorMap
- [x] 6.4 Add `refreshCache()` action that force-refetches tags from backend

## 7. Frontend — Tag Management Page

- [x] 7.1 Create `packages/frontend/src/views/TagManagement.vue` — tag list with name, color swatch, paper count
- [x] 7.2 Implement inline rename with conflict detection (show merge confirmation dialog on 409)
- [x] 7.3 Implement delete with confirmation dialog
- [x] 7.4 Implement color picker (preset palette + custom hex input)
- [x] 7.5 Add `/tags` route in `packages/frontend/src/router/index.ts`
- [x] 7.6 Add Tag icon navigation item in sidebar (`packages/frontend/src/App.vue`)

## 8. Frontend — Tag Selector Component

- [x] 8.1 Create `packages/frontend/src/components/TagSelector.vue` — searchable dropdown with existing tags + create-new-tag input
- [x] 8.2 Integrate TagSelector into manual paper add dialog in `PaperList.vue` (only for manual tab, not arXiv/corpus tabs)

## 9. Frontend — Paper List Tag Display & Filtering

- [x] 9.1 Create `packages/frontend/src/components/TagBadge.vue` — renders a single tag with its color from tags store cache
- [x] 9.2 Add tag badges to paper rows in `PaperList.vue`
- [x] 9.3 Add tag filter bar/dropdown to `PaperList.vue` — multi-select tags, updates URL query `?tags=1,2`
- [x] 9.4 Wire tag filter to `GET /api/papers` `tag_ids` parameter in papers store `fetchPapers()`

## 10. Frontend — Paper Detail Tag Display

- [x] 10.1 Update tag display in `PaperDetail.vue` to use `TagBadge.vue` with colors instead of static violet badges
- [x] 10.2 Make tags clickable — clicking a tag navigates to `/?tags={tagId}`

## 11. Documentation

- [x] 11.1 Update `docs/frontend-architecture.md` with tag management page, tag store, TagBadge/TagSelector components
- [x] 11.2 Update `docs/external-api.md` with tag color behavior on creation and tags_json sync
- [x] 11.3 Update `docs/tech-stack.md` if any new dependencies added (none needed)

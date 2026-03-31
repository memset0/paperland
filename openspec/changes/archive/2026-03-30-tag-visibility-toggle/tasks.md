## 1. Database & Schema

- [x] 1.1 Add `visible` integer column (NOT NULL, default 1) to `tags` table in `packages/backend/src/db/schema.ts`
- [x] 1.2 Generate Drizzle migration with `bunx drizzle-kit generate` from `packages/backend/`

## 2. Shared Types

- [x] 2.1 Add `visible: boolean` to the `Tag` interface in `packages/shared/src/types.ts`

## 3. Backend API

- [x] 3.1 Update `GET /api/tags` in `packages/backend/src/api/tags.ts` to return `visible` field (as boolean)
- [x] 3.2 Update `PATCH /api/tags/:id` to accept optional `visible` boolean and persist it
- [x] 3.3 Ensure new tags created via paper tag assignment default to `visible = true` (verify existing create logic inherits column default)

## 4. Frontend Store

- [x] 4.1 Update `TagWithCount` interface in `packages/frontend/src/stores/tags.ts` to include `visible: boolean`
- [x] 4.2 Add `toggleVisibility(id: number)` action to the tags store that sends `PATCH /api/tags/:id` with toggled `visible`

## 5. Tag Management Page

- [x] 5.1 Add eye/eye-off icon button to each tag row in `packages/frontend/src/views/TagManagement.vue`
- [x] 5.2 Wire icon button click to `toggleVisibility` store action
- [x] 5.3 Style the icon button consistently with existing action buttons (color picker, delete)

## 6. Paper List Filter

- [x] 6.1 Filter the tag filter bar in `packages/frontend/src/views/PaperList.vue` to only show tags where `visible === true`

## 7. Documentation

- [x] 7.1 Update `docs/frontend-architecture.md` with tag visibility toggle feature

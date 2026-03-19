## 1. Dependencies & Types

- [x] 1.1 Install MD5 library (`ts-md5` or `spark-md5`) in `packages/frontend`
- [x] 1.2 Add `Highlight` type definition in `packages/shared/src/types.ts`

## 2. Database & Backend

- [x] 2.1 Add `highlights` table to `packages/backend/src/db/schema.ts` (id, pathname, content_hash, start_offset, end_offset, text, color, note, created_at)
- [x] 2.2 Generate Drizzle migration for the new table
- [x] 2.3 Create `packages/backend/src/api/highlights.ts` with 4 endpoints: GET (by pathname), POST, PUT (by id), DELETE (by id)
- [x] 2.4 Register highlights routes in the Fastify app

## 3. Frontend — Highlight Store & API

- [x] 3.1 Add highlight API functions in `packages/frontend/src/api/client.ts` (fetchHighlights, createHighlight, updateHighlight, deleteHighlight)
- [x] 3.2 Create `packages/frontend/src/stores/highlights.ts` Pinia store — load by pathname, group by content_hash, CRUD operations

## 4. Frontend — Core Highlight Logic

- [x] 4.1 Create `packages/frontend/src/composables/useHighlight.ts` — text node traversal utility with KaTeX atomic handling, offset computation, `<mark>` application
- [x] 4.2 Implement `applyHighlights(container, highlights)` — walks DOM text nodes, wraps offset ranges in `<mark>` elements, handles cross-element splits, verifies text match
- [x] 4.3 Implement `getSelectionOffsets(container)` — captures `window.getSelection()`, maps to rendered text offsets, auto-expands to full KaTeX elements if boundary falls inside

## 5. Frontend — MarkdownContent Component Upgrade

- [x] 5.1 Refactor `MarkdownContent.vue` from `v-html` to `ref` + `innerHTML` + DOM post-processing for highlight application
- [x] 5.2 Add `content_hash` computation (MD5 of content with whitespace stripped) and integrate with highlight store
- [x] 5.3 Implement text selection handler — on `mouseup`, detect selection, show floating toolbar with color buttons and note input
- [x] 5.4 Implement highlight hover tooltip (show note on hover)
- [x] 5.5 Implement highlight click menu (edit note / change color / delete)
- [x] 5.6 Add empty content guard — block highlight on empty content, show error alert

## 6. Frontend — Page-Level Integration

- [x] 6.1 Add highlight data loading in page components (`PaperDetail.vue`, `QAPage.vue`) — single `GET /api/highlights?pathname=...` call on mount, pass data to MarkdownContent via store

## 7. Styling & Polish

- [x] 7.1 Add highlight color CSS classes (yellow, green, blue, pink background colors with appropriate opacity)
- [x] 7.2 Style the floating selection toolbar, hover tooltip, and click menu

## 8. Documentation

- [x] 8.1 Update `docs/frontend-architecture.md` to document the highlight feature (data model, API, component interaction)

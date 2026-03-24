## 1. Source Link Component Refactor

- [x] 1.1 Extract source link tag from PaperList.vue into a reusable `SourceTag.vue` component (props: `link`, `arxiv_id`; renders red arxiv tag or gray domain tag or `-`; clickable to open link in new tab)
- [x] 1.2 Replace inline source tag rendering in PaperList.vue with the new `SourceTag` component
- [x] 1.3 Replace arxiv tag in PaperDetail.vue with the new `SourceTag` component

## 2. Backend Edit API

- [x] 2.1 Add `PATCH /api/papers/:id` endpoint in `packages/backend/src/api/papers.ts` — accepts optional `title`, `authors`, `link`, `content` fields; enforces arXiv title/authors lock; updates `contents.user_input` for content field; sets `updated_at`
- [x] 2.2 Add `PATCH /external-api/v1/papers/:id` endpoint in `packages/backend/src/external-api/papers.ts` with same behavior and Bearer Token auth
- [x] 2.3 Add `updatePaper` method in frontend papers store (`packages/frontend/src/stores/papers.ts`)

## 3. Backend Delete API

- [x] 3.1 Add `DELETE /api/papers/:id` endpoint with application-level cascade delete in a transaction (qa_results → qa_entries → service_executions → paper_tags → highlights → paper)
- [x] 3.2 Add `DELETE /external-api/v1/papers/:id` endpoint with same cascade logic and Bearer Token auth
- [x] 3.3 Add `deletePaper` method in frontend papers store

## 4. Frontend Edit Mode

- [x] 4.1 Add edit mode state and toggle button in PaperDetail.vue
- [x] 4.2 Implement edit form: title/authors/link input fields (disabled for arXiv papers' title/authors), content textarea with monospace font showing `contents.user_input`
- [x] 4.3 Implement save (sends PATCH with changed fields only) and cancel (discard changes) actions

## 5. Frontend Delete Confirmation

- [x] 5.1 Add delete button and confirmation dialog in PaperDetail.vue — shows paper title/ID, warning about cascade deletion, requires user to type the paper's numeric ID to enable the delete button (GitHub-style confirmation)
- [x] 5.2 On confirmed delete, call DELETE API and redirect to paper list

## 6. Documentation

- [x] 6.1 Update `docs/frontend-architecture.md` with edit/delete UI description and SourceTag component
- [x] 6.2 Update `docs/external-api.md` with PATCH and DELETE endpoint documentation

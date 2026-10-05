## 1. Backend — schema & migration

- [x] 1.1 In `packages/backend/src/db/schema.ts`, add `completed: integer('completed').notNull().default(0)` to the `notes` table.
- [x] 1.2 Generate the Drizzle migration (`cd packages/backend && bunx drizzle-kit generate`) — a plain `ALTER TABLE notes ADD COLUMN completed`.
- [x] 1.3 In `packages/shared/src/types.ts`, add `completed: boolean` to `Note` (and thus `NoteWithPaper`).

## 2. Backend — API

- [x] 2.1 In `api/notes.ts`, include `completed` (as a boolean) in `GET /api/papers/:id/note` and in the `GET /api/notes` aggregate rows. Ensure `PUT /api/papers/:id/note` (body upsert) leaves `completed` unchanged.
- [x] 2.2 Add `POST /api/papers/:id/note/completed` `{ completed: boolean }` (owner-scoped; auth guarded inline): set the existing note row's `completed`; reject/no-op if no row exists; return the updated note.
- [x] 2.3 Update `api/notes.test.ts`: GET/aggregate include `completed`; toggle sets it and persists; toggling a paper with no note is rejected; anonymous toggle → 401; body PUT preserves `completed`.

## 3. Frontend — client + store

- [x] 3.1 In `api/client.ts`, surface `completed` on the returned notes; add `notesApi.setCompleted(paperId, completed)` → `POST /api/papers/:id/note/completed`.
- [x] 3.2 In `stores/notes.ts`, expose `completed` (from `noteRow.completed`) and a `toggleCompleted(next: boolean)` action that calls the API and updates `noteRow.completed`. Guard: disabled when the note is empty.

## 4. Frontend — function-bar toggle

- [x] 4.1 In `components/notes/NoteWalkthrough.vue`, add a 2-state button group (In progress / Done) to the function bar, bound to `store.completed` → `store.toggleCompleted`; disable "Done" when the note has no content; show for authenticated users.

## 5. Frontend — paper list column

- [x] 5.1 In `views/PaperList.vue`, fetch the user's note statuses once (reuse `notesApi.listAll()`, now with `completed`) into a `Map<paperId, { completed }>`; add a "Note" column (header + per-row cell) rendering the 3-state icon: none (muted/dashed `Circle`), has-notes (`Circle`), completed (`CircleCheck`).
- [x] 5.2 Clicking a row's note-status cell navigates to `/papers/:id?view=note` (stop row-level propagation so it doesn't double-trigger the row's own navigation).

## 6. Frontend — open the Note tab

- [x] 6.1 In `components/PaperViewerPanel.vue`, read `route.query.view`; when it equals `note`, select the "Note" (walkthrough) tab on load instead of the default first-available mode.

## 7. Docs

- [x] 7.1 Update `docs/tech-stack.md` (notes table gains `completed`), `docs/frontend-architecture.md` (paper-list note-status column + function-bar completion toggle), and `docs/external-api.md` if note endpoints are listed.

## 8. Verify

- [x] 8.1 Backend: `bun test packages/backend/src/api/notes.test.ts` green. Frontend: `vue-tsc --noEmit` clean.
- [ ] 8.2 Manual QA: mark a note Done in the function bar → paper list shows the checked circle; a noted-but-not-done paper shows a circle; an un-noted paper shows the empty state; clicking the icon opens the paper's Note tab.

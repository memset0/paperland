## 1. Shared types

- [x] 1.1 In `packages/shared/src/types.ts`, change `NoteKind` from `'walkthrough' | 'note'` to `'root' | 'note'`.
- [x] 1.2 Remove the `{ walkthrough, notes }` read shape; the per-paper notes read is now `{ notes: Note[] }`. Keep `Note` and `NoteWithPaper` (drop any walkthrough-specific typing).

## 2. Database schema & migration

- [x] 2.1 In `packages/backend/src/db/schema.ts`, update the `notes.kind` comment/semantics to `'root' | 'note'` (column stays `text`).
- [x] 2.2 Generate the Drizzle migration (`cd packages/backend && bunx drizzle-kit generate`) and hand-edit it to perform the data migration in order: (a) `DELETE FROM notes WHERE kind='walkthrough'`; (b) insert one `root` note (`parent_id=NULL`, `title=NULL`, `body=''`, `sort_order=0`, timestamps `datetime('now')`) per (user_id, paper_id) that has a `kind='note'` row with `parent_id IS NULL`; (c) `UPDATE notes SET parent_id = <root id of same user+paper> WHERE kind='note' AND parent_id IS NULL`.
- [x] 2.3 Add a partial unique index `UNIQUE(user_id, paper_id) WHERE kind='root'` (created after the reparenting step).
- [x] 2.4 Sanity-check the migration against a copy of the dev DB: every (user, paper) with notes has exactly one `root`, and no `kind='note'` row has a null `parent_id`.

## 3. Backend API (`packages/backend/src/api/notes.ts`)

- [x] 3.1 Add an `ensureRoot(user_id, paper_id)` helper that returns the existing `root` note or inserts one in a transaction; make it idempotent under the partial unique index (catch a losing insert and re-read the winner).
- [x] 3.2 Remove `PUT /api/papers/:id/walkthrough`.
- [x] 3.3 Change `GET /api/papers/:id/notes` to return `{ notes }` (flat list incl. the root note if present; empty array for anonymous → HTTP 200).
- [x] 3.4 Add `PUT /api/papers/:id/root`: upsert the root note via `ensureRoot`, apply `body`; on create return 201, on update enforce optimistic `updated_at` (200/409); the first create requires no prior `updated_at`.
- [x] 3.5 Update `POST /api/papers/:id/notes`: when no `parent_id` is given, call `ensureRoot` and attach the new note under the root, creating root + child in one transaction; otherwise behave as before (validate parent ownership, compute `sort_order`).
- [x] 3.6 Update `POST /api/notes/:id/move` and `DELETE /api/notes/:id` to reject a `root`-kind target with HTTP 400.
- [x] 3.7 Update `GET /api/notes` (cross-paper aggregate) to drop walkthrough handling and exclude notes with empty (trimmed) `body`.

## 4. Frontend store (`packages/frontend/src/stores/notes.ts`)

- [x] 4.1 Remove `walkthrough` ref and `saveWalkthrough`; keep a single `notes` list.
- [x] 4.2 Simplify `buildTree` to assume a single root: the `kind='root'` node is the tree root and all other notes are descendants.
- [x] 4.3 Present a synthetic, unsaved root node (`id: null`) when the fetched list has no `root` row, so the mind-map always has a center node; adopt the real id after lazy creation.
- [x] 4.4 Add a `saveRoot(body)` action calling `PUT /api/papers/:id/root`, and update `createNote` to support a parentless create that triggers server-side root creation.
- [x] 4.5 Expose a computed note count = notes with non-empty trimmed `body`.

## 5. Frontend components

- [x] 5.1 `PaperNotesCard.vue`: remove the Walkthrough section; the section is just the mind-map (rooted at the root note) for authenticated users, login prompt for anonymous.
- [x] 5.2 `NoteMindmap.vue`: always render the root note as the center node (placeholder when unsaved); change the header count to the non-empty-body count from the store.
- [x] 5.3 `NoteNode.vue`: mark the root node as non-draggable and non-deletable; clicking it opens the root editor; drop-on-empty-canvas reparents under the root (`parent_id = root.id`) instead of making a node parentless.
- [x] 5.4 `NoteEditor` / floating window: open the root note in the same editor; show a root-note label in the title bar when editing the root.
- [x] 5.5 `NotesPage.vue`: remove walkthrough grouping/ordering; list notes uniformly (non-empty bodies), keep search and `paperland://` anchor navigation.

## 6. Cleanup & sweep

- [x] 6.1 Grep `packages/` for remaining `walkthrough` references and remove/replace them (routes, query params like `?walkthrough=1`, labels, types).
- [x] 6.2 Update `packages/backend/src/api/notes.test.ts` (and any notes tests) to the new model: `{ notes }` shape, root lazy creation, count-by-content, move/delete-root rejection. Run only the notes tests (they do not hit external APIs).

## 7. Docs

- [x] 7.1 Update `docs/frontend-architecture.md` to describe the unified note model: single tree per (user, paper) under a lazily-created root note, removal of the walkthrough, the `PUT /api/papers/:id/root` endpoint, and note-count-by-content.
- [x] 7.2 Update any notes API description in `docs/` (e.g. external-api.md if it mentions notes) to drop the walkthrough endpoint and reflect `{ notes }`.

## 8. Verification

- [x] 8.1 Run `bun run dev` from project root; verify: a paper with no notes shows an empty center root node and contributes 0 to the count; writing to the root lazily creates it; adding a first child creates root + child; empty notes are not counted; the root cannot be dragged or deleted; the `/notes` page lists only non-empty notes.
- [x] 8.2 Confirm no `packages/backend/data/` directory was created (backend ran from project root) before committing.

## 1. Shared types & contracts

- [x] 1.1 In `packages/shared/src/types.ts`, change `Note` to the single-document shape (`id`, `user_id`, `paper_id`, `body`, `created_at`, `updated_at`); remove `NoteKind`, `parent_id`, `kind`, `title`, `sort_order`. Keep `NoteWithPaper extends Note { paper_title }`.
- [x] 1.2 Define the heading-section model types (e.g. `NoteSection { level, heading, leafBody, range, children }` and a `NoteDocTree` / fingerprint type) in shared or frontend, per design D2/D7.

## 2. Backend — schema & migration

- [x] 2.1 Update `packages/backend/src/db/schema.ts`: reduce `notes` to `id`, `user_id`, `paper_id`, `body`, `created_at`, `updated_at`; replace the `notes_root_unq` partial index with a plain unique index on `(user_id, paper_id)`; drop `kind`/`parent_id`/`title`/`sort_order`.
- [x] 2.2 Write a one-time data migration that (a) backs up `data/paperland.db` via the existing backup utility, (b) for each (user, paper) flattens the note tree into one Markdown document using the walkthrough flattening (title→depth heading, body following, body headings re-leveled, root body as preamble; NO auto-numbering), writing it into the surviving row's `body`, and (c) deletes the other rows.
- [x] 2.3 Generate the Drizzle migration (`cd packages/backend && bunx drizzle-kit generate`) for the column-drop + unique-index change, sequenced after the data flatten (see design Migration Plan).
- [x] 2.4 Add a guard/order so the data flatten runs before the destructive column drop (single migration script or ordered steps), and is idempotent / safe to re-run.

## 3. Backend — API

- [x] 3.1 In `packages/backend/src/api/idea-forge.ts`/notes route module, replace the tree endpoints with `GET /api/papers/:id/note` (returns `{ note }` or empty; owner-scoped; anonymous → 200 empty) and `PUT /api/papers/:id/note` (upsert whole `body` with optimistic `updated_at`; first write needs no prior timestamp; 409 with latest on stale).
- [x] 3.2 Update `GET /api/notes` to return one note per paper (the single document) with `paper_id` + `paper_title`, non-empty bodies only, owner-scoped (401 anonymous).
- [x] 3.3 Remove `POST /api/papers/:id/notes`, `POST /api/notes/:id/move`, `DELETE /api/notes/:id` (subtree), and `PUT /api/papers/:id/root`, plus their helpers (`ensureRoot`, cycle checks, subtree walk).

## 4. Backend — tests

- [x] 4.1 Unit-test the migration flatten on fixtures: a multi-node tree, an untitled note, a note whose body has its own headings, an empty/lazy paper (no rows) → assert the produced Markdown and that one row remains per (user, paper).
- [x] 4.2 Test the new endpoints: owner read/empty/anonymous, first-write create (no timestamp), stale `updated_at` → 409, aggregate one-per-paper non-empty. (Use the local SQLite test DB; do not hit external services.)

## 5. Frontend — Markdown heading-section model

- [x] 5.1 Add a `notes/markdown-doc.ts` utility: parse a Markdown string into the heading-section tree (relative-depth hierarchy, leaf body = text up to next heading, preamble = text before first heading, byte ranges preserved).
- [x] 5.2 Add structural transforms that rewrite the raw string minimally: reparent/reorder a section (re-level + move its lines and descendants), insert a child/sibling heading, delete a section + subtree; all return new raw text leaving untouched text byte-identical.
- [x] 5.3 Add fingerprint helpers: structure fingerprint (levels + heading text + sibling order) and per-section content baseline hash (leaf body), per design D7. Add the leaf-only heading→bold normalizer for floating windows.

## 6. Frontend — notes store

- [x] 6.1 Rewrite `stores/notes.ts` to hold a single reactive document (canonical raw Markdown + memoized derived section tree); fetch via `GET /api/papers/:id/note`; expose the section tree, preamble, and a per-paper non-empty count.
- [x] 6.2 Implement write-through editing: leaf-content updates (from floating windows, heading→bold normalized) and whole-document updates (from edit/split mode) mutate the single shared string; debounced whole-document `PUT` with optimistic `updated_at`; 409 → "modified elsewhere" + reload path.
- [x] 6.3 Implement structural ops (drag/add/delete) on the document via the §5.2 transforms, plus a front-end-only undo history of structural edits; firing a structural op closes open floating windows.
- [x] 6.4 Implement the editing-context model (render = visual; edit/split = whole-doc, closes windows; mind-map read-only in edit/split) and the floating-window registry with one-window-per-section + strict binding (capture structure fingerprint + section baseline at open; refuse write-through + raise conflict prompt on mismatch; re-check after reload).

## 7. Frontend — mind-map (right panel)

- [x] 7.1 Update `components/notes/NoteMindmap.vue` + `NoteNode.vue` to derive nodes from the document's heading sections (center = paper title / preamble; nodes by relative depth; leaf-body char-count badge); header count = non-empty sections.
- [x] 7.2 Wire node interactions: tap → open floating section editor; drag-reparent / drop-on-canvas → §6.3 structural ops with optimistic update + revert on invalid; add child/sibling, delete-with-descendant-count; center node not draggable/deletable; touch + pointer parity with tap threshold.

## 8. Frontend — floating editor window

- [x] 8.1 Update `components/notes/NoteEditor.vue` (window) to edit one section's leaf content (or the preamble for the center node), title bar shows the heading text / preamble label, positions to the section, reuses `MarkdownContent` preview, keeps the 3 display modes + size memory + stacking.
- [x] 8.2 Bind the window to the shared document (no private buffer): write-through on input with heading→bold normalization, flush on blur/Enter/close, IME-safe; show the strict-binding conflict prompt and preserve the user's text on refusal.

## 9. Frontend — left-panel document view (walkthrough)

- [x] 9.1 Update `components/notes/NoteWalkthrough.vue` into the 3-mode left panel: render (default, reading-oriented sizing, auto-numbered headings derived from the doc, clickable headings → floating editor, no highlighting), edit (whole-document Markdown textarea), split (editor + render).
- [x] 9.2 Auto-numbering + clickable headings operate on the document's own headings at render time; entering edit/split closes floating windows; live re-render on any document change (leaf edit, structural edit, or direct edit).

## 10. Frontend — paper detail integration

- [x] 10.1 Update `components/PaperNotesCard.vue` / the paper detail layout to show the left document view + right heading-derived mind-map for authenticated users; anonymous → login prompt; remove the old root/tree wiring and `?note=`/`?root=` deep-link handling (replace with section deep-link if still needed).

## 11. Frontend — /notes aggregate page

- [x] 11.1 Update `views/NotesPage.vue` to list one note per paper (non-empty), ordered by recency, client-side search over body; selecting navigates to that paper's note view; `paperland://` anchors remain clickable; anonymous gated.

## 12. Docs & spec sync

- [x] 12.1 Update `docs/frontend-architecture.md` notes section (single-document model, 3-mode left panel, heading-derived mind-map, floating section windows, shared-editing concurrency model) and `docs/external-api.md` if note endpoints are listed.
- [x] 12.2 Fold any post-apply tweaks back into this change's `proposal.md` / delta specs / `tasks.md` before archiving (per CLAUDE.md).

## 13. Verify

- [x] 13.1 Run the migration on a copy of the real DB; spot-check that migrated documents' mind-maps match the pre-migration node trees for a sample of papers; confirm the backup exists.
- [x] 13.2 Manual QA: render/edit/split switching, mind-map drag/add/delete + undo, floating section editing with heading→bold, structural-change auto-close, and a cross-tab edit producing a conflict prompt (no silent overwrite).

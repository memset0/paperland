## Why

The current notes feature stores each paper's notes as a tree of many small note rows (a `root` note plus child `note` rows), each separately created, titled, moved, reordered, and edited. Managing this many small notes is tedious. Users want **one big note per paper** that they edit as a single Markdown document, while keeping the mind-map-based visual editing they like. The mind-map and the reading "walkthrough" should be **derived from that one document's heading structure** rather than from a tree of rows.

## What Changes

- **BREAKING** Replace the per-(user, paper) note *tree* with a **single Markdown document** per (user, paper). The `notes` table collapses to one row per (user, paper); the row's `body` holds the whole note. The tree columns (`kind`, `parent_id`, `title`, `sort_order`) are dropped.
- **Migrate existing notes in place**: back up the DB, then flatten each paper's note tree into one Markdown document using the current walkthrough assembly (note `title` → heading by tree depth, body headings re-leveled to nest under, root `body` kept as a preamble), then delete the now-redundant child rows. The mind-map produced from a migrated document matches the pre-migration mind-map.
- **Two renderings of the one document**:
  - **Full-note render (walkthrough)** in the left panel — reading-oriented rendering of the Markdown (compact body, scaled + auto-numbered headings, clickable headings → editor, no highlighting), now with **three left-panel modes**: edit / split / render (default render).
  - **Mind-map** in the right panel — derived from the document's **heading structure** (relative heading depth → hierarchy; per-section leaf-body char-count badge; center node = the paper title, editing it edits the pre-heading preamble).
- **Keep mind-map structural editing**: drag-reparent / reorder, add child / sibling, delete subtree — now implemented as **heading rewrites** on the one document.
- **Floating section editor**: clicking a mind-map node (or a render-mode heading) opens a floating window that edits **only that heading's leaf content** (the text from the heading up to the next heading). Headings typed inside a floating window are **demoted to bold**, so a window can never change document structure.
- **New shared-editing concurrency model** (`notes-shared-editing`): one in-memory reactive document that all editing surfaces write through to (no private snapshots); editing is **modal** (render mode = visual / floating editing with the left panel as a live preview; edit / split mode = whole-document editing with floating windows closed); any **structural change closes all floating windows**; whole-document save uses an optimistic `updated_at` lock for cross-tab / cross-device safety (no real-time merge).
- **Simplify the notes API**: remove the tree endpoints (`POST /api/papers/:id/notes`, `POST /api/notes/:id/move`, the subtree `DELETE /api/notes/:id`, lazy-root `PUT /api/papers/:id/root`); replace with get + whole-document save for the single note. `GET /api/notes` aggregate returns one note per paper.
- **Remove obsolete behaviors**: per-note titles, sibling `sort_order`, subtree deletion, the server move endpoint and its server-side move undo (the mind-map undo now operates on client-side document heading edits).

## Capabilities

### New Capabilities
- `notes-shared-editing`: the cross-surface concurrency model for the single note document — one shared reactive document with write-through, modal editing contexts, the structural-change-closes-windows invariant, and cross-tab optimistic-lock persistence.

### Modified Capabilities
- `paper-notes`: note data model collapses to one Markdown document per (user, paper); API simplifies to get / save the whole document; one-time migration from the old tree; lazy creation and note-count rules updated.
- `note-mindmap`: nodes and hierarchy are derived from the document's heading structure (not note rows); center node = the paper title editing the preamble; structural edits rewrite headings; clicking a node opens a floating section editor.
- `note-editor-window`: the floating window edits a single heading's leaf content only, demotes typed headings to bold, binds to the shared document via write-through, and auto-closes on a structural change.
- `notes-walkthrough`: redefined as the left-panel view of the single Markdown document with three modes (edit / split / render); render mode keeps reading-oriented sizing, auto-numbering, clickable headings, and no highlighting.
- `notes-page`: the `/notes` aggregate lists one note per paper (the single document), searchable; selecting opens that paper's note.

## Impact

- **DB / schema**: `notes` table reduced to one row per (user, paper) — `id`, `user_id`, `paper_id`, `body`, `created_at`, `updated_at`, with a unique index on `(user_id, paper_id)`. A Drizzle migration drops `kind` / `parent_id` / `title` / `sort_order`. A one-time data migration (preceded by a DB backup) flattens existing trees into the single document.
- **Backend**: `packages/backend/src/api/notes.ts` (endpoints), `packages/backend/src/db/schema.ts`, and shared types in `packages/shared/src/types.ts` (`Note` loses `kind` / `parent_id` / `title` / `sort_order`; `NoteKind` removed; `NoteWithPaper` kept).
- **Frontend**: `stores/notes.ts` (single-document shared state, write-through, Markdown heading-section parse / serialize), `components/notes/NoteMindmap.vue`, `NoteNode.vue`, `NoteWalkthrough.vue`, `NoteEditor.vue`, `PaperNotesCard.vue`, `views/NotesPage.vue`, plus a Markdown heading-section utility module.
- **Docs**: `docs/frontend-architecture.md` (notes section), and `docs/external-api.md` if the note endpoints are listed there.

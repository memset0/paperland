## Why

The notes system currently splits notes into two kinds — a single linear `walkthrough` (one per user per paper) and a tree of `note` (small notes). The walkthrough feature was built but never actually used (no walkthrough rows exist), and maintaining the two-kind distinction adds complexity to the schema, the API, and the UI. We want to collapse everything into a single uniform note type organized as one tree per paper, anchored by a lazily-created **root note**. Any future "walk through the whole paper" experience will be a separate, dedicated walkthrough view — not a special note kind.

## What Changes

- **BREAKING**: Remove the `walkthrough` note kind entirely — the `kind` column changes from `'walkthrough' | 'note'` to `'root' | 'note'`, and the `PUT /api/papers/:id/walkthrough` endpoint, the frontend walkthrough section/store state, and the walkthrough grouping on the `/notes` page are all removed. (No walkthrough data exists, so nothing is lost.)
- Introduce a **root note** per (user, paper): a single `kind='root'` node that is the parent of the whole note tree. All previously top-level notes (`parent_id IS NULL`) become children of the root note. The overall tree shape is otherwise unchanged.
- **Lazy creation**: papers with no notes have zero rows in the database. The root note is created lazily — only when the user writes content into it or attaches the first child note. The backend transparently creates the root when needed (e.g. when the first child note is added, both the root and the child are created).
- **Content-based note count**: a note (root or otherwise) counts toward a paper's note total only if its Markdown `body` is non-empty. An empty root note does not count; a node with a title but no body does not count. The mind-map count and the `/notes` aggregate reflect this.
- The mind-map always renders the root note as the central node; clicking it edits the root note's body. Creating a top-level note creates a child of the root. The root note cannot be moved or deleted.
- `GET /api/papers/:id/notes` returns a single note list (no separate `walkthrough` field), from which the client builds one tree rooted at the root note.

## Capabilities

### New Capabilities
<!-- none — this change refactors existing notes capabilities -->

### Modified Capabilities
- `paper-notes`: data model loses the `walkthrough` kind and gains the `root` kind; the walkthrough endpoint is removed; root notes are lazily created; the API returns a single note list; note counting is defined by non-empty `body`.
- `note-mindmap`: the mind-map always shows the root note as its center node, editing it edits the root note, top-level notes are children of the root, the root cannot be moved/deleted, and the displayed count reflects only non-empty-body notes.
- `notes-page`: the aggregate API and `/notes` page no longer special-case walkthroughs; they list notes (with non-empty body) across papers under the unified model.
- `note-editor-window`: the editor no longer has a walkthrough label/mode; the root note is edited in the same floating window as any other note.

## Impact

- **Schema / DB**: `notes.kind` values change (`walkthrough`→removed, add `root`); a Drizzle migration removes any stray walkthrough rows, creates a root note for each (user, paper) that currently has top-level notes, and reparents those top-level notes under the new root.
- **Backend** (`packages/backend/src/api/notes.ts`): remove the walkthrough upsert endpoint; add an "ensure root" helper used by root-edit and first-child creation; `GET` returns `{ notes }` (no `walkthrough`); add note-count semantics.
- **Shared** (`packages/shared/src/types.ts`): `NoteKind` becomes `'root' | 'note'`; drop the `{ walkthrough, notes }` read shape.
- **Frontend**: `stores/notes.ts` (drop walkthrough state, build one tree from the root), `PaperNotesCard.vue` (remove walkthrough section), `NoteMindmap.vue` (render root center node, count non-empty bodies), `NoteNode.vue` (guard move/delete on the root), `NotesPage.vue` (drop walkthrough grouping), `NoteEditor`/window (drop walkthrough label).
- **Docs**: update `docs/frontend-architecture.md` (and any notes API notes) to describe the root-note model and the removal of walkthroughs.
- Existing users' top-level notes are preserved and re-parented; no note content is lost.

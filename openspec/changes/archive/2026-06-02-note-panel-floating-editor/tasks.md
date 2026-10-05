## 1. Windows store — whole-document window kind

- [x] 1.1 In `stores/windows.ts`, support a whole-document window distinct from section windows: add a `kind: 'section' | 'doc'` (or equivalent) to the target, key the doc window as `${paperId}:doc` (one per paper, re-open focuses), and keep section windows keyed by `sectionId`. Expose a helper/getter `isDocWindowOpen(paperId)`.

## 2. Whole-document floating editor

- [x] 2.1 Make `FloatingNoteWindow.vue` render the whole-document editor for a `doc`-kind window (title e.g. "Note"); for `section` windows it stays as today.
- [x] 2.2 Editor for the doc window: reuse `NoteEditor.vue` with a `doc` branch (or a small sibling component) that binds to `store.body` directly with write-through, keeps the three view modes (Editor / Split / Preview), and does **not** demote headings or use the per-section content baseline (it edits the whole document).

## 3. Store — coordination / mutual exclusion (extends notes-shared-editing)

- [x] 3.1 In `stores/notes.ts`, treat the whole-document window as a whole-doc editing context: opening it SHALL close all open section windows and force `panelMode = 'render'`.
- [x] 3.2 Entering the left panel's edit/split mode, or opening a section window, SHALL close the whole-document window (so only one active whole-note editor exists).
- [x] 3.3 Expose reactive `docWindowOpen` (derived from the windows store) for the left panel to read.

## 4. Left "Note" panel (NoteWalkthrough)

- [x] 4.1 Add an "open in floating window" button to the mode bar (next to edit/split/render) that opens the whole-document window.
- [x] 4.2 While `docWindowOpen` is true, lock the panel to render: force render mode and disable/grey-out the edit & split buttons (the pop-out button may focus/close the floating editor).

## 5. Left viewer tab (PaperViewerPanel)

- [x] 5.1 Make the note tab **always available** (drop the `noteCount > 0` gate) and relabel it from "Walk-through" to **"Note"**; keep it in the data-driven mode list (auto-select/switching unchanged). Ensure `NoteWalkthrough` renders a graceful empty state when there's no note / anonymous user.

## 6. Right notes card (PaperNotesCard)

- [x] 6.1 Add a control (e.g. in the card header) that opens the whole-document floating editor directly (`windows.open({ paperId, kind: 'doc' })`), shown for authenticated users.

## 7. Paper detail layout

- [x] 7.1 In `views/PaperDetail.vue`, move the Kimi auto-summary block (摘要 label + "Kimi 自动摘要" card + its collapsibles) to **directly below** `<PaperNotesCard>` in **both** layout branches (split-view and single-column). Template-only reorder.

## 8. Docs

- [x] 8.1 Update `docs/frontend-architecture.md` (notes + viewer sections): always-on "Note" tab (renamed from Walk-through), whole-document floating editor + render lock + open affordances, Kimi summary below the notes card.

## 9. Verify

- [x] 9.1 `vue-tsc --noEmit` clean.
- [ ] 9.2 Manual QA: Note tab shows even with an empty note; opening the whole-doc editor locks the left to render and closes section windows; entering left edit/split closes the doc editor; the doc editor's 3 views work and headings aren't demoted; the notes-card button opens it; Kimi summary sits below the notes card.

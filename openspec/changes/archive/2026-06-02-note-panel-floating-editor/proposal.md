## Why

The note document only shows in the left viewer when it already has content (the tab is gated on note count), and its label "Walk-through" no longer fits the single-document model. Editing the whole note also only happens inline in the left panel — there's no way to pop it out, and the user wants whole-document editing in a floating window (like the per-section windows), while keeping the left panel from becoming a second active editor of the same note. The Kimi auto-summary card also sits above the notes card, but reads better below it.

## What Changes

- **Always-on "Note" tab**: The left viewer's note tab SHALL always be available (regardless of whether the note has content), and SHALL be relabeled from **"Walk-through"** to **"Note"**.
- **Whole-document floating editor**: Add a floating window that edits the **whole note document** with the same three views as the per-section windows (Editor / Split / Preview), writing through to the shared document.
- **One active whole-doc editor at a time**: While the whole-document floating editor is open, the left "Note" panel SHALL **lock to render (preview) mode** — its edit/split mode switching disabled — so the page never has two active whole-note editors. Opening the floating editor closes any open section windows; switching the left panel into edit/split (or opening a section window) closes the floating editor.
- **Open affordances**: A control to open the whole-document floating editor SHALL be added to (a) the left "Note" panel's mode bar and (b) the right-hand notes card (clicking it opens the floating editor directly).
- **Layout**: Move the **Kimi auto-summary** card to **directly below** the notes card in the paper detail layout.

## Capabilities

### Modified Capabilities
- `paper-viewer-modes`: the left viewer's note tab is always available (not gated on note content) and is relabeled "Note".
- `notes-walkthrough`: the left Note panel adds an "open in floating window" control to its mode bar and locks to render mode (mode switching disabled) while the whole-document floating editor is open.
- `note-editor-window`: add a whole-document floating editor window (three views, write-through to the whole `body`, no heading demotion) that is a whole-doc editing context, mutually exclusive with the left edit/split and section windows.
- `paper-notes`: the notes card gains a control to open the whole-document floating editor; the Kimi auto-summary card is placed directly below the notes card.

## Impact

- **Frontend only.** `components/PaperViewerPanel.vue` (tab label + always-available), `components/notes/NoteWalkthrough.vue` (mode-bar pop-out button + render lock), `components/notes/FloatingNoteWindow.vue` + `NoteEditor.vue` (or a whole-doc editor variant) + `stores/windows.ts` (a whole-doc window target), `stores/notes.ts` (lock/coordination state), `components/PaperNotesCard.vue` (open-editor control), `views/PaperDetail.vue` (move the Kimi summary card below the notes card, in both layout branches).
- **Docs**: `docs/frontend-architecture.md` (notes + viewer sections).

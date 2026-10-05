## Context

After `redesign-notes-single-doc`, a note is one Markdown document. The left viewer shows it via `NoteWalkthrough` (three modes: render / edit / split) behind a "Walk-through" tab that is gated on `noteCount > 0`. Per-section editing happens in floating windows (`FloatingNoteWindow` + `NoteEditor`, keyed by section id) that write through to the shared `store.body`. The shared-editing model (`notes-shared-editing`) already enforces "at most one active text editor": entering the left edit/split mode closes section windows. This change adds a **whole-document** floating editor and makes the left panel a first-class "Note" surface.

## Goals / Non-Goals

**Goals:**
- The left "Note" tab is always present (renamed from "Walk-through"), even for an empty/absent note.
- Whole-document editing can pop out into a floating window with the same three views as section windows.
- Never two active whole-note editors at once: while the whole-doc window is open, the left panel is locked to render.
- Open the whole-doc editor from both the left mode bar and the right notes card.
- Kimi auto-summary card sits directly below the notes card.

**Non-Goals:**
- Changing per-section window behavior (leaf-only editing, heading→bold, binding) — unchanged.
- Any backend/schema/API change.

## Decisions

### D1 — Whole-document window as a distinct window kind
`stores/windows.ts` gains a window **kind**: section windows keep their `sectionId`-based key; the whole-document editor is a single window per paper, keyed `${paperId}:doc`. The target carries enough to distinguish it (e.g. `kind: 'doc'`), so the registry still enforces one-per-key (re-opening focuses it).

### D2 — Whole-doc editor reuses the floating-window chrome, edits `store.body`
The whole-doc window renders inside `FloatingNoteWindow` (same drag/resize/stack/size-memory). Its editor is the section `NoteEditor` extended (or a sibling component) for the `doc` kind: it binds to **`store.body`** directly with write-through (like the left edit/split), keeps the three view modes (Editor / Split / Preview), and — because it is the whole document — does **not** demote headings and does **not** use the per-section content baseline. It is a whole-document editing context.

### D3 — Mutual exclusion: one active whole-note editor
Extend the editing-context model (`notes-shared-editing` / `stores/notes.ts`):
- **Opening the whole-doc window** closes all open section windows and forces the left panel to **render** mode.
- **While the whole-doc window is open**, `NoteWalkthrough`'s edit/split buttons are **disabled** (the panel is locked to render); the mode bar instead offers a control to focus/close the floating editor.
- **Entering the left edit/split mode, or opening a section window**, closes the whole-doc window.
The "is the whole-doc window open for this paper?" state is derived from the windows store; `NoteWalkthrough` reads it to lock its mode bar.

### D4 — Always-on "Note" tab
`PaperViewerPanel`: the note tab's `available` becomes always-true and its `label` becomes **"Note"** (was `noteCount > 0` / "Walk-through"). `NoteWalkthrough` already renders an empty state ("No notes yet") and, for an unauthenticated user, the note is absent — render shows empty; editing affordances require login (consistent with the rest of notes). The tab keeps participating in the data-driven mode system (auto-select, switching) unchanged.

### D5 — Open affordances
- **Left mode bar** (`NoteWalkthrough`): add a "pop out / edit in floating window" button next to the edit/split/render switch.
- **Right notes card** (`PaperNotesCard`): add a small control (e.g. in the card header) that opens the whole-doc window directly.
Both call `windows.open({ paperId, kind: 'doc', … })`.

### D6 — Kimi summary below the notes card
In `views/PaperDetail.vue`, move the Kimi auto-summary block (the `摘要` label + "Kimi 自动摘要" card + its collapsibles) to **directly below** `<PaperNotesCard>` in **both** layout branches (split-view and single-column). Pure template reordering; no logic change.

## Risks / Trade-offs

- **[Two whole-doc editors race]** → Prevented by D3 (the left locks to render whenever the floating whole-doc window is open, and the two are mutually exclusive). The existing write-through + optimistic-lock model still backs cross-tab safety.
- **[Empty/anonymous "Note" tab]** → The tab is always shown; `NoteWalkthrough` renders an empty state, and writing requires login — acceptable and consistent with the notes capability.
- **[Reusing `NoteEditor` for two kinds]** → Keep the section path (leaf + demotion + binding) intact and branch on the `doc` kind; if branching gets messy, split into a small dedicated whole-doc editor component.

## Context

Small notes are stored as a single per-(user, paper) tree: a flat `notes` list (`id`, `parent_id`, `title`, `body`, `sort_order`, `kind`) is assembled client-side by `buildRootTree()` into a reactive `tree` computed in `packages/frontend/src/stores/notes.ts`. The mind-map (`NoteMindmap.vue` / `NoteNode.vue`) renders this tree; node bodies are edited in floating windows (`NoteEditor.vue`). The paper detail left panel (`PaperViewerPanel.vue`) is a data-driven tab viewer with PDF and translation iframe modes. Markdown is rendered by `MarkdownContent.vue` (markdown-it + KaTeX), which styles H1–H3.

This change adds a read-oriented "walkthrough" rendering of the same tree, surfaced as a new left-panel viewer mode, plus a character-count badge on mind-map nodes. No backend/schema/API changes are needed — both features derive entirely from the already-fetched notes tree.

## Goals / Non-Goals

**Goals:**
- Flatten the notes tree into ordered sections in mind-map (depth-first, `sort_order`) order, with depth-based heading re-leveling starting at H2 and hierarchical `1.2.3.` heading numbers.
- Render it as a live reading view in the left panel: headings rendered by the view (numbered, clickable to open the note's editor), bodies via `MarkdownContent.vue` with highlighting disabled.
- Re-render automatically on note edits and reparent/reorder, via the existing reactive `tree` computed.
- Reading-oriented sizing scoped to the view; show a grey `(N)` body character-count badge on non-empty mind-map nodes.

**Non-Goals:**
- A dedicated mind-map "view" mode (the user's deferred second view) — not in this change.
- *Inline* editing within the walkthrough — clicking a heading opens the existing floating editor instead; the walkthrough text itself is read-only.
- Highlighting inside the walkthrough (explicitly disabled — incompatible with the content-hash highlight model).
- Backend rendering, persistence of the assembled document, or export/download.
- Anchoring/scroll-sync between the mind-map and the walkthrough.

## Decisions

### Structured assembly as a pure function over the reactive tree
Add a pure helper `flattenWalkthrough(root: NoteTreeNode): WalkthroughSection[]` in `stores/notes.ts` next to `buildRootTree` that walks `NoteTreeNode` depth-first and returns **structured sections** — `{ noteId, isRoot, level, number, title, body }` — rather than a single Markdown string. Because it is computed from the store's reactive `tree`, any edit/move that updates `notes` flows through `tree` → sections → render automatically. No watchers or manual refresh.

Rationale for structured sections over a single string: the headings need to be **interactive** (carry `noteId` for click-to-edit) and **numbered**, which a flat Markdown blob can't express cleanly. Returning sections lets the component render each heading as a real element with a click handler and a number, and render each body separately. (The earlier single-string `assembleWalkthrough` is replaced by this.)

### Heading model: numbered, view-rendered note titles; bodies via MarkdownContent
For each non-root note at mind-map depth `d` (root's children = depth 0), the section has `level = min(2 + d, 6)` and a hierarchical `number` (e.g. `1.2.3.`). The component renders the **note-title** heading itself via `<component :is="'h' + level">` (number + title + persistent edit icon), and renders the `body` through `MarkdownContent` (highlights disabled). The root contributes its `body` as a heading-less, unnumbered intro section (rendered verbatim).

Headings the user typed *inside* a note body are NOT left verbatim anymore — they are re-leveled to nest under their note and numbered (see below). They remain plain rendered Markdown (not clickable, no edit icon). Note-title levels are still determined solely by mind-map depth. Deep trees can exceed H6; the rendered `#`/tag clamps at 6 while numbering keeps reflecting true outline depth.

### Auto-numbering across note titles AND body headings
A single `outlineNumberer()` (a `counters[]` stack indexed by *section level* `sl`, 1-based) is threaded through the whole walk: `next(sl)` increments `counters[sl]`, truncates deeper entries, and joins `counters[1..sl]` with dots + a trailing dot → `1.`, `1.2.`, `1.2.3.`. A note at depth `d` uses `sl = d + 1`.

`numberBodyHeadings(body, noteSl, next)` re-levels a body's ATX headings so the shallowest authored level sits at `sl = noteSl + 1` (one below the note) and deeper authored levels keep relative nesting (distinct authored levels → contiguous ranks, avoiding numbering gaps). Crucially, body headings are numbered *right after the note title and before the note's child notes*, so a note's own subsections and its child notes interleave in one continuous outline (note `1.`’s body heading → `1.1.`, its first child note → `1.2.`). Headings inside fenced code blocks (``` / ~~~) are skipped. This is why the assembler returns structured sections and transforms each body string, rather than emitting one opaque Markdown blob.

### Click a note-title heading to open the editor
Each **note-title** heading is clickable and calls `windows.open({ kind: 'note', paperId: store.currentPaperId, noteId, title })` — the same floating-editor window model the mind-map uses — so a user can jump from reading to editing. The heading shows a persistent edit icon (always visible) and a hover underline cue. Body-internal headings are not clickable (no note to open). The walkthrough itself stays read-only (no inline editing).

### No highlighting in the walkthrough (`disableHighlights` prop)
Highlights are keyed by a content hash of the rendered Markdown; the walkthrough's content is dynamically assembled and changes on every edit/move, so highlights can't stick and would be orphaned. Add a `disableHighlights` prop to `MarkdownContent.vue` that (a) makes `myHighlights` return `[]` (no stored highlights rendered) and (b) skips the `selectionchange`/dismiss listeners in `onMounted` (no selection toolbar, no click-menu). Anchor-link and KaTeX-copy clicks (bound inline on the container) still work. `NoteWalkthrough` passes `:disable-highlights="true"`.

Alternative considered: a separate lightweight Markdown renderer for the walkthrough. Rejected — it would duplicate KaTeX/anchor/code handling; a single prop on the shared component is far smaller.

### Surface as a data-driven viewer mode
Extend the `modes` array in `PaperViewerPanel.vue` with a `walkthrough` entry (new `type: 'walkthrough'`, or render a dedicated component in its `TabsContent`). `PaperViewerPanel` currently only receives `pdfPath`/`arxivId` props; the walkthrough needs the notes tree. Options:
- (chosen) Render a self-contained `NoteWalkthrough.vue` inside the walkthrough tab that reads the notes store directly (the store is already loaded per paper) and computes the document + renders `MarkdownContent`. `PaperViewerPanel` only needs an `available` flag (e.g. derived from a `hasNotes`/`noteCount` signal it can read from the store, or a passed-in boolean).
- Rejected: threading the whole assembled string through props — couples the panel to notes and loses the store's reactivity boundary.

Availability: show the tab when the notes tree has content (`noteCount > 0`, i.e. at least one non-empty body). This avoids an empty walkthrough tab on papers with no notes. (If desired later, it could always show; starting conservative.)

Ensure the notes store is fetched for the paper on the detail page. `PaperNotesCard` already drives notes; confirm `fetchForPaper` runs regardless of whether the card is in view so the left-panel mode has data. If not guaranteed, trigger the fetch in `PaperDetail.vue` on paper load.

### Character-count badge in `NoteNode.vue`
In `NoteNode.vue`, add a computed `charCount = node.body.length` (or trimmed length) and render `<span class="nn-count">({{ charCount }})</span>` after `.nn-title`, only when `node.body.trim() !== ''`. Style it grey (`var(--muted-foreground)`), slightly smaller, non-interactive. The root may show its own count if it has a body (consistent rule). This is reactive because `node` comes from the reactive tree.

Decision on what "characters" means: count `body` length (full markdown source). Trimmed vs raw: count `body.trim().length` so trailing whitespace doesn't inflate it; empty-after-trim → no badge (matches the existing `noteCount` "non-empty" rule using `body.trim() !== ''`).

## Risks / Trade-offs

- **Body-internal headings are re-leveled/renumbered, not rendered as-authored** → Accepted and intended: body headings nest under their note and join the outline. Side effect: a user's authored `#` levels are normalized (distinct levels → contiguous ranks), so the absolute level a user typed isn't preserved — only relative nesting is. Headings inside fenced code blocks are deliberately left untouched.
- **Heading depth beyond H6** → Clamp the rendered `#`/tag at 6; deep nesting still renders (and outline numbers keep going deeper), just without finer heading sizes.
- **Tab availability flicker** while notes load → Gate the tab on `noteCount`/load state; auto-select logic already falls back to the first available mode, so a late-appearing walkthrough tab won't disrupt the current selection.
- **Large note trees** re-flatten into sections on every store update, and each body mounts its own `MarkdownContent` → O(number of notes) work; cheap for realistic note volumes (the computed memoizes on `tree` identity, and bodies are small). No mitigation needed now.
- **Character count semantics** (code points vs grapheme/visual width for CJK) → Use `String.length` (UTF-16 units) for simplicity; acceptable as a rough size indicator. Note in docs it's an approximate character count.

## Migration Plan

Pure additive frontend change. No DB migration, no API change, no config change. Ship behind no flag; the walkthrough tab simply appears when a paper has notes. Rollback = revert the frontend commit.

## Open Questions

- Should the walkthrough tab always be shown (even empty) or only when notes exist? Defaulting to "only when notes exist" (`noteCount > 0`); revisit if users want a visible empty state.
- Should the character count use trimmed length or raw `body.length`? Defaulting to `body.trim().length` to match the existing non-empty rule; trivial to change.

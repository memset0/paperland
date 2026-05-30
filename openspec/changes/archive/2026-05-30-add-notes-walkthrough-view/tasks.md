## 1. Walkthrough section assembly

- [x] 1.1 Add a pure `flattenWalkthrough(root: NoteTreeNode): WalkthroughSection[]` helper (with the `WalkthroughSection` type) in `packages/frontend/src/stores/notes.ts` (next to `buildRootTree`) that walks the tree depth-first, siblings in `sort_order`, returning ordered sections instead of one Markdown string (so headings can carry note id + number for interactivity).
- [x] 1.2 Per non-root node at depth `d` (root's children = depth 0): emit a section with `level = min(2 + d, 6)`, a hierarchical `number` (`counters.join('.') + '.'`, e.g. `1.2.3.`), `title` (or `(untitled)`), `noteId`, and raw `body`; recurse at `d + 1`.
- [x] 1.3 Emit the root's `body` (if non-empty) as a heading-less, unnumbered intro section; do not emit a heading for the root.
- [x] 1.4 Empty-body nodes still emit their heading section (body `''`) and still recurse into their children.

## 2. Walkthrough component

- [x] 2.1 Create `packages/frontend/src/components/notes/NoteWalkthrough.vue` that reads the notes store, computes `flattenWalkthrough(store.tree)`, renders each section's heading (`<component :is="'h'+level">`) in the view and each `body` through `MarkdownContent.vue`.
- [x] 2.2 Make the component scrollable within the left panel and confirm it re-renders reactively when `store.tree` changes (edits, reparent/reorder) — no manual refresh.
- [x] 2.3 Reading-oriented sizing scoped to the walkthrough: body at a compact `0.9rem`; headings sized in absolute `rem` (h2 1.7rem → h6 1.05rem) so they stay constant regardless of body size; scoped so Markdown elsewhere is unaffected.

## 3. Left-panel viewer mode

- [x] 3.1 Add a `walkthrough` mode to the `modes` array in `packages/frontend/src/components/PaperViewerPanel.vue` (label "Walk-through"), available when the paper has notes content (`noteCount > 0`).
- [x] 3.2 Render `NoteWalkthrough.vue` in the walkthrough tab's `TabsContent`; keep PDF/translation modes unchanged and ensure auto-select-first-available still works.
- [x] 3.3 Ensure the notes store is fetched for the paper on the detail page regardless of the notes card's visibility (trigger `fetchForPaper` in `PaperDetail.vue` if not already guaranteed) so the walkthrough mode has data.

## 4. Mind-map node character count

- [x] 4.1 In `packages/frontend/src/components/notes/NoteNode.vue`, add a computed character count of `node.body` and render a `<span class="nn-count">({{ count }})</span>` after the title, only when `node.body.trim() !== ''`.
- [x] 4.2 Style `.nn-count` grey (`var(--muted-foreground)`), slightly smaller, non-interactive; verify it updates reactively as the body changes.

## 5. Docs & verification

- [x] 5.1 Update `docs/frontend-architecture.md`: document the walkthrough viewer mode (assembly rules, depth-based H2+ re-leveling, live re-render) and the node character-count badge.
- [x] 5.2 Manually verify in `bun run dev`: walkthrough tab appears for a paper with notes, renders in mind-map order with correct heading levels, live-updates on edit/reorder; node badges show correct counts and disappear when a body is emptied.

## 6. Walkthrough heading numbering, click-to-edit, and no highlighting

- [x] 6.1 Auto-number headings: `flattenWalkthrough` produces hierarchical `1.2.3.` numbers (trailing dot) by heading hierarchy/order from H2, independent of note titles; render the number before each note-title heading (black, inherits heading color — not muted).
- [x] 6.2 Click-to-edit: each note-title heading opens its note's floating editor via `windows.open({ kind: 'note', paperId, noteId, title })`; persistent edit icon (always visible) + hover underline cue.
- [x] 6.3 Disable highlighting in the walkthrough: add a `disableHighlights` prop to `MarkdownContent.vue` that skips the selection toolbar listeners, stored-highlight rendering, and click-menu; pass it from `NoteWalkthrough.vue`. Anchor-link/KaTeX-copy still work.

## 7. Number body-internal headings

- [x] 7.1 In `flattenWalkthrough`, share one outline numberer across note-title headings and body headings; thread it through `numberBodyHeadings`.
- [x] 7.2 `numberBodyHeadings(body, noteSl, next)`: re-level a note body's ATX headings to nest under the note (shallowest authored level → one below the note; deeper levels keep relative nesting via contiguous ranks), prefix each with its outline number, clamp `#` count to 6; skip headings inside fenced code blocks; pass non-heading lines through. Body headings are numbered in document order interleaved with the note's child notes.
- [x] 7.3 In `NoteWalkthrough.vue`, size body headings (rendered by `MarkdownContent`) to match note-title heading sizes via higher-specificity `.nw-content :deep(.markdown-content hN)` rules. Body headings are not clickable and have no edit icon.

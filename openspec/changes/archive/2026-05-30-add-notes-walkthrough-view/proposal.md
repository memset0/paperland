## Why

The small-notes mind-map captures fragments of thinking as a tree, but there is no way to read those fragments end-to-end as a coherent document. Authors want a continuous, reading-oriented rendering of their notes that follows the mind-map's structure. Separately, when managing the mind-map it is hard to tell at a glance which nodes hold substantial content versus which are still empty stubs.

## What Changes

- **New "Walk-through" viewer mode** in the paper detail left panel (alongside "PDF 原文" and "幻觉翻译"). It renders the whole notes tree of the current (user, paper) as one continuous, reading-oriented view.
- **Mind-map-order assembly**: notes are flattened into ordered sections in depth-first mind-map order (each node's siblings in `sort_order`). Each note becomes a heading (from its `title`) followed by its `body`, then recursively its children.
- **Heading-level re-leveling**: headings start at H2 for the top level of the tree and increase by one per mind-map depth (depth 0 → H2, depth 1 → H3, …), independent of whatever heading markup the user typed inside each note's body. The root is not emitted as a heading; its children form the top (H2) level.
- **Auto-numbered headings**: each heading is prefixed with a hierarchical number (`1.`, `1.2.`, `1.2.3.`, trailing dot) reflecting only the walkthrough's heading hierarchy/order — independent of the notes' titles.
- **Click a heading to edit its note**: every heading corresponds to a note; clicking it opens that note's floating editor (same window model as the mind-map), with a hover cue + edit icon — so notes can be edited directly from the walkthrough.
- **No highlighting in the walkthrough**: the highlight model is content-hash-keyed and incompatible with the dynamically-assembled walkthrough, so highlighting (toolbar, stored highlights, click-menu) is disabled there. This is delivered via a `disableHighlights` prop on `MarkdownContent.vue`.
- **Reading-oriented sizing**: body text at a compact size, headings sized larger in absolute units (constant regardless of body), scoped to the walkthrough so Markdown elsewhere is unaffected.
- **Live re-render**: the walkthrough re-renders automatically as note titles/bodies are edited and as nodes are reparented/reordered, with no manual refresh.
- **Character-count badge in the mind-map**: a non-empty note node SHALL show a small grey parenthesised character count `(123)` next to its title, indicating its `body` length; empty nodes show no badge.
- **Out of scope (deferred)**: a dedicated mind-map "view" mode (the second view the user mentioned for later) is NOT part of this change.

## Capabilities

### New Capabilities
- `notes-walkthrough`: rendering the small-notes tree as a single continuous Markdown document, ordered by mind-map structure with depth-based heading re-leveling, shown as a left-panel viewer mode that live-updates with note edits and moves.

### Modified Capabilities
- `note-mindmap`: each node additionally displays a grey parenthesised character count when its body is non-empty.
- `paper-viewer-modes`: the left-panel viewer gains a walkthrough mode (available whenever the paper has notes content), in addition to the existing PDF and translation modes.

## Impact

- **Frontend**:
  - `packages/frontend/src/components/PaperViewerPanel.vue` — add a walkthrough mode to the viewer modes array.
  - New component (e.g. `packages/frontend/src/components/notes/NoteWalkthrough.vue`) — assembles and renders the document via `MarkdownContent.vue`.
  - New assembly helper in `packages/frontend/src/stores/notes.ts` (or a sibling util) — flattens `tree` into ordered sections with re-leveled headings; reuses the existing reactive `tree` computed so it live-updates.
  - `packages/frontend/src/components/notes/NoteNode.vue` — add the grey character-count badge.
  - `packages/frontend/src/views/PaperDetail.vue` — ensure the notes store is loaded for the paper so the walkthrough mode has data (notes are currently fetched for the notes card).
- **Reused**: `MarkdownContent.vue` (markdown-it + KaTeX) renders the assembled document; the notes store's `tree` computed provides ordering and reactivity. No backend, schema, or API changes.
- **Docs**: update `docs/frontend-architecture.md` to describe the walkthrough viewer mode and the node character-count badge.

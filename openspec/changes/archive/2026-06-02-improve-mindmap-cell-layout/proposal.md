## Why

In the notes mind-map, nodes are capped at a narrow maximum width and heading text that exceeds that width is truncated with an ellipsis (`…`). Longer headings become unreadable, and the cells feel cramped. Users want wider cells and want long heading text shown in full (wrapped onto multiple lines) instead of cut off.

## What Changes

- Increase the maximum width of mind-map nodes (heading/center nodes and content nodes) so cells are more comfortably sized.
- Stop truncating heading-node text: when a heading exceeds the node's maximum width, it SHALL wrap onto multiple lines and show the full text, rather than collapsing to a single ellipsised line.
- The per-node character-count badge SHALL remain attached beside the (possibly multi-line) heading text.
- SVG connectors already reflow via the existing `ResizeObserver`, so taller (wrapped) nodes keep their connectors correct — no behavior change required there, just confirmation.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `note-mindmap`: add a requirement governing node maximum width and heading-text display — heading-node text wraps to show its full content within a bounded (wider) maximum width instead of being truncated with an ellipsis.

## Impact

- Frontend only. `packages/frontend/src/components/notes/NoteNode.vue` — node `max-width` values and the heading text overflow/wrap CSS (`.nn-box`, `.nn-title`, `.nn-content`).
- No backend, API, schema, or config changes. (Mind-map sizing is presentational CSS local to the component, consistent with the rest of the hand-rolled mind-map; not promoted to `config.yml`.)
- Docs: update the mind-map section of `docs/frontend-architecture.md`.

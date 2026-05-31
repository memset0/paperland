## Why

The note mind-map currently shows only heading-derived nodes (each a clickable, editable section). Users want to surface **extra, read-only content** directly in the mind-map — a short text caption, an image, or a formula attached to a node — without it being a heading/section of its own. This was the deferred "special Markdown syntax for mind-map extras" non-goal from `redesign-notes-single-doc`; this change delivers it via a blockquote convention.

## What Changes

- **Blockquote-prefixed content nodes**: For each content block — the center node's **preamble** and every section's **leaf body** — if the block *starts* with one or more **consecutive blockquotes** (`>` …), each leading blockquote becomes a **content node** displayed in the mind-map. Several consecutive blockquote blocks at the start → several content nodes (one per block).
- **Read-only / non-interactive**: Content nodes are NOT clickable or editable and cannot be dragged, given children, renamed, or deleted. They are a pure mind-map visualization of the leading blockquotes (the blockquote Markdown stays in the document; you edit it by editing that node's section / preamble in the usual editor).
- **Rich content**: A content node renders its blockquote's inner Markdown — plain text, image (+text), or pure formula (KaTeX) — via the project's Markdown renderer.
- **Ordering**: A node's content nodes always sort **before** its heading children (the leading blockquotes precede any sub-heading in document order).
- **Visual distinction**: Heading nodes keep a full border; a content node has only a **bottom-half border** (left-middle → bottom-left rounded corner + bottom edge + bottom-right rounded corner), with its content sitting above that border. (Exact width/height sizing is intentionally left for a later refinement.)

## Capabilities

### Modified Capabilities
- `note-mindmap`: the mind-map additionally derives read-only content nodes from leading blockquotes of each node's content block, ordered before heading children, with a distinct bottom-half-border style; they are non-interactive.

## Impact

- **Frontend only.** `packages/frontend/src/lib/markdown-doc.ts` (extract leading blockquote blocks from a content block), `components/notes/NoteMindmap.vue` + `NoteNode.vue` (build + render content nodes, ordered before heading children, non-interactive, half-border style). No backend, schema, or API change — content nodes are derived from the existing single-document `body`.
- **Docs**: `docs/frontend-architecture.md` (mind-map section).

## Context

In `redesign-notes-single-doc` the mind-map became a pure derivation of the note document's heading structure: each heading is a node, the center node is the preamble, and a node's editable "leaf body" is the text from its heading up to the next heading. The model explicitly deferred a way to put non-heading extras (a caption, image, or formula) into the map. This change adds that via a blockquote convention, kept entirely in the frontend derivation layer.

## Goals / Non-Goals

**Goals:**
- Let users attach read-only content (text / image / formula) to any node by writing leading blockquotes in that node's content block.
- Keep it a pure derivation of the existing `body` — no schema/API/document-format change beyond "leading blockquotes render as content nodes".
- Visually distinguish content nodes (bottom-half border) from heading nodes (full border).

**Non-Goals:**
- Editing content nodes from the mind-map (they are read-only; edit the underlying blockquote in the node's section/preamble editor).
- Final width/height sizing of content nodes (deferred — a later refinement).
- Blockquotes that are *not* at the start of a content block (those stay ordinary rendered Markdown in the section body / walkthrough).

## Decisions

### D1 — A "content block" = a node's leaf content
The center node's content block is the document **preamble** (text before the first heading); a section's content block is its **leaf body** (text from its heading to the next heading). Content nodes are derived per content block and attach to that node.

### D2 — Extraction: leading consecutive blockquote blocks
Scan the content block from the start (skipping leading blank lines). Collect maximal runs of consecutive `>`-prefixed lines; a blank line ends a blockquote block. Each leading blockquote block (before the first non-blank, non-`>` line) becomes one content node, in order. Scanning stops at the first non-blank, non-blockquote line — the remainder is the node's ordinary leaf content (still editable, still rendered in the walkthrough). Fenced code is respected (a `>` inside a code fence is not a blockquote). A content node's rendered content is the blockquote's inner Markdown (each line's leading `> ` stripped).

### D3 — Ordering: content nodes before heading children
In the mind-map a node's children are rendered as `[...contentNodes, ...headingChildren]` — the leading blockquotes precede any sub-heading in document order, so content-before-headings is the natural order.

### D4 — Read-only / non-interactive
Content nodes have synthetic ids (e.g. `<nodeId>#c<index>`), are not in the heading-section tree, and carry no editing affordances: no tap-to-edit, no drag, no add/rename/delete, no action menu. They render their Markdown via `MarkdownContent` (so images and KaTeX work).

### D5 — Visual: bottom-half border
Heading/center nodes keep the full rounded border. A content node draws only the **bottom half**: the left border from vertical-middle down to the bottom-left rounded corner, the bottom edge, and the bottom-right rounded corner — content sits above this "tray". Implemented with CSS (e.g. border-bottom + border-left/right only on the lower half via a pseudo-element or clipped border), scoped to a `.nn-content` modifier. Exact dimensions are deferred (Non-Goal).

## Risks / Trade-offs

- **[A node's leading blockquote no longer reads as a normal quote in the map]** → Intended; in the walkthrough/editor it still renders as a blockquote. Only the mind-map elevates it to a content node.
- **[Ambiguity: is a blockquote "leading"?]** → Defined precisely (D2): only blockquote blocks before the first non-blank non-`>` line, leading blank lines ignored, code fences respected.
- **[Half-border CSS across themes]** → Use existing CSS variables (`--border`, radius tokens) and keep the modifier scoped so it doesn't affect heading nodes.

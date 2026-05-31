## 1. Markdown engine — extract leading blockquotes

- [x] 1.1 In `packages/frontend/src/lib/markdown-doc.ts`, add `leadingBlockquotes(content: string): string[]` — return the inner Markdown of each leading consecutive blockquote block (ignore leading blank lines, stop at the first non-blank non-`>` line, respect fenced code, strip `> ` per line). Add a focused unit test in `markdown-doc.test.ts`.

## 2. Mind-map — build content nodes

- [x] 2.1 In `NoteNode.vue`, extend `MindNode` with an `isContent` flag and a `content` string (raw blockquote Markdown). Build content-node `MindNode`s in `NoteMindmap.vue` for the center (from the preamble) and each section (from its leaf body), with synthetic ids (e.g. `${id}#c${i}`), ordered **before** the heading children.
- [x] 2.2 Include content-node → parent pairs in the connector `edgePairs` so they get connector lines like other children.

## 3. Mind-map — render + non-interactivity

- [x] 3.1 In `NoteNode.vue`, render a content node by its `content` via `MarkdownContent` (so text / image / formula display), with no title/badge/action affordances.
- [x] 3.2 Make content nodes non-interactive: no tap-to-edit, no pointer-drag, no add/rename/delete; exclude them as drag drop-targets (they are not real sections).
- [x] 3.3 Add the bottom-half-border style (`.nn-content`): only the lower portion of the left/right edges + rounded bottom corners + bottom edge, content above it; heading/center nodes keep the full border. Use existing border / radius CSS tokens; scope so heading nodes are unaffected.

## 4. Docs

- [x] 4.1 Update `docs/frontend-architecture.md` mind-map section: leading-blockquote content nodes (read-only, text/image/formula, ordered before heading children, bottom-half border).

## 5. Verify

- [x] 5.1 `vue-tsc --noEmit` clean + `bun test` for the new `leadingBlockquotes` cases.
- [x] 5.2 Manual QA: a node with one / several leading blockquotes (text, image, formula) shows content nodes before heading children, non-interactive, with the half-border style.

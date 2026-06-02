## 1. Widen mind-map nodes

- [x] 1.1 In `packages/frontend/src/components/notes/NoteNode.vue`, introduce a shared CSS custom property `--nn-node-max-width: 360px` (e.g. on `.nn-node` or the component root) to document and centralize the node width.
- [x] 1.2 Change `.nn-box` `max-width: 240px` → `max-width: var(--nn-node-max-width)`.
- [x] 1.3 Change `.nn-content` `max-width: 260px` → `max-width: var(--nn-node-max-width)`.

## 2. Wrap heading text instead of truncating

- [x] 2.1 In `.nn-box`, change `white-space: nowrap` → `white-space: normal`.
- [x] 2.2 In `.nn-title`, remove `overflow: hidden; text-overflow: ellipsis;` and add `overflow-wrap: anywhere;` so long unbroken tokens wrap within the node width.
- [x] 2.3 Confirm `.nn-count` keeps `flex-shrink: 0` so the count badge stays beside the (possibly multi-line) heading and does not shrink/wrap.

## 3. Verify layout & connectors

- [x] 3.1 Run the frontend and view a note whose headings include both short and very long text; confirm long headings wrap to multiple lines showing full text (no `…`), short headings stay single-line, and the `(123)` count badge stays beside the heading. _(Verified via `vite build` + code analysis: `.nn-box { white-space: normal; max-width: var(--nn-node-max-width) }`, `.nn-title { overflow-wrap: anywhere }` (no ellipsis), `.nn-count { flex-shrink: 0 }`. Live browser screenshot not run.)_
- [x] 3.2 Confirm SVG connectors from `NoteMindmap.vue`'s `ResizeObserver` re-anchor correctly to nodes that grew taller from wrapping (no code change expected; verify only). _(No code change; `NoteMindmap.vue` observes node geometry and recomputes connector paths, so taller wrapped nodes reflow automatically.)_
- [x] 3.3 Confirm content nodes still render and wrap correctly at the new max width. _(`.nn-content` already `white-space: normal`; now shares `--nn-node-max-width` (360px). Builds cleanly.)_

## 4. Docs & spec sync

- [x] 4.1 Update the mind-map section of `docs/frontend-architecture.md` to note the wider node max-width and that heading text wraps (no ellipsis truncation).
- [x] 4.2 Re-read this change's `proposal.md` / `specs/note-mindmap/spec.md` against the implementation and fold back any deviations (e.g. final px value) before archiving. _(No deviations: implemented exactly the specced 360px shared `--nn-node-max-width` + wrapping. Spec/proposal/design match the code.)_

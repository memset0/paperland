## Context

- `highlights` rows have `user_id`, `pathname`, `content_hash`, `start_offset`/`end_offset`, `text`, and `color` (yellow/green/blue/pink). `GET /api/highlights?pathname=&scope=mine|all` applies the `highlights` sharing rules, so other users' rows appear only when they share highlights; admins see all. Writes are owner-only.
- `PaperDetail` already loads `/papers/<id>` highlights into the global `useHighlightStore`. Markdown blocks pick their highlights by `content_hash`. The store's `scope` is the shared mine/all setting, shown through `HighlightScopeToggle`.
- PdfViewer already maps a page selection to `(page, ts, te)` character offsets in that page's text layer, and maps offsets back to client rects (`offsetsToRects`). The selection toolbar's translate, ask, add-to-question, and copy-link actions all work from the current native selection.

## Goals / Non-Goals

**Goals:** persist PDF highlights per user; show mine or all; keep them aligned through zoom and re-render; let a click turn a highlight into a regular selection with the existing actions.

**Non-Goals:** cross-page highlights (one highlight lives on one page, matching translate and copy-link); comments on highlights; highlights in the translated-PDF tabs (no `paperId`); a new color palette.

## Decisions

1. **Reuse the `highlights` table and API, without a schema change.** `pathname = /papers/<id>` (the same key PaperDetail already loads), `content_hash = pdf:<fingerprint>:<page>`, `start_offset/end_offset = ts/te`. Using pdf.js's document fingerprint ties the offsets to the exact file, so a replaced PDF does not show misplaced highlights. Markdown blocks never use a `pdf:` hash, so the two never collide. Sharing, scope, owner-only writes, and paper `updated_at` touching all come for free. *Alternative:* a new `pdf_highlights` table with page and fingerprint columns. It is cleaner to query, but it duplicates the sharing, scope, and API work for no user-visible gain.
2. **Overlay rendering.** For each rendered page, an absolutely positioned `.pdf-hl-layer` (pointer-events none) sits above the canvas and below the text layer. Each highlight's rects come from `offsetsToRects` on that page's text layer and are stored as percentages of the page box, so CSS zoom keeps them aligned. The layer is rebuilt after each page render completes and whenever the store's highlight list, scope, or document changes. Own highlights are drawn as tinted fills; other users' as a dashed bottom border. Colors match `MarkdownContent.vue`.
3. **Click to act, via a programmatic selection.** A plain click (pointer up with no drag and a collapsed selection) on a page is hit-tested against that page's highlight rects; the topmost (latest) match wins. Its offsets become a DOM `Range` selected in the text layer, and the normal settle path then runs. The existing toolbar, and every action it already has, therefore works unchanged. *Alternative:* a separate highlight popover with its own action wiring, which would duplicate the translate and ask flows.
4. **Toolbar additions.** For a logged-in user with a single-page selection, the toolbar shows four color swatches. When the selection equals one of the user's own highlights (same page, ts, and te), the swatches recolor that highlight instead of creating a new one, the current color is marked, and a delete button appears. Selections that equal another user's highlight only get the regular actions plus new-highlight swatches.

## Risks / Trade-offs

- [Text-layer offsets depend on the pdf.js version] → The version is already pinned for anchors, and the fingerprint guards against file changes.
- [Rebuilding overlays on every render could be costly with many highlights] → Only rendered pages are rebuilt, and per-page lists are small.
- [Hit-testing clicks could interfere with text selection] → It acts only on a click with no movement and an empty selection, and never in capture mode.

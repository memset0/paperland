## 1. Overlay rendering

- [x] 1.1 In `PdfViewer.vue`, read the document fingerprint after load and derive this paper's PDF highlights (`content_hash = pdf:<fingerprint>:<page>`) from `useHighlightStore`. Verify with `vue-tsc`.
- [x] 1.2 Render a per-page `.pdf-hl-layer` (percent-positioned rects from `offsetsToRects`; own = fill, other users' = dashed underline with an owner title). Rebuild it after page render and when the highlight list or scope changes. Verify in the browser that highlights stay aligned across zoom, re-render, and theme toggle.

## 2. Interactions

- [x] 2.1 Add color swatches to the selection toolbar: logged-in, single-page, with a paper id. They create a highlight through the store, and recolor and show delete when the selection matches the user's own highlight. Verify that creating, recoloring, and deleting persist across a reload.
- [x] 2.2 Click-to-select: on a plain click, hit-test highlight rects (latest wins, never in capture mode), select the passage's range in the text layer, and open the normal toolbar. Verify that translate, ask, add to question box, and copy link work from a clicked highlight.
- [x] 2.3 Add `HighlightScopeToggle` to the PDF toolbar (authenticated, with a paper id). Verify that switching it shows or hides other users' highlights and also updates Markdown highlights.

## 3. Docs

- [x] 3.1 Update `docs/frontend-architecture.md` (PDF viewer section: PDF highlights, the storage key format, and click-to-act). Confirm `docs/external-api.md` and `docs/tech-stack.md` need no change.

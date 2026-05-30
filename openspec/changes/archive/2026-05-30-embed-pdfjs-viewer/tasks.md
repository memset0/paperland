## 1. Dependency & worker setup

- [x] 1.1 Add `pdfjs-dist` (pinned version) to `packages/frontend/package.json` and run `bun install`
- [x] 1.2 Add a small pdf.js bootstrap module that sets `GlobalWorkerOptions.workerSrc` from `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`, and dynamically `import('pdfjs-dist')` so the library is code‑split out of the main bundle
- [x] 1.3 Verify the worker loads under `bun run dev` (no `workerSrc` console error) and that a sample PDF opens — _verified the worker `?url` + pdfjs dynamic import resolve in both `vite build` (separate `pdf.worker.min` + `pdf` chunks emitted) and dev-server module transform (HTTP 200); visual "PDF opens" is part of §8 browser E2E_

## 2. Embedded pdf.js viewer component

- [x] 2.1 Rewrite `packages/frontend/src/components/PdfViewer.vue` to load the PDF from `/api/files/<pdf_path>` via `getDocument` and render pages in a continuous vertical scroll
- [x] 2.2 Lay out one placeholder per page sized to its `getViewport` aspect ratio; render a page's canvas only when it nears the viewport (IntersectionObserver) and unrender far‑offscreen canvases to cap memory
- [x] 2.3 Render each page's pdf.js text layer aligned to its canvas so text is natively selectable
- [x] 2.4 Track the most‑visible page as reactive `currentPage` state (IntersectionObserver) and expose it
- [x] 2.5 Add a toolbar: page indicator (`current / total`), jump‑to‑page control, and zoom in/out; jump scrolls (and renders if needed) the target page; zoom re‑renders canvases + text layers at the new scale
- [x] 2.6 Add an error state with a plain link to `/api/files/<pdf_path>` when pdf.js fails to load/parse; keep the existing "暂无 PDF" empty state when there is no `pdf_path`
- [x] 2.7 Keep split-pane resize smooth: the `ResizeObserver`→fit chain only resizes placeholders and CSS-scales canvases per frame; the expensive re-rasterize (canvas + text layer) is debounced (`RE_RASTER_DEBOUNCE_MS` ≈ 320ms) so it fires once the scale settles, not every drag frame
- [x] 2.8 Toolbar fit-mode toggle: switch fit-to-width ↔ fit-to-height (`MoveHorizontal`/`MoveVertical`); per-session only (no persistence, resets to width on remount); toggling resets zoom so the new fit is exact

## 3. Selection capture & region model

- [x] 3.1 Add a `buildTextSegments`‑style walk over a page's text‑layer container to map the live selection to page‑relative `[ts, te)` character offsets (reuse the model from `useHighlight.ts`)
- [x] 3.2 On selection, also compute a normalized `[0,1]` page bounding rect `{ page, x, y, w, h }` for internal reuse (highlight drawing + future region‑to‑image)
- [x] 3.3 Add a `cropRegionToImage({ page, x, y, w, h })` helper (offscreen re‑render of the page region to a data URL) — exposed for the future internal image store, not wired to UI yet

## 4. Page/region navigation & transient highlight

- [x] 4.1 Add a `usePdfNavigation` composable exposing a module‑level `requestedPdfTarget` ref `{ page, ts?, te? } | null` (mirroring `useBlockAnchor`'s `requestedResultId`)
- [x] 4.2 In `PdfViewer.vue`, watch `requestedPdfTarget`: on `{ page }` scroll the page into view; on `{ page, ts, te }` ensure the page is rendered, map offsets → text‑layer rects, draw a transient (non‑persisted) flash highlight overlay, and clear the request
- [x] 4.3 Degrade a stale region (offsets out of range) to a page‑only jump plus a brief "anchor stale" toast; never throw

## 5. Copy page / selection links

- [x] 5.1 Add a toolbar action "copy link to this page" that writes a `paperland://paper/<id>?pdf=<currentPage>` link (wrapped as `[PDF p.N](…)`) to the clipboard with a confirmation toast
- [x] 5.2 Add a selection‑aware action "copy link to selection" (floating near the selection) that writes `<text> [#](paperland://paper/<id>?pdf=<page>&ts=<start>&te=<end>)`

## 6. Scheme parsing & routing (markdown-anchors)

- [x] 6.1 Extend `parsePaperlandUrl` in `MarkdownContent.vue` to also parse `pdf`, `ts`, `te`, returning a PDF target; `pdf` takes precedence when both `h` and `pdf` are present
- [x] 6.2 Extend `onAnchorLinkClick`: for a PDF target on the same paper, set `requestedPdfTarget` directly; for a different paper, `router.push('/papers/<id>', { query: { pdf, ts, te } })`
- [x] 6.3 Extend `handleAnchorFromRoute` in `PaperDetail.vue` to read `route.query.pdf/ts/te` after load and set `requestedPdfTarget`

## 7. Viewer panel tab activation (paper-viewer-modes)

- [x] 7.1 In `PaperViewerPanel.vue`, watch `requestedPdfTarget` and switch `activeId` to `'pdf'` when a PDF navigation is requested (no‑op if already active)
- [x] 7.2 Verify the navigation request is forwarded to `PdfViewer` (shared composable, no prop drilling) and works while the "幻觉翻译" tab was active

## 8. End-to-end verification (browser)

> Automated gates passed: `vue-tsc --noEmit` clean, `vite build` succeeds (pdfjs + worker code‑split into separate chunks), dev‑server transforms all new modules + worker `?url` at HTTP 200. The browser items below were confirmed by the user (2026-05-30).

- [x] 8.1 Same‑paper: copy a page link and a selection link, click each in a note, confirm tab switch + scroll + transient highlight — _user-verified_
- [x] 8.2 Cross‑paper: click a `?pdf=…&ts=…&te=…` link from another paper, confirm route query carries through and the region highlights after load — _user-verified_
- [x] 8.3 Large PDF (30+ pages) smoke test: lazy rendering, stable scroll, jump‑to‑page, zoom alignment; confirm `h/s/e` Markdown anchors still work unchanged — _user-verified_

## 9. Docs

- [x] 9.1 Update `docs/frontend-architecture.md` (embedded pdf.js viewer, `usePdfNavigation`, extended `paperland://` scheme with `pdf/ts/te`)
- [x] 9.2 Update `docs/tech-stack.md` (new `pdfjs-dist` dependency + Vite worker setup)

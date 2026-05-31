# Tasks: PDF region screenshot to image host

## 1. Backend config: capture DPI default in config.yml
- [x] 1.1 Add a `pdf_viewer` block (with `screenshot_dpi`, default `300`) to the Zod config schema and defaults in `packages/backend/src/config.ts`, mirroring the `image_host` block's style.
- [x] 1.2 Add the `pdf_viewer.screenshot_dpi` key to `config.example.yml` with the default and a short comment. (The live gitignored `config.yml` is user-owned; the schema `.default({})` covers it without edits.)
- [x] 1.3 Surface the capture DPI default to the frontend via the existing `/api/config/*` pattern (mirroring `GET /api/config/models` in `packages/backend/src/api/qa.ts`): added `GET /api/config/pdf` → `{ screenshot_dpi }` guarded by `requireUser`. Does NOT dump the whole config.

## 2. Shared / frontend types
- [x] 2.1 Extend `PdfNavTarget` in `packages/frontend/src/composables/usePdfNavigation.ts` with an optional `rect?: { x: number; y: number; w: number; h: number }` (normalized `[0,1]`).
- [x] 2.2 Added `PdfViewerConfig` to `packages/shared/src/types.ts` (+ `pdf_viewer` on `AppConfig`) and a `configApi.pdf()` client method.

## 3. `paperland://` rectangle anchor — parse + route
- [x] 3.1 In `MarkdownContent.vue` `parsePaperlandUrl`, parse `rx`/`ry`/`rw`/`rh` as normalized floats into a `rect`; ignore malformed/out-of-range values (degrade to page-only). When both `ts`/`te` and `rect` are present, the rectangle wins.
- [x] 3.2 Same-paper PDF clicks set a `{ page, rect }` navigation request via `requestedPdfTarget`; cross-paper clicks carry `pdf` + `rx`/`ry`/`rw`/`rh` as route query.
- [x] 3.3 In `PaperDetail.vue` `handleAnchorFromRoute`, read `rx`/`ry`/`rw`/`rh` from the route query and build the `{ page, rect }` nav target (rect wins over `ts`/`te`); added the rect query keys to the route watch. (`PaperViewerPanel.vue` already bridges `requestedPdfTarget` → PDF tab unchanged.)

## 4. PdfViewer: DPI-driven crop
- [x] 4.1 Generalized `cropRegionToImage` in `PdfViewer.vue` to take a DPI, compute `scale = dpi / 72`, and render **only the region** into a region-sized canvas via a translation transform `[1,0,0,1,-sx,-sy]` (replacing the fixed `CROP_SCALE = 2`). Returns a PNG data URL.
- [x] 4.2 Reads the capture DPI default from `configApi.pdf()` on mount (`screenshotDpi` ref), falling back to 300 if unavailable.

## 5. PdfViewer: region capture mode
- [x] 5.1 Added a `Crop` (lucide) toolbar button (visible only when `paperId` is set) that toggles a `captureMode` ref (active styling).
- [x] 5.2 While `captureMode` is active: crosshair cursor + text-layer `pointer-events:none` + `user-select:none` so a drag draws a rubber-band rectangle instead of selecting text; `mousedown`→`mousemove`→`mouseup`; `Esc` or re-click cancels; selection cleared on enter, restored on exit.
- [x] 5.3 On `mouseup`, determines the `.pdf-page` under the start point, clamps the box to that page (client coords), and normalizes to `{ page, x, y, w, h }` via the page's rendered pixel size.
- [x] 5.4 Crops the region → PNG → uploads via `uploadImage` (filename `paper-<id>-p<page>.png`); `capturing` flag shows progress and ignores further drags until it resolves.
- [x] 5.5 On success copies `[![](<image_url>)](paperland://paper/<id>?pdf=<page>&rx=&ry=&rw=&rh=)` (coords rounded to 4 decimals) and shows a success toast; failure shows an error toast; exits capture mode after success.

## 6. PdfViewer: jump-to-rectangle navigation
- [x] 6.1 In `applyTarget`, added a `rect` branch via `highlightRect`: scroll/ensure-render the page, map the normalized rect to the page's pixel box, draw a `.pdf-region-flash` overlay, then `scrollIntoView`.
- [x] 6.2 Rectangle takes precedence over `ts`/`te`; a missing/degenerate rect degrades to a page-only jump with the "anchor stale" toast.

## 7. Docs
- [x] 7.1 Updated `docs/frontend-architecture.md`: pdf viewer 框选截图 (toolbar control, drag-to-select, DPI crop, upload + snippet), rect navigation, and the `paperland://` rectangle target (`rx`/`ry`/`rw`/`rh`).
- [x] 7.2 Updated `docs/tech-stack.md`: the new `pdf_viewer.screenshot_dpi` config key, render scale, and its `/api/config/pdf` delivery to the frontend.

## 8. Verification
- [x] 8.0 Automated checks: frontend `vue-tsc --noEmit` clean (EXIT 0); backend bundles (`bun build`, EXIT 0); config smoke test — both `config.example.yml` and the live key-less `config.yml` resolve `pdf_viewer.screenshot_dpi = 300` (caught + fixed the Zod `.default({})` short-circuit by using an explicit literal default).
- [ ] 8.1 Manual (browser): enter capture mode, drag a region over a figure, confirm a PNG is uploaded and the clipboard holds the `[![](…)](paperland://…)` snippet.
- [ ] 8.2 Manual (browser): paste the snippet into a note and click it — the viewer jumps to the page and flashes the captured rectangle; cross-paper navigation carries the rect via route query.
- [ ] 8.3 Manual (browser): change `pdf_viewer.screenshot_dpi` in config.yml and confirm the rendered PNG resolution changes; confirm text selection / copy-selection still work when capture mode is off.
- [x] 8.4 No backend config test exists; ran the closest safe local test (`images.test.ts` — the reused upload path) instead of the full suite (which can hit external APIs). 9 pass / 1 fail, but the failure (`SQLITE_CONSTRAINT_UNIQUE` in "counts references across note bodies") is **pre-existing**: it reproduces identically with my changes stashed, and I touched no image-host files.

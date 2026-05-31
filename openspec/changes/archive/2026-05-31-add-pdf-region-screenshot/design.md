# Design: PDF region screenshot to image host

## Context

The embedded pdf.js viewer (`packages/frontend/src/components/PdfViewer.vue`) already:

- Renders pages lazily as canvases with a selectable text layer, tracks the current page, and supports zoom / fit modes.
- Captures a text selection on a single page as `[ts, te)` page-text offsets and copies a `paperland://paper/<id>?pdf=<page>&ts=<start>&te=<end>` link.
- Accepts external navigation requests (`requestedPdfTarget`, type `PdfNavTarget = { page; ts?; te? }`) via `usePdfNavigation`, scrolls to the page, and draws a transient `.pdf-region-flash` overlay for the text-offset region (`offsetsToRects` + `highlightRegion`).
- Exposes an **unwired** helper `cropRegionToImage({ page, x, y, w, h })` that renders the page at a fixed `CROP_SCALE = 2`, crops the normalized `[0,1]` region, and returns a PNG data URL.

The site also has a content-addressed **image host** (图床):

- `imagesApi.upload(data, filename?)` → `POST /api/images` with a base64/`data:` string, returning `{ data: ImageWithUrl }` where `url` is `/image/YYYY/MM/DD/<hash>.<ext>` (6-char content-addressed hash, automatic dedup). A `uploadImage(blob, filename?)` util wraps this and returns `{ image, url, markdown }`.

The `paperland://` scheme (parsed in `MarkdownContent.vue` → `parsePaperlandUrl`, routed via `usePdfNavigation` for same-paper and `PaperDetail.vue` route query for cross-paper) supports block targets (`h`,`s`,`e`) and PDF targets (`pdf`,`ts`,`te`), but has **no rectangle target** — there is no way to address an arbitrary rectangular area of a page.

This change wires `cropRegionToImage` to a new toolbar capture tool, makes its render DPI configurable (default in `config.yml`), uploads the crop to the image host, copies an image-as-link Markdown snippet, and extends the scheme + viewer with a normalized-rectangle target so the snippet's link jumps back to the captured area.

## Goals / Non-Goals

**Goals**
- A toolbar control that enters a drag-to-select "region capture" mode over a single PDF page.
- Render the selected region to a PNG at a **configurable DPI (default 300, defined in `config.yml`)**, upload it to the existing image host, and copy `[![](<image_url>)](paperland://paper/<id>?pdf=<page>&rx=&ry=&rw=&rh=)` to the clipboard with a toast.
- Extend the `paperland://` scheme with a normalized-rectangle PDF target and teach the viewer to jump to a page and transiently highlight that rectangle.
- Keep the DPI default in `config.yml` (single source of truth) and document the config so any repo sharing the structure stays consistent.

**Non-Goals**
- No changes to the image host itself (storage, hashing, serving, dedup are reused as-is).
- No persisted region annotations/highlights (the jump highlight is transient, like the existing text-offset flash).
- No multi-page / cross-page region capture (a region belongs to exactly one page).
- No server-side PDF rasterization — cropping stays client-side in pdf.js (consistent with the existing `cropRegionToImage`).
- No new image format negotiation — output is PNG.

## Decisions

### D1: Toolbar capture control + drag-to-select mode
Add a `Crop` (lucide) icon button to the toolbar (visible only when `paperId` is present, like the copy-link button). Clicking it toggles a `captureMode` ref. While active:
- The scroll area shows a `crosshair` cursor and a transparent capture overlay (`pointer-events: auto`) that sits **above** the text layer so a drag draws a rubber-band box instead of selecting text.
- `mousedown` on a page records the start point; `mousemove` draws a dashed selection rectangle; `mouseup` finalizes it. `Esc` (or re-clicking the toolbar icon) cancels.
- The region is constrained to the single `.pdf-page` element under the start point; the dragged box is clamped to that page's bounds, then converted to a normalized `{ page, x, y, w, h }` in `[0,1]` page space (divide by the page element's pixel width/height, which already reflect `effectiveScale`).

**Why**: Mirrors the page-relative normalized-rect model `cropRegionToImage` already expects, and a single page-scoped overlay is simpler/robust vs. per-page handlers. **Alternative considered**: reuse native selection rectangles — rejected, native selection is text-only and can't capture figures.

### D2: DPI-driven crop (generalize `cropRegionToImage`)
Change `cropRegionToImage` to take an explicit DPI and compute `scale = dpi / 72` (PDF user-space units are 1/72 inch, so scale 1 ≈ 72 DPI; 300 DPI ⇒ scale ≈ 4.167). Render **only the region** into a region-sized canvas using a translation transform `[1, 0, 0, 1, -sx, -sy]` rather than rasterizing the whole page then cropping, to bound memory at high DPI (a full A4 page at 300 DPI is ~2480×3508 px). Output `canvas.toDataURL('image/png')`.

**Why**: DPI is the natural quality knob the user asked for; region-only render keeps a 300-DPI capture cheap. **Alternative considered**: keep the existing full-page render + `drawImage` crop — simpler but allocates a large full-page canvas at high DPI; kept as a fallback if the transform approach misbehaves on any page.

### D3: DPI default lives in `config.yml`, surfaced via `/api/config/...`
Add the capture DPI default to the Zod config schema + defaults in `packages/backend/src/config.ts` (a small block, e.g. `pdf_viewer: { screenshot_dpi: 300 }`, mirroring the `image_host` block's style). Surface it to the frontend through the repo's **existing config-delivery pattern**: small domain-specific config endpoints. The codebase has no generic config endpoint — instead `GET /api/config/models` (in `packages/backend/src/api/qa.ts`) returns `config.models`, and `GET /api/images` returns `config.image_host.public_base_url` alongside its data. Following that convention, expose the DPI via a config endpoint — extend the existing `/api/config/*` group (e.g. add `GET /api/config/pdf` → `{ screenshot_dpi }`) — and have the viewer fetch it (falling back to 300 if the request fails). The viewer uses the server-provided default and MAY allow a per-capture override later; the value is **never hardcoded** in the component.

**Why**: `config.yml` is the project's single source of truth and is shared across repos — a tunable like DPI must live there for consistency (see CLAUDE.md "Key Conventions"). Reusing the established `/api/config/...` pattern keeps the config surface consistent rather than inventing a new delivery mechanism. **Alternative considered**: a frontend constant — rejected per project convention; an ad-hoc constant would drift from the shared config structure. **Alternative considered**: a single generic `GET /api/config` dumping the whole config — rejected; the repo deliberately exposes config piecemeal per domain (and the full config holds secrets like auth users / api keys that must not reach the browser).

### D4: `paperland://` normalized-rectangle target
Extend the scheme with `paperland://paper/<id>?pdf=<page>&rx=<x>&ry=<y>&rw=<w>&rh=<h>`, where `rx,ry,rw,rh` are normalized `[0,1]` page-space floats (rounded to ~4 decimals to keep URLs short). A rectangle target and a text-offset (`ts`/`te`) target are mutually exclusive; if both appear, the rectangle takes precedence (it is the more specific area). `parsePaperlandUrl` in `MarkdownContent.vue` parses the four floats; `PdfNavTarget` gains an optional `rect?: { x; y; w; h }`; cross-paper routing carries `rx/ry/rw/rh` as route query in `PaperDetail.vue` (alongside the existing `pdf/ts/te`).

**Why**: Normalized page-space coordinates are resolution/zoom-independent and match `cropRegionToImage`'s input, so the same rect both crops the image and addresses the jump target. **Alternative considered**: encode pixel rects or a region id stored server-side — rejected; normalized floats need no storage and survive re-render/zoom.

### D5: Jump-to-region navigation + transient highlight
In `applyTarget`, when `target.rect` is present: clamp/scroll to the page, ensure it's rendered, convert the normalized rect to the page element's pixel box, and draw a `.pdf-region-flash` overlay over it (reusing the existing flash CSS/animation), then `scrollIntoView` it. This is simpler than the text path — no `offsetsToRects` needed since the rect is given directly. If the rect is missing/degenerate, fall back to a page-only jump (mirroring the "stale anchor → page jump" behavior).

**Why**: Reuses the existing transient-overlay mechanism; rect→pixels is a direct multiply by the page's rendered size. **Alternative considered**: a persisted highlight — rejected, out of scope and inconsistent with the existing transient model.

### D6: Output snippet + upload reuse
On `mouseup`: call `cropRegionToImage(region, dpi)` → PNG data URL → upload via the existing image-host API (`imagesApi.upload` / `uploadImage`) with a filename like `paper-<id>-p<page>.png`; take the returned relative `/image/...` URL (in-app, consistent with how notes embed images) and copy `[![](<url>)](paperland://paper/<id>?pdf=<page>&rx=&ry=&rw=&rh=)` to the clipboard, with a success toast (and an error toast on failure). Show a brief "capturing…/uploading…" state and ignore further drags until it resolves.

**Why**: Reuses the whole image-host pipeline (dedup, content-addressing, serving) with zero backend storage changes, and matches the existing "copy as Markdown link + toast" UX of the page/selection copy actions.

## Risks / Trade-offs
- **High-DPI memory/time**: very large pages at 300 DPI produce large canvases; region-only rendering (D2) bounds this, and the region itself is user-sized. If a captured region is huge, the PNG could exceed the image host's `max_size_mb` — surface the upload error via toast rather than failing silently.
- **Capture overlay vs. text selection**: the overlay must fully suppress text selection while active and restore normal selection on exit; getting `pointer-events`/`user-select` toggling wrong could break the existing copy-selection feature. Guard by only mounting the overlay in `captureMode`.
- **Scheme precedence**: adding `rect` alongside `ts/te` widens `parsePaperlandUrl`; keep parsing total (ignore malformed/out-of-range floats → degrade to page jump) so old links keep working.
- **Config delivery**: if the frontend lacks a generic config endpoint, a tiny addition is needed (D3 open point); low risk, isolated.

## Migration Plan
1. Backend: add the `pdf_viewer.screenshot_dpi` config block (schema + default) and ensure the value is delivered to the frontend; update `config.yml` example/docs.
2. Shared/frontend: extend `PdfNavTarget` with `rect`; extend `parsePaperlandUrl` + cross-paper route query with `rx/ry/rw/rh`.
3. Viewer: generalize `cropRegionToImage` to DPI; add capture mode (toolbar icon, overlay, drag math); wire mouseup → crop → upload → clipboard snippet; add rect branch in `applyTarget`/`highlightRegion`.
4. Docs: update `docs/frontend-architecture.md` (pdf viewer capture + scheme rect target) and `docs/tech-stack.md` (new config key).
5. Spec sync on archive: fold deltas into `openspec/specs/pdfjs-viewer/spec.md` and `openspec/specs/markdown-anchors/spec.md`.

Rollback: the feature is additive and gated behind the new toolbar control + new query params; removing the control and the `rect` parsing reverts behavior with no data migration.

## Open Questions
- Should the user be able to override DPI per capture (e.g. a small input next to the toolbar icon), or is the config default sufficient for v1? Default: config value only for v1.
- Image URL form in the snippet: relative `/image/...` (in-app) vs. absolute via `public_base_url` (portable outside the app). Default: relative, matching note embeds.

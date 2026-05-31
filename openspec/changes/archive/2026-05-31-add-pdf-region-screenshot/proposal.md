# Add PDF region screenshot to image host

## Why

The embedded pdf.js viewer already lets users select text and copy a `paperland://` link to that selection. But papers carry a lot of information that is **not selectable text** — figures, plots, tables, equations rendered as vector/image content. Today there is no way to capture such a region as an image and share it.

The viewer already exposes an (unwired) `cropRegionToImage({ page, x, y, w, h })` helper, and the site already has a content-addressed image host (图床) with an upload API. This change connects the two: let the user draw a rectangle on a PDF page, render it to a PNG at a configurable DPI, upload it to the image host, and hand back a Markdown snippet whose image links back to the exact region in the PDF.

## What Changes

- **Toolbar capture control.** Add a screenshot icon to the PDF viewer toolbar. Clicking it enters a "region capture" mode where the cursor changes and the user drags a rectangle over a single PDF page.
- **DPI-driven crop.** Generalize the existing `cropRegionToImage` to render the selected region at a configurable DPI (default 300) instead of the current fixed 2× scale. The DPI default lives in `config.yml` (single source of truth), not hardcoded, and is surfaced to the frontend via the existing config endpoint.
- **Upload + clipboard snippet.** On mouse-up, crop the region to a PNG, upload it through the existing image-host API, and copy a Markdown snippet to the clipboard: `[![](<image_url>)](paperland://paper/<id>?pdf=<page>&rx=<x>&ry=<y>&rw=<w>&rh=<h>)`. A toast confirms success.
- **`paperland://` rectangle anchor (new).** Extend the `paperland://` scheme with a normalized rectangle target (`rx`,`ry`,`rw`,`rh`) for a PDF page, alongside the existing `ts`/`te` text-offset target.
- **Jump-to-region navigation (new).** Teach the viewer to accept a `{ page, rect }` navigation request: scroll to the page and draw a transient highlight over the normalized rectangle (reusing the existing flash-overlay mechanism), degrading to a page-only jump if the rect is missing/invalid.
- **Docs + config consistency.** Update `docs/frontend-architecture.md` and `docs/tech-stack.md`, and add the new config key to the config schema/defaults so the config.yml structure stays consistent for any repo that shares it.

## Capabilities

### Modified Capabilities

- **pdfjs-viewer** — adds region-screenshot capture (toolbar control, drag-to-select, DPI-configurable crop, upload, clipboard snippet) and adds rectangle-based external navigation with a transient highlight.
- **markdown-anchors** — extends the `paperland://` PDF anchor with a normalized rectangle target (`rx`,`ry`,`rw`,`rh`).

### Reused Capabilities

- **image-host** — the existing `POST /api/images` upload + content-addressed serving is reused as-is; no changes to the image host itself.

## Impact

- **Frontend:** `PdfViewer.vue` (toolbar control, capture-mode overlay, DPI-aware crop, upload + snippet), `usePdfNavigation.ts` (rect target type), `MarkdownContent.vue` (parse `rx`/`ry`/`rw`/`rh`), `PaperDetail.vue` / `PaperViewerPanel.vue` (route-query rect → nav target). Reuses `imagesApi` / `uploadImage` and `vue-sonner` toasts.
- **Backend:** add a `pdf_capture` (or equivalent) config block with a `dpi` default to the Zod config schema + defaults, and expose it via the existing config-to-frontend channel. No new endpoints, tables, or services.
- **Config:** new configurable DPI default in `config.yml`; documented so the shared config structure stays consistent.
- **Storage:** none beyond the images the user chooses to capture (handled entirely by the existing image host).

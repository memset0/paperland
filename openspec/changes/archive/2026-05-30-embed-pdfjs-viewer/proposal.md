## Why

The PDF原文 tab currently renders the paper inside a native `<iframe type="application/pdf">`, which hands rendering to the browser's built‑in viewer. That viewer gives us no reliable, cross‑browser way to (a) jump to a specific page programmatically, (b) read which page the user is currently on, or (c) draw a highlight over a region of a page. As a result `paperland://` anchor links can only address rendered Markdown blocks — they cannot point into the PDF itself.

Embedding pdf.js as the renderer makes the PDF fully programmable, which unlocks `paperland://` links that jump to a PDF **page**, and — one step further — to a **selection region on that page**, re‑highlighting that selection after the jump. It also lays the groundwork for a future internal image store that snapshots a selected region (the same page + region capture this change introduces).

## What Changes

- Replace the native PDF iframe in `PdfViewer.vue` with an **embedded pdf.js canvas viewer**: continuous vertical scroll, lazy per‑page canvas rendering, a text layer for native text selection, basic zoom, a page indicator and a jump‑to‑page control.
- Extend the `paperland://` scheme with two new PDF target forms:
  - `paperland://paper/<id>?pdf=<page>` — jump to a PDF page.
  - `paperland://paper/<id>?pdf=<page>&ts=<start>&te=<end>` — jump to a page **and** transiently highlight the text selection spanning `[ts, te)` (character offsets into that page's extracted text content, mirroring the existing `s`/`e` offset model).
- Add copy‑link affordances in the PDF viewer: "copy link to this page" always, and "copy link to selection" when a text selection exists.
- When a PDF anchor link is followed (same‑paper or cross‑paper), the viewer panel SHALL auto‑switch to the PDF tab, scroll to the target page, and (if a region is present) transiently highlight it.
- **Forward‑compatible region capture**: the selection is captured both as text offsets (for the link) and as a normalized page bounding rectangle (used internally to draw the highlight), so a future internal image store can crop that region from the canvas. This change does **not** build the image store — only ensures the capture is reusable.
- Update `docs/frontend-architecture.md` and `docs/tech-stack.md` (new `pdfjs-dist` dependency + worker setup).

## Capabilities

### New Capabilities
- `pdfjs-viewer`: An embedded pdf.js renderer for the PDF tab — continuous‑scroll canvas rendering with a selectable text layer, current‑page tracking, jump‑to‑page, basic zoom, text‑selection capture into page‑relative offsets, "copy page / selection link" actions, and an external navigation entry point that scrolls to a page and transiently highlights a region.

### Modified Capabilities
- `markdown-anchors`: The `paperland://` scheme gains `?pdf=<page>` and `?pdf=<page>&ts=<start>&te=<end>` target forms; parsing and click interception resolve and route these to the PDF viewer (switching to the PDF tab in‑app, and carrying `pdf`/`ts`/`te` as route query for cross‑paper navigation).
- `paper-viewer-modes`: The "PDF 原文" tab renders via the embedded pdf.js viewer instead of a native iframe, and the viewer panel accepts an external request to activate the PDF tab and navigate to a page/region.

## Impact

- **Frontend deps**: add `pdfjs-dist`; configure its worker for Vite (`pdf.worker.min.mjs?url`).
- **Frontend code**: rewrite `PdfViewer.vue` (canvas + text layer + toolbar); `PaperViewerPanel.vue` (accept/forward navigation, auto‑switch tab); `MarkdownContent.vue` (`parsePaperlandUrl` + `onAnchorLinkClick` extension); `PaperDetail.vue` (`handleAnchorFromRoute` reads `pdf`/`ts`/`te`); a new composable for shared PDF navigation state (mirroring `useBlockAnchor`'s `requestedResultId` pattern).
- **Backend**: none — PDFs are already served same‑origin from `GET /api/files/*`, which pdf.js can fetch directly.
- **No DB / API schema changes**; no breaking changes to existing Markdown‑block anchors (`h`/`s`/`e` continue to work unchanged).
- **Docs**: `frontend-architecture.md`, `tech-stack.md`.

## Context

Today the PDF原文 tab is `PdfViewer.vue`, a single `<iframe src="/api/files/<pdf_path>" type="application/pdf">` that delegates rendering to the browser's native PDF plugin (`PaperViewerPanel.vue:70`). The native viewer is opaque: there is no portable API to drive its page, read the current page, or overlay UI on a page. The `#page=N` URL fragment is honoured inconsistently across browsers and cannot be intercepted to power an in‑app `paperland://` link.

The `paperland://` anchor system (`markdown-anchors` spec; `MarkdownContent.vue:179‑210`, `useBlockAnchor.ts`) already addresses **rendered Markdown blocks** via `?h=<content_hash>&s=<start>&e=<end>`, where `s`/`e` are character offsets into rendered text and a transient highlight reveals the span. We want the analogous capability for the PDF: address a **page**, and optionally a **selection region** on that page, then jump and transiently highlight.

PDFs are already same‑origin (`GET /api/files/*`, `index.ts:109‑120`), so pdf.js can `getDocument` the same URL with no CORS or backend change. Frontend is Vue 3.4 + Vite 5.4 + Pinia; no PDF library is currently a dependency.

## Goals / Non-Goals

**Goals:**
- Render the PDF tab with embedded pdf.js: continuous vertical scroll, lazy per‑page canvas rendering, a selectable text layer, basic zoom, a page indicator and jump‑to‑page control.
- Programmatic `goToPage(n)` and current‑page tracking.
- Extend `paperland://` with `?pdf=<page>` (page) and `?pdf=<page>&ts=<start>&te=<end>` (page + text selection), parsed and routed in‑app for same‑paper and cross‑paper clicks.
- "Copy link to this page" always; "copy link to selection" when text is selected.
- On following a PDF anchor: auto‑switch to the PDF tab, scroll to the page, transiently highlight the region (no persisted mark), mirroring the Markdown `reveal()` behaviour.
- Capture the selection in a form reusable by a **future** internal image store (page + normalized bounding rect → canvas crop).

**Non-Goals:**
- Full pdf.js toolbar features: in‑document search, thumbnail sidebar, annotations, printing, outline/TOC.
- Persisting PDF highlights to the database (the region highlight is transient only, like the existing Markdown anchor reveal).
- Mapping existing Markdown `h/s/e` anchors onto PDF pages.
- Building the internal image store itself (only forward‑compatibility for it).
- Any backend / DB / API schema change.

## Decisions

### D1: Custom canvas viewer, not the prebuilt `pdfjs-dist/web/viewer.html`
Build a thin Vue component that calls the pdf.js API directly (`getDocument`, `page.render`, text layer) rather than embedding pdf.js's prebuilt viewer in an iframe.
- **Why**: We need first‑class programmatic control (jump to page, read current page, overlay a highlight, capture selection offsets, later crop a region to an image). The prebuilt viewer only exposes `#page=N` + `postMessage`, makes reading the current page hacky, and is awkward to bundle/serve through Vite. The chosen feature scope explicitly excludes the prebuilt viewer's headline extras (search, thumbnails), so its main upside doesn't apply.
- **Alternative considered**: iframe the prebuilt viewer — rejected for the control and bundling reasons above.

### D2: Lazy, virtualized page rendering
Lay out one placeholder element per page sized to the page's aspect ratio (from `page.getViewport`), and render a page's canvas + text layer only when it nears the viewport via `IntersectionObserver`; unrender (drop the canvas) pages far offscreen to cap memory.
- **Why**: Papers can be 30+ pages; rendering all canvases up front is slow and memory‑heavy. Correctly‑sized placeholders keep scroll position and the scrollbar stable so `goToPage(n)` can scroll deterministically before a page is rendered.
- **Alternative considered**: render every page eagerly — simpler but unacceptable for large PDFs.

### D3: Current page via IntersectionObserver, not scroll math
Track the page whose placeholder occupies the most viewport as the "current page"; expose it as reactive state used by the page indicator and by "copy link to this page".
- **Why**: Robust against variable page heights and zoom; avoids brittle cumulative‑offset arithmetic.

### D4: Region encoded as page‑relative text offsets `ts`/`te`, mirroring `s`/`e`
A selection region is stored as `pdf=<page>&ts=<start>&te=<end>`, where `ts`/`te` are character offsets into the **concatenated text content of that page** (pdf.js `page.getTextContent()` item order). On follow, the offsets are re‑mapped to text‑layer spans → client rects → an overlay highlight.
- **Why**: (1) Consistent with the existing highlight/anchor offset model and its `buildTextSegments` mapping (`useHighlight.ts:39‑71`), which we can reuse over the text‑layer container. (2) Zoom/render independent — offsets don't change when the user zooms, unlike pixel coords. (3) Produces clean per‑line highlights (one rect per text line) instead of one fat bounding box. (4) Compact URLs.
- **Why offsets are stable**: the native selection runs over the text layer whose DOM order equals `getTextContent()` order, and pdf.js text extraction is deterministic for a fixed file + pinned pdfjs‑dist version, so capture‑time and follow‑time offsets agree even for multi‑column papers (we never assume visual reading order — we highlight exactly the items the user selected).
- **Alternative considered**: store normalized rect quads in the URL — viewer‑independent but bulkier, zoom‑capture‑dependent, and uglier for multi‑line selections. We still compute a normalized bounding rect internally (see D6) but keep it out of the link.

### D5: Shared navigation state via a composable, mirroring `useBlockAnchor`
Add `usePdfNavigation()` exposing a module‑level `requestedPdfTarget` ref `{ page, ts?, te? } | null`, mirroring `useBlockAnchor`'s `requestedResultId` cross‑component handoff (`useBlockAnchor.ts:15`).
- **Same‑paper click** (`MarkdownContent.onAnchorLinkClick`): set `requestedPdfTarget` directly (no navigation). `PaperViewerPanel` watches it and switches `activeId` to `'pdf'`; `PdfViewer` watches it and scrolls + highlights.
- **Cross‑paper click**: `router.push('/papers/<id>', { query: { pdf, ts, te } })`; `PaperDetail.handleAnchorFromRoute` (`PaperDetail.vue:97`) reads `pdf`/`ts`/`te` and sets `requestedPdfTarget` after the paper loads.
- **Why**: Reuses the established, proven pattern for getting an anchor target across the MarkdownContent → ViewerPanel → PdfViewer boundary without prop drilling, and matches how Markdown anchors already flow through route query.

### D6: Forward‑compatible region capture for a future image store
When capturing a selection, compute and keep (in component state / the returned capture object) both the text offsets (for the link) and a **normalized page bounding rect** `{ page, x, y, w, h }` in `[0,1]` page space. Expose a `cropRegionToImage(target)` helper path (re‑render that page to an offscreen canvas at the target rect and `toDataURL`).
- **Why**: The future internal image store wants to snapshot a selected region. Because rendering is canvas‑based, the same page + normalized rect we already compute to draw the highlight is exactly what's needed to crop an image — so we design the capture to yield it now, without building the store.

### D7: pdf.js worker + lazy import under Vite
Import the worker as a URL — `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` and set `GlobalWorkerOptions.workerSrc = workerUrl` — and dynamically `import('pdfjs-dist')` inside the viewer so the (large) library is code‑split out of the main bundle and only loaded when a PDF tab is opened. Pin the `pdfjs-dist` version for offset stability (D4).

### D8: Graceful failure, no native‑iframe fallback
If pdf.js fails to load or the document fails to parse, show an error state with a plain link to the raw file (`/api/files/<pdf_path>`) so the user can still open it. We do **not** keep the native iframe as a parallel mode.
- **Why**: A second rendering path doubles surface area and reintroduces the un‑programmable viewer; a raw‑file escape hatch covers the failure case.

## Risks / Trade-offs

- **Large‑PDF performance / memory** → D2 lazy render + offscreen unrender; cap concurrent `render()` calls.
- **Offset drift across pdfjs‑dist versions** (text extraction could change) → pin the dependency version (D4, D7); offsets are only ever compared within the same deployed version.
- **Highlight needs the page rendered first** (offsets→rects require the text layer to exist) → on follow, ensure the target page is force‑rendered, then map offsets to rects, then reveal; if the text layer isn't ready, fall back to a page‑only jump.
- **Selection accuracy / text‑layer alignment at non‑100% zoom** → re‑render the text layer at the current scale so its spans align with the canvas; compute offsets from the live text‑layer DOM (not from raw text‑content indices) using a `buildTextSegments`‑style walk.
- **Multi‑column / messy extraction order** → acceptable: we highlight the exact items selected (capture and follow use the same deterministic order), and never rely on visual reading order.
- **Stale region anchor** (page out of range, or offsets exceed the page text) → degrade like Markdown anchors: jump to the page if valid, skip the highlight, and surface a brief "anchor stale" notice; never throw.
- **Bundle size** of pdfjs‑dist → D7 dynamic import / code‑split; only paid when a PDF tab opens.
- **`pdf` vs `h` both present in one link** → treat as mutually exclusive; if both appear, the `pdf` target wins (routes to the PDF tab). Generated links only ever carry one kind.

## Migration Plan

Additive and frontend‑only. No DB/API migration. Steps: add `pdfjs-dist` + worker config → implement viewer + composable → extend scheme parsing/interception/routing → wire copy‑link UI → update docs. **Rollback**: revert the frontend changes; pre‑existing `?h/s/e` anchors are untouched, and any already‑shared `?pdf=…` links simply no longer resolve (parse returns no Markdown target and is ignored) — no data is affected.

## Open Questions

- Should zoom level persist across paper navigations (e.g. in `localStorage`) or reset per paper? (Lean: reset per paper for now.)
- Copy‑link affordance placement: a floating button near the selection (like the Markdown highlight toolbar) vs. a toolbar button that switches between page/selection based on whether a selection exists. (Lean: floating button for selection + a fixed toolbar button for the current page.)

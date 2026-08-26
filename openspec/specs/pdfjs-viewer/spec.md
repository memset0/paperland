# pdfjs-viewer Specification

## Purpose
Render a paper's PDF inline in the paper detail viewer with an embedded pdf.js renderer (in place of a native browser PDF plugin), providing selectable text, lazy continuous-scroll rendering, page navigation and zoom, capture of selections as page-relative offsets, region screenshot capture (drag-to-select → DPI-configurable PNG → image host) with a copyable image+anchor snippet, copyable page/selection anchor links, external page/region (text-offset or rectangle) navigation with transient highlighting, and a graceful raw-file fallback on failure.

## Requirements
### Requirement: Embedded pdf.js rendering of the PDF tab
The PDF原文 tab SHALL render the paper's PDF with an embedded pdf.js renderer instead of a native browser PDF plugin. The PDF SHALL be loaded from the existing same‑origin endpoint `GET /api/files/<pdf_path>`. The viewer SHALL render pages as canvases in a continuous vertical scroll, render each page's pdf.js text layer so text is selectable, and render pages lazily — a page's canvas and text layer are produced only when the page nears the viewport, with a correctly sized placeholder reserving its space beforehand so scroll position is stable.

#### Scenario: Render PDF via pdf.js
- **WHEN** a paper with a `pdf_path` is shown in the PDF tab
- **THEN** the viewer SHALL fetch `/api/files/<pdf_path>` and render its pages with pdf.js, NOT via a native `<iframe type="application/pdf">`

#### Scenario: Continuous scroll with selectable text
- **WHEN** the user scrolls the PDF and selects text on a rendered page
- **THEN** the pages SHALL scroll continuously and the selected text SHALL be a native browser selection over the pdf.js text layer

#### Scenario: Lazy page rendering
- **WHEN** a multi‑page PDF is opened and the user has not yet scrolled to a far page
- **THEN** that far page SHALL show a correctly sized placeholder and SHALL render its canvas only as it nears the viewport

#### Scenario: Empty state
- **WHEN** the paper has no `pdf_path`
- **THEN** the viewer SHALL show the "暂无 PDF" placeholder and SHALL NOT attempt to load a document

### Requirement: Page indicator, jump‑to‑page, and zoom
The viewer SHALL display the current page number and total page count, SHALL provide a control to jump to a specific page number, and SHALL provide basic zoom in/out controls. Jumping to a page SHALL scroll that page into view even if it had not yet been rendered.

#### Scenario: Current page is shown
- **WHEN** the user scrolls so that a given page occupies most of the viewport
- **THEN** the page indicator SHALL report that page as the current page out of the total

#### Scenario: Jump to a page
- **WHEN** the user enters or activates a jump to page N within range
- **THEN** the viewer SHALL scroll page N into view, rendering it first if necessary

#### Scenario: Zoom
- **WHEN** the user zooms in or out
- **THEN** the rendered canvases and their text layers SHALL re‑render at the new scale and stay aligned

### Requirement: Current‑page tracking
The viewer SHALL expose, as reactive state, which page is currently the most visible, determined by which page placeholder occupies the most of the viewport. This current page SHALL drive the page indicator and the "copy link to this page" action.

#### Scenario: Most‑visible page wins
- **WHEN** two pages are partially visible and one occupies more of the viewport
- **THEN** the more‑visible page SHALL be reported as the current page

### Requirement: Capture a PDF selection as page‑relative text offsets
When the user has an active text selection within a single page's text layer, the viewer SHALL be able to capture it as a region target consisting of the 1‑based `page` and a half‑open offset range `[ts, te)` of character offsets into that page's text content, where offsets are computed over the page's text‑layer content in document order (the same offset model used by Markdown highlights). The viewer SHALL also compute, for internal use, a normalized page bounding rectangle `{ page, x, y, w, h }` in `[0,1]` page space for the selection, so the captured region is reusable for drawing the highlight and for a future region‑to‑image snapshot.

#### Scenario: Capture a selection on one page
- **WHEN** the user selects text on page N and triggers a region capture
- **THEN** the capture SHALL yield `page = N` and `[ts, te)` offsets covering exactly the selected text

#### Scenario: Capture also yields a normalized rectangle
- **WHEN** a selection is captured
- **THEN** the capture SHALL also include a normalized `[0,1]` page bounding rectangle for the selection for internal reuse

### Requirement: Copy page and selection anchor links
The viewer SHALL provide an action to copy a current‑page link whose href is `paperland://paper/<id>?pdf=<page>`. When a text selection exists on a page, the viewer SHALL provide an action to copy a selection link whose href is `paperland://paper/<id>?pdf=<page>&ts=<start>&te=<end>`. So the result is clickable when pasted into a Markdown note, the clipboard content SHALL be a Markdown link wrapping that href (the page action copies `[PDF p.<page>](<href>)`; the selection action copies `<selected text> [#](<href>)`, mirroring the Markdown block "copy as anchor"). Copying SHALL confirm with a brief toast.

#### Scenario: Copy current‑page link
- **WHEN** the user triggers "copy link to this page" with the current page being N
- **THEN** the clipboard SHALL contain a Markdown link whose href is `paperland://paper/<id>?pdf=N` and a confirmation toast SHALL appear

#### Scenario: Copy selection link
- **WHEN** the user has a text selection on page N and triggers "copy link to selection"
- **THEN** the clipboard SHALL contain a Markdown link whose href is `paperland://paper/<id>?pdf=N&ts=<start>&te=<end>` for that selection

### Requirement: Navigate to a page or region and transiently highlight
The viewer SHALL accept an external navigation request of the form `{ page }`, `{ page, ts, te }`, or `{ page, rect }` (where `rect` is a normalized `[0,1]` page-space rectangle `{ x, y, w, h }`). On a `{ page }` request it SHALL scroll that page into view. On a `{ page, ts, te }` request it SHALL scroll the page into view, ensure that page is rendered, map the `[ts, te)` offsets back to text‑layer rectangles, and draw a transient highlight over them. On a `{ page, rect }` request it SHALL scroll the page into view, ensure that page is rendered, convert the normalized rectangle to the rendered page's pixel box, and draw a transient highlight over that rectangle. All such highlights are non‑persisted overlays that flash (analogous to the Markdown anchor reveal) and SHALL NOT be saved to the database. When both a text‑offset region and a rectangle are present, the rectangle SHALL take precedence.

#### Scenario: Navigate to a page
- **WHEN** the viewer receives a `{ page: N }` navigation request
- **THEN** it SHALL scroll page N into view

#### Scenario: Navigate to a text region and highlight
- **WHEN** the viewer receives a `{ page: N, ts, te }` navigation request
- **THEN** it SHALL scroll page N into view and transiently highlight the text spanning `[ts, te)` without persisting any highlight

#### Scenario: Navigate to a rectangle region and highlight
- **WHEN** the viewer receives a `{ page: N, rect: { x, y, w, h } }` navigation request
- **THEN** it SHALL scroll page N into view and transiently highlight the rectangle (the normalized coordinates mapped to the rendered page's pixel box) without persisting any highlight

#### Scenario: Stale or degenerate region degrades to page jump
- **WHEN** a region request's offsets are out of range, or a rectangle is missing/degenerate
- **THEN** the viewer SHALL still scroll to the page, skip the highlight, and surface a brief "anchor stale" notice rather than throwing

### Requirement: Region screenshot capture to the image host
The viewer SHALL provide a toolbar control that enters a "region capture" mode in which the user drags a rectangle over a single PDF page; on completion the viewer SHALL render that rectangle to a PNG at the configured capture DPI, upload it to the image host, and copy to the clipboard a Markdown snippet whose image is wrapped in a `paperland://` link back to the captured region. The control SHALL be available only when a `paperId` is provided (so the link can be built). The captured region SHALL be a normalized `{ page, x, y, w, h }` rectangle in `[0,1]` page space, constrained to the single page under the drag's start point.

While capture mode is active, the viewer SHALL show a crosshair cursor and a drag overlay above the text layer so the drag draws a selection rectangle instead of selecting text, and SHALL restore normal text selection when capture mode is exited (via the toolbar control, `Esc`, or after a capture completes).

The clipboard snippet SHALL have the form `[![](<image_url>)](paperland://paper/<id>?pdf=<page>&rx=<x>&ry=<y>&rw=<w>&rh=<h>)`, where `<image_url>` is the uploaded image's URL and `rx`,`ry`,`rw`,`rh` are the normalized region coordinates. A brief toast SHALL confirm success; an upload failure SHALL surface a brief error toast and SHALL NOT crash the viewer.

#### Scenario: Enter capture mode and draw a region
- **WHEN** the user activates the capture control and drags a rectangle on page N
- **THEN** the viewer SHALL show a crosshair cursor and a drag rectangle, and SHALL NOT create a native text selection during the drag
- **AND** on release it SHALL form a normalized `{ page: N, x, y, w, h }` region clamped to page N's bounds

#### Scenario: Capture uploads and copies a snippet
- **WHEN** a region on page N is captured for a paper with id <id>
- **THEN** the viewer SHALL render the region to a PNG, upload it to the image host, and copy `[![](<image_url>)](paperland://paper/<id>?pdf=N&rx=<x>&ry=<y>&rw=<w>&rh=<h>)` to the clipboard
- **AND** a confirmation toast SHALL appear

#### Scenario: Upload failure is surfaced
- **WHEN** the image upload fails (e.g. the rendered PNG exceeds the image host size limit)
- **THEN** the viewer SHALL show a brief error toast and SHALL remain usable, with no snippet copied

#### Scenario: Capture control hidden without a paper id
- **WHEN** the viewer is shown without a `paperId`
- **THEN** the region capture control SHALL NOT be available

### Requirement: Configurable region-capture DPI
The viewer SHALL render a captured region at a configurable DPI whose default is defined in `config.yml` (not hardcoded in the frontend), defaulting to 300. The render scale SHALL be derived from the DPI as `scale = dpi / 72` (PDF user-space units are 1/72 inch). To bound memory at high DPI, the viewer SHALL render only the captured region (a region-sized canvas), not the whole page rasterized then cropped.

#### Scenario: Default DPI comes from config
- **WHEN** no per-capture DPI override is provided
- **THEN** the viewer SHALL render the region at the `config.yml`-defined capture DPI default (300 unless configured otherwise)

#### Scenario: DPI determines render scale
- **WHEN** the capture DPI is 300
- **THEN** the region SHALL be rendered at scale `300 / 72` so the resulting PNG resolution matches that DPI

### Requirement: Graceful failure with a raw‑file fallback
When pdf.js fails to load or the document fails to parse, the viewer SHALL show an error state that includes a plain link to the raw file at `/api/files/<pdf_path>` so the user can still open the PDF directly. The viewer SHALL NOT crash the surrounding page.

#### Scenario: Document fails to load
- **WHEN** pdf.js cannot load or parse the PDF
- **THEN** the viewer SHALL show an error message with a working link to `/api/files/<pdf_path>`

### Requirement: Theme-Aware PDF Rendering

The system SHALL render PDF pages with colors matching the active theme: in light mode a white page background with the document's native colors, and in dark mode a gray page background with light (near-white) foreground text, using pdf.js's native `pageColors` render option to set background and foreground independently.

#### Scenario: Rendering a page in light mode
- **WHEN** the active resolved theme is light and a page is rendered
- **THEN** the page SHALL render with a white background and the document's original colors
- **AND** the `.pdf-page` background SHALL be white

#### Scenario: Rendering a page in dark mode
- **WHEN** the active resolved theme is dark and a page is rendered
- **THEN** the page SHALL be rendered with `pageColors` set to a gray background and a light foreground
- **AND** the `.pdf-page` background SHALL be a dark/gray tone rather than hard-coded white

#### Scenario: Overlays remain theme-correct
- **WHEN** a page is rendered in dark mode
- **THEN** the text-selection highlight and the transient region-flash overlay SHALL continue to use the UI theme tokens and remain visible (they are not affected by `pageColors`, since they sit above the canvas raster)

### Requirement: Flicker-Free PDF Rendering

The system SHALL NOT show a flash of a wrongly-colored (e.g. white) canvas while a page is rendering. Because pdf.js fills the canvas with its background color at the start of a render and applies the `pageColors` recolor only at the end, the system SHALL render each page into an off-document canvas and insert (or swap in) that canvas only after rendering completes, so no intermediate frame is painted. Any previously-rendered canvas for the page SHALL remain visible until the new one is ready.

#### Scenario: Opening a PDF in dark mode
- **WHEN** a PDF page is rendered for the first time while the resolved theme is dark
- **THEN** the page SHALL appear already dark (gray background, light text)
- **AND** no white (or otherwise un-themed) frame SHALL be visible at any point during that render

#### Scenario: Re-rastering on zoom keeps the page visible
- **WHEN** a rendered page is re-rastered at a new scale
- **THEN** the existing rendered canvas SHALL stay visible until the new one finishes
- **AND** no blank or white frame SHALL appear during the re-raster

### Requirement: Re-Render PDF Pages On Theme Change

The system SHALL re-render the live (visible / near-viewport) PDF page(s) when the active resolved theme changes, since `pageColors` are baked into the rasterized canvas and cannot recolor in place; off-screen pages MAY re-render lazily when next scrolled into view.

#### Scenario: Switching theme with a PDF open
- **WHEN** a PDF is open and the resolved theme changes from light to dark (or dark to light)
- **THEN** the live page(s) SHALL re-render with the new theme's colors
- **AND** each page's previous canvas SHALL remain visible until its newly-colored canvas is ready, so the switch shows no blank or white flash

### Requirement: Stable PDF text selection triggers translation
For an authenticated user, the PDF viewer SHALL observe native browser selections inside one rendered pdf.js page text layer. A non-empty selection SHALL become eligible for translation only when its selected text, page number, and `[ts, te)` text offsets remain unchanged for at least 500 milliseconds. Before that delay expires, the viewer SHALL preserve normal selection behavior and SHALL NOT call the translation API. Each stable selection identity SHALL start at most one active translation request unless the user later selects a different identity or explicitly retries.

#### Scenario: Selection remains stable for 500ms
- **WHEN** an authenticated user selects `hello, world` within one PDF text layer and its text/page/offset identity remains unchanged for 500ms
- **THEN** the viewer SHALL start one cache-first streaming translation request for `hello, world`

#### Scenario: Selection changes before timeout
- **WHEN** the user changes the selection before 500ms elapses
- **THEN** the old timer SHALL be cancelled and no translation SHALL start for the superseded selection
- **AND** a new 500ms interval SHALL begin only for the new valid selection

#### Scenario: Collapsed selection does not translate
- **WHEN** the native selection is empty or collapsed
- **THEN** the viewer SHALL cancel any pending stable-selection timer and SHALL NOT call the translation API

#### Scenario: Selection outside one PDF page is ineligible
- **WHEN** a selection is outside the viewer, outside a pdf.js text layer, or crosses PDF pages
- **THEN** the viewer SHALL preserve native selection but SHALL NOT start selection translation

#### Scenario: Existing stable identity does not duplicate request
- **WHEN** repeated `selectionchange` events report the same page/text/offset identity after its request has begun
- **THEN** the viewer SHALL NOT create duplicate translation requests

### Requirement: Selection-anchored streaming translation panel
When an eligible stable selection begins translating, the viewer SHALL show a lightweight panel anchored to that selection. It SHALL prefer a position centered above the selection; when the available space is insufficient it SHALL appear below, and its final position/width SHALL remain clamped within the visible PDF viewer. The panel SHALL show a Translation heading plus waiting, streaming, completed, or failed state and SHALL render the selected text's result using the existing streaming translation component. Genuine provider deltas SHALL become visible according to that component's rendering contract; a cache hit SHALL complete immediately.

#### Scenario: Panel appears above selection
- **WHEN** sufficient viewer space exists above the selected range
- **THEN** the translation panel SHALL be centered above the range with a visual gap and SHALL NOT cover the selected text

#### Scenario: Panel falls below near top edge
- **WHEN** the selection is too close to the top of the visible viewer for the panel
- **THEN** the panel SHALL appear below the selection without overlapping the existing selection-link action

#### Scenario: Panel is clamped on narrow viewer
- **WHEN** the selection center is close to a left/right edge or the viewer is narrow
- **THEN** the panel width and horizontal position SHALL be clamped inside the viewer with a safe inset

#### Scenario: Streaming result grows in panel
- **WHEN** the provider emits ordered translation deltas
- **THEN** the panel SHALL show the growing translated text before completion and SHALL finish with the authoritative final text

#### Scenario: Cached selection translation is immediate
- **WHEN** the exact selected text already exists in the shared translation cache
- **THEN** the panel SHALL show the cached completed translation without a model call or fabricated streaming

#### Scenario: Translation failure remains actionable
- **WHEN** selection translation fails after zero or more partial deltas
- **THEN** the panel SHALL show a concise failure state and a retry action for the unchanged selection

### Requirement: Selection translation lifecycle follows the native selection
The pending timer, active request, and panel SHALL belong to one immutable selection identity. An ordinary outside click, unowned native-selection collapse, leaving the valid text layer, switching PDF/paper, entering region-capture mode, or unmounting the viewer SHALL cancel pending work, abort active work, and remove the old panel. A transient collapse caused by pointer interaction inside the panel SHALL preserve the active panel/source snapshot. A different valid selection SHALL leave the old panel visible during its 500ms candidate interval and replace it only when the new identity activates. Late events from cancelled or superseded requests SHALL NOT alter the current panel. Scrolling the PDF while the selection remains valid SHALL reposition the selection UI at the next animation frame; zoom or text-layer rerender that invalidates the DOM Range SHALL close it.

#### Scenario: New selection replaces active translation
- **WHEN** a translation is active and the user selects different text
- **THEN** the old panel SHALL remain visible while the new selection completes its own 500ms stability delay
- **AND** when the new identity activates, the old request SHALL be aborted and the panel SHALL be replaced by the new translation

#### Scenario: Plain outside click dismisses panel
- **WHEN** the translation panel is visible and a pointer interaction outside it completes without creating a different valid PDF selection
- **THEN** the viewer SHALL close the panel and abort any active request

#### Scenario: Escape closes panel
- **WHEN** the translation panel is visible and the user presses Escape
- **THEN** the panel and active request SHALL close while the existing completed database cache, if any, remains unchanged

#### Scenario: Viewer scroll repositions panel
- **WHEN** the selected text remains selected while the PDF viewport scrolls
- **THEN** panel positioning SHALL be recomputed on an animation frame so it stays attached to the selection or closes if the range is no longer valid/visible

#### Scenario: Zoom rerender invalidates selection
- **WHEN** zooming or page rerender replaces the selected text-layer nodes
- **THEN** the old timer/request/panel SHALL be cancelled instead of remaining at stale coordinates

#### Scenario: Late event is ignored
- **WHEN** an aborted selection request emits a late delta or terminal event
- **THEN** it SHALL NOT update the panel for the current selection

### Requirement: Selection translation coexists with PDF selection tools and authentication
Selection translation SHALL reuse the native text selection and SHALL NOT remove or replace the existing copy-selection-link action. Pointer interaction inside the translation panel SHALL NOT inadvertently clear the source selection. Entering region screenshot capture mode SHALL suppress selection translation. Only authenticated users SHALL trigger the translation API; anonymous users SHALL retain native selection and existing public PDF behavior without an automatic login prompt or translation panel.

#### Scenario: Copy selection link remains available
- **WHEN** an authenticated user has a valid single-page selection
- **THEN** the existing copy-selection-link action SHALL remain usable alongside the translation panel and SHALL address the same page/offset selection

#### Scenario: Panel interaction preserves source selection
- **WHEN** the user presses a panel control or scrolls the panel and browser focus transfer temporarily collapses the source PDF selection
- **THEN** the viewer SHALL preserve the translation panel and source snapshot instead of treating that `selectionchange` as outside dismissal
- **AND** the viewer SHALL restore the cloned source Range on pointer-up when the DOM Range remains valid

#### Scenario: Capture mode suppresses translation
- **WHEN** region screenshot capture mode is active
- **THEN** selection translation timers/panels SHALL be cancelled and drag capture SHALL retain its existing behavior

#### Scenario: Anonymous selection does not call API
- **WHEN** an anonymous visitor selects PDF text and leaves it unchanged for 500ms
- **THEN** no translation request or automatic login prompt SHALL occur
- **AND** the native selection and other anonymously available viewer behavior SHALL remain intact

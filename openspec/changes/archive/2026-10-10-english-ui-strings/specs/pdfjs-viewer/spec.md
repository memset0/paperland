## MODIFIED Requirements

### Requirement: Embedded pdf.js rendering of the PDF tab
The "PDF" tab SHALL render the paper's PDF with an embedded pdf.js renderer instead of a native browser PDF plugin. The PDF SHALL be loaded from the existing same‑origin endpoint `GET /api/files/<pdf_path>`. The viewer SHALL render pages as canvases in a continuous vertical scroll, render each page's pdf.js text layer so text is selectable, and render pages lazily — a page's canvas and text layer are produced only when the page nears the viewport, with a correctly sized placeholder reserving its space beforehand so scroll position is stable.

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
- **THEN** the viewer SHALL show the "No PDF yet" placeholder and SHALL NOT attempt to load a document

### Requirement: Region screenshot capture to the image host
The viewer SHALL provide a toolbar control that enters a "region capture" mode in which the user drags a rectangle over a single PDF page; on completion the viewer SHALL keep the captured region visibly highlighted on the page and SHALL offer a small action menu centered directly below that highlighted region, in this order: "Copy image link" (copy the image URL) and "Copy Markdown" (copy the Markdown image with its location link) for everyone who can capture, plus "Add to question" (add to the question box) and "Ask about screenshot" (ask about the screenshot directly) for authenticated users. Every action SHALL first render that rectangle to a PNG at the configured capture DPI and upload it to the image host; "Copy image link" SHALL then copy the bare image-host URL, "Copy Markdown" SHALL copy a Markdown snippet whose image is wrapped in a `paperland://` link back to the captured region, while the two ask actions SHALL use the uploaded image as an image input (see `contextual-qa`). The highlight and the menu SHALL be anchored to the captured page so they scroll and zoom with it, and SHALL stay visible until the capture is resolved: an action succeeds, the menu is dismissed, a new drag starts, or capture mode exits. While an upload is in progress the menu actions SHALL be disabled, and after a failed upload the highlight and menu SHALL remain so the user can retry. Dismissing the menu SHALL discard the capture without uploading and SHALL remove the highlight. The control SHALL be available only when a `paperId` is provided (so the link can be built). The captured region SHALL be a normalized `{ page, x, y, w, h }` rectangle in `[0,1]` page space, constrained to the single page under the drag's start point.

While capture mode is active, the viewer SHALL show a crosshair cursor and a drag overlay above the text layer so the drag draws a selection rectangle instead of selecting text, and SHALL restore normal text selection when capture mode is exited (via the toolbar control, `Esc`, or after a capture completes).

The clipboard snippet SHALL have the form `[![](<image_url>)](paperland://paper/<id>?pdf=<page>&rx=<x>&ry=<y>&rw=<w>&rh=<h>)`, where `<image_url>` is the uploaded image's URL and `rx`,`ry`,`rw`,`rh` are the normalized region coordinates. A brief toast SHALL confirm success; an upload failure SHALL surface a brief error toast and SHALL NOT crash the viewer.

#### Scenario: Enter capture mode and draw a region
- **WHEN** the user activates the capture control and drags a rectangle on page N
- **THEN** the viewer SHALL show a crosshair cursor and a drag rectangle, and SHALL NOT create a native text selection during the drag
- **AND** on release it SHALL form a normalized `{ page: N, x, y, w, h }` region clamped to page N's bounds

#### Scenario: Capture uploads and copies a snippet
- **WHEN** a region on page N is captured for a paper with id <id> and the user chooses "Copy Markdown"
- **THEN** the viewer SHALL render the region to a PNG, upload it to the image host, and copy `[![](<image_url>)](paperland://paper/<id>?pdf=N&rx=<x>&ry=<y>&rw=<w>&rh=<h>)` to the clipboard
- **AND** a confirmation toast SHALL appear

#### Scenario: Capture copies the bare image URL
- **WHEN** a region is captured and the user chooses "Copy image link"
- **THEN** the viewer SHALL upload the PNG to the image host and copy only `<image_url>` to the clipboard, with a confirmation toast

#### Scenario: Upload failure is surfaced
- **WHEN** the image upload fails (e.g. the rendered PNG exceeds the image host size limit)
- **THEN** the viewer SHALL show a brief error toast and SHALL remain usable, with no snippet copied

#### Scenario: Capture control hidden without a paper id
- **WHEN** the viewer is shown without a `paperId`
- **THEN** the region capture control SHALL NOT be available

#### Scenario: Ask about a captured region
- **WHEN** an authenticated user captures a region and chooses "Ask about screenshot"
- **THEN** the viewer SHALL upload the PNG to the image host and start a direct ask with that image as `@Image1`

#### Scenario: Dismiss the capture menu
- **WHEN** the user presses `Esc` or clicks elsewhere while the capture action menu is open
- **THEN** nothing SHALL be uploaded or copied
- **AND** the region highlight SHALL be removed

#### Scenario: Captured region stays highlighted with the menu below it
- **WHEN** the user releases a drag that forms a valid region on page N
- **THEN** the region SHALL remain highlighted on page N with the action menu centered directly below it
- **AND** when the user scrolls or zooms, the highlight and menu SHALL move with page N and keep their position relative to the region

#### Scenario: Highlight persists through upload and failure
- **WHEN** the user chooses an action and the upload is in progress
- **THEN** the highlight and the menu SHALL stay visible with the actions disabled
- **AND** if the upload fails, the highlight and menu SHALL remain so the user can choose an action again

#### Scenario: Highlight cleared after a successful action
- **WHEN** a capture action completes successfully
- **THEN** the highlight and the menu SHALL be removed

### Requirement: Selection toolbar translate button starts translation
For an authenticated user, once a native selection inside one rendered pdf.js page text layer settles, the PDF viewer SHALL show a floating selection toolbar centered below the selection containing a "Translate" button. The viewer SHALL NOT call the translation API merely because a selection exists or stays unchanged. Clicking the button SHALL start exactly one cache-first streaming translation for the current page/text/offset selection identity and show the translation panel. Clicking it again for the same identity while its panel is open SHALL NOT start a duplicate request.

#### Scenario: Selection shows toolbar without translating
- **WHEN** an authenticated user selects `hello, world` within one PDF text layer and leaves it selected
- **THEN** the selection toolbar with a "Translate" button SHALL appear below the selection
- **AND** no translation request SHALL be made

#### Scenario: Clicking translate starts translation
- **WHEN** the user clicks the "Translate" button for the current selection
- **THEN** the viewer SHALL start one cache-first streaming translation request for that selected text and show the panel above the selection

#### Scenario: Repeated click does not duplicate
- **WHEN** the panel for the current selection identity is already open and the user clicks "Translate" again
- **THEN** no duplicate translation request SHALL be created

#### Scenario: Selection outside one PDF page is ineligible
- **WHEN** a selection is collapsed, outside the viewer, outside a pdf.js text layer, or crosses PDF pages
- **THEN** the viewer SHALL preserve native selection but SHALL NOT show the selection toolbar or start translation

### Requirement: Selection-anchored streaming translation panel
When the user explicitly starts translating an eligible selection, the viewer SHALL show a lightweight panel anchored to that selection. It SHALL prefer a position centered above the selection; when the available space is insufficient it SHALL appear below, and its final position/width SHALL remain clamped within the visible PDF viewer. The panel SHALL show a Translation heading plus waiting, streaming, completed, or failed state and SHALL render the selected text's result using the existing streaming translation component. Before any translated text is available, the panel's result area SHALL display the selected source text and SHALL NOT display a textual loading placeholder. On the first genuine provider delta or an immediate cache result, the source preview SHALL be replaced by the translated text. Genuine provider deltas SHALL become visible according to that component's rendering contract; a cache hit SHALL complete immediately.

#### Scenario: Panel appears above selection
- **WHEN** sufficient viewer space exists above the selected range
- **THEN** the translation panel SHALL be centered above the range with a visual gap and SHALL NOT cover the selected text

#### Scenario: Panel falls below near top edge
- **WHEN** the selection is too close to the top of the visible viewer for the panel
- **THEN** the panel SHALL appear below the selection without overlapping the selection toolbar

#### Scenario: Panel is clamped on narrow viewer
- **WHEN** the selection center is close to a left/right edge or the viewer is narrow
- **THEN** the panel width and horizontal position SHALL be clamped inside the viewer with a safe inset

#### Scenario: Selected source is visible while awaiting translation
- **WHEN** the user has started translating a PDF selection and no translated text is available yet
- **THEN** the panel result area SHALL display the selected source text
- **AND** it SHALL NOT display a textual loading placeholder such as "Waiting for translation" or "Loading translation"

#### Scenario: First translated text replaces source preview
- **WHEN** the translation request emits its first non-empty translated text or returns a cached translation
- **THEN** the panel result area SHALL replace the source preview with that translated text
- **AND** subsequent provider deltas SHALL continue growing the translated text normally

#### Scenario: Streaming result grows in panel
- **WHEN** the provider emits ordered translation deltas
- **THEN** the panel SHALL show the growing translated text before completion and SHALL finish with the authoritative final text

#### Scenario: Cached selection translation is immediate
- **WHEN** the exact selected text already exists in the shared translation cache
- **THEN** the panel SHALL show the cached completed translation without a model call or fabricated streaming

#### Scenario: Translation failure remains actionable
- **WHEN** selection translation fails after zero or more partial deltas
- **THEN** the panel SHALL show a concise failure state and a retry action for the unchanged selection

### Requirement: Selection translation coexists with PDF selection tools and authentication
Selection translation SHALL reuse the native text selection. The translate button, the "Ask" (ask) and "Add to question" (add to question box) actions, and the existing copy-selection-link action SHALL share one floating selection toolbar below the selection. "Ask" and "Add to question" SHALL also be offered for selections spanning several pages (see `contextual-qa`); translation and copy-selection-link keep their single-page behavior. Pointer interaction inside the translation panel or the toolbar SHALL NOT inadvertently clear the source selection. Entering region screenshot capture mode SHALL suppress the toolbar and selection translation. Only authenticated users SHALL see the translate, "Ask", and "Add to question" buttons or trigger the translation or Q&A APIs; the ask actions SHALL be disabled with a hint when the paper has no usable full text; anonymous users SHALL retain native selection and existing public PDF behavior without an automatic login prompt or translation panel.

#### Scenario: Copy selection link remains available
- **WHEN** an authenticated user has a valid single-page selection in a paper's PDF
- **THEN** the selection toolbar SHALL offer the translate button, "Ask", "Add to question", and the copy-selection-link action, addressing the same page/offset selection

#### Scenario: Panel interaction preserves source selection
- **WHEN** the user presses a panel control or scrolls the panel and browser focus transfer temporarily collapses the source PDF selection
- **THEN** the viewer SHALL preserve the translation panel and source snapshot instead of treating that `selectionchange` as outside dismissal
- **AND** the viewer SHALL restore the cloned source Range on pointer-up when the DOM Range remains valid

#### Scenario: Capture mode suppresses translation
- **WHEN** region screenshot capture mode is active
- **THEN** the selection toolbar and translation panel SHALL be removed and drag capture SHALL retain its existing behavior

#### Scenario: Anonymous selection does not call API
- **WHEN** an anonymous visitor selects PDF text
- **THEN** no translate button, translation request, or automatic login prompt SHALL appear
- **AND** the native selection and other anonymously available viewer behavior SHALL remain intact

#### Scenario: Ask actions on a cross-page selection
- **WHEN** an authenticated user selects a paragraph that continues onto the next page
- **THEN** the toolbar SHALL offer "Ask" and "Add to question" for the whole selection

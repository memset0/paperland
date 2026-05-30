## ADDED Requirements

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
The viewer SHALL accept an external navigation request of the form `{ page }` or `{ page, ts, te }`. On a `{ page }` request it SHALL scroll that page into view. On a `{ page, ts, te }` request it SHALL scroll the page into view, ensure that page is rendered, map the `[ts, te)` offsets back to text‑layer rectangles, and draw a transient highlight over them (a non‑persisted overlay that flashes, analogous to the Markdown anchor reveal). The highlight SHALL NOT be saved to the database.

#### Scenario: Navigate to a page
- **WHEN** the viewer receives a `{ page: N }` navigation request
- **THEN** it SHALL scroll page N into view

#### Scenario: Navigate to a region and highlight
- **WHEN** the viewer receives a `{ page: N, ts, te }` navigation request
- **THEN** it SHALL scroll page N into view and transiently highlight the text spanning `[ts, te)` without persisting any highlight

#### Scenario: Stale region degrades to page jump
- **WHEN** a region request's offsets are out of range for the page's text
- **THEN** the viewer SHALL still scroll to the page, skip the highlight, and surface a brief "anchor stale" notice rather than throwing

### Requirement: Graceful failure with a raw‑file fallback
When pdf.js fails to load or the document fails to parse, the viewer SHALL show an error state that includes a plain link to the raw file at `/api/files/<pdf_path>` so the user can still open the PDF directly. The viewer SHALL NOT crash the surrounding page.

#### Scenario: Document fails to load
- **WHEN** pdf.js cannot load or parse the PDF
- **THEN** the viewer SHALL show an error message with a working link to `/api/files/<pdf_path>`

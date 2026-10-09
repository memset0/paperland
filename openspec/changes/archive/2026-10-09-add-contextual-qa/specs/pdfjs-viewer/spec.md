## MODIFIED Requirements

### Requirement: Selection translation coexists with PDF selection tools and authentication
Selection translation SHALL reuse the native text selection. The translate button, the 提问 (ask) and 加入提问框 (add to question box) actions, and the existing copy-selection-link action SHALL share one floating selection toolbar below the selection. 提问 and 加入提问框 SHALL also be offered for selections spanning several pages (see `contextual-qa`); translation and copy-selection-link keep their single-page behavior. Pointer interaction inside the translation panel or the toolbar SHALL NOT inadvertently clear the source selection. Entering region screenshot capture mode SHALL suppress the toolbar and selection translation. Only authenticated users SHALL see the translate, 提问, and 加入提问框 buttons or trigger the translation or Q&A APIs; the ask actions SHALL be disabled with a hint when the paper has no usable full text; anonymous users SHALL retain native selection and existing public PDF behavior without an automatic login prompt or translation panel.

#### Scenario: Copy selection link remains available
- **WHEN** an authenticated user has a valid single-page selection in a paper's PDF
- **THEN** the selection toolbar SHALL offer the translate button, 提问, 加入提问框, and the copy-selection-link action, addressing the same page/offset selection

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
- **THEN** the toolbar SHALL offer 提问 and 加入提问框 for the whole selection

### Requirement: Region screenshot capture to the image host
The viewer SHALL provide a toolbar control that enters a "region capture" mode in which the user drags a rectangle over a single PDF page; on completion the viewer SHALL offer a small action menu next to the region, in this order: 复制图片链接 (copy the image URL) and 复制 Markdown (copy the Markdown image with its location link) for everyone who can capture, plus 加入提问框 (add to the question box) and 截图提问 (ask about the screenshot directly) for authenticated users. Every action SHALL first render that rectangle to a PNG at the configured capture DPI and upload it to the image host; 复制图片链接 SHALL then copy the bare image-host URL, 复制 Markdown SHALL copy a Markdown snippet whose image is wrapped in a `paperland://` link back to the captured region, while the two ask actions SHALL use the uploaded image as an image input (see `contextual-qa`). Dismissing the menu SHALL discard the capture without uploading. The control SHALL be available only when a `paperId` is provided (so the link can be built). The captured region SHALL be a normalized `{ page, x, y, w, h }` rectangle in `[0,1]` page space, constrained to the single page under the drag's start point.

While capture mode is active, the viewer SHALL show a crosshair cursor and a drag overlay above the text layer so the drag draws a selection rectangle instead of selecting text, and SHALL restore normal text selection when capture mode is exited (via the toolbar control, `Esc`, or after a capture completes).

The clipboard snippet SHALL have the form `[![](<image_url>)](paperland://paper/<id>?pdf=<page>&rx=<x>&ry=<y>&rw=<w>&rh=<h>)`, where `<image_url>` is the uploaded image's URL and `rx`,`ry`,`rw`,`rh` are the normalized region coordinates. A brief toast SHALL confirm success; an upload failure SHALL surface a brief error toast and SHALL NOT crash the viewer.

#### Scenario: Enter capture mode and draw a region
- **WHEN** the user activates the capture control and drags a rectangle on page N
- **THEN** the viewer SHALL show a crosshair cursor and a drag rectangle, and SHALL NOT create a native text selection during the drag
- **AND** on release it SHALL form a normalized `{ page: N, x, y, w, h }` region clamped to page N's bounds

#### Scenario: Capture uploads and copies a snippet
- **WHEN** a region on page N is captured for a paper with id <id> and the user chooses 复制 Markdown
- **THEN** the viewer SHALL render the region to a PNG, upload it to the image host, and copy `[![](<image_url>)](paperland://paper/<id>?pdf=N&rx=<x>&ry=<y>&rw=<w>&rh=<h>)` to the clipboard
- **AND** a confirmation toast SHALL appear

#### Scenario: Capture copies the bare image URL
- **WHEN** a region is captured and the user chooses 复制图片链接
- **THEN** the viewer SHALL upload the PNG to the image host and copy only `<image_url>` to the clipboard, with a confirmation toast

#### Scenario: Upload failure is surfaced
- **WHEN** the image upload fails (e.g. the rendered PNG exceeds the image host size limit)
- **THEN** the viewer SHALL show a brief error toast and SHALL remain usable, with no snippet copied

#### Scenario: Capture control hidden without a paper id
- **WHEN** the viewer is shown without a `paperId`
- **THEN** the region capture control SHALL NOT be available

#### Scenario: Ask about a captured region
- **WHEN** an authenticated user captures a region and chooses 截图提问
- **THEN** the viewer SHALL upload the PNG to the image host and start a direct ask with that image as `@Image1`

#### Scenario: Dismiss the capture menu
- **WHEN** the user presses `Esc` or clicks elsewhere while the capture action menu is open
- **THEN** nothing SHALL be uploaded or copied

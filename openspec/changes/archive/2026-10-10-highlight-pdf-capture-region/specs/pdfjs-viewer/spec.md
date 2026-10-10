## MODIFIED Requirements

### Requirement: Region screenshot capture to the image host
The viewer SHALL provide a toolbar control that enters a "region capture" mode in which the user drags a rectangle over a single PDF page; on completion the viewer SHALL keep the captured region visibly highlighted on the page and SHALL offer a small action menu centered directly below that highlighted region, in this order: 复制图片链接 (copy the image URL) and 复制 Markdown (copy the Markdown image with its location link) for everyone who can capture, plus 加入提问框 (add to the question box) and 截图提问 (ask about the screenshot directly) for authenticated users. Every action SHALL first render that rectangle to a PNG at the configured capture DPI and upload it to the image host; 复制图片链接 SHALL then copy the bare image-host URL, 复制 Markdown SHALL copy a Markdown snippet whose image is wrapped in a `paperland://` link back to the captured region, while the two ask actions SHALL use the uploaded image as an image input (see `contextual-qa`). The highlight and the menu SHALL be anchored to the captured page so they scroll and zoom with it, and SHALL stay visible until the capture is resolved: an action succeeds, the menu is dismissed, a new drag starts, or capture mode exits. While an upload is in progress the menu actions SHALL be disabled, and after a failed upload the highlight and menu SHALL remain so the user can retry. Dismissing the menu SHALL discard the capture without uploading and SHALL remove the highlight. The control SHALL be available only when a `paperId` is provided (so the link can be built). The captured region SHALL be a normalized `{ page, x, y, w, h }` rectangle in `[0,1]` page space, constrained to the single page under the drag's start point.

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

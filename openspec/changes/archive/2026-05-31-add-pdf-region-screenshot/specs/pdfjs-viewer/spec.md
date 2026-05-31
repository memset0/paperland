# pdfjs-viewer Specification

## ADDED Requirements

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

## MODIFIED Requirements

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

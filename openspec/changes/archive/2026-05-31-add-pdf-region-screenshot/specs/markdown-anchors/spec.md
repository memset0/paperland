# markdown-anchors Specification

## MODIFIED Requirements

### Requirement: `paperland://` anchor link scheme
The system SHALL support an in-app anchor link scheme `paperland://` that addresses a location in a paper. A target SHALL be either a **Markdown block** (optionally a span within it) or a **PDF page** (optionally a text selection or a rectangular region within it); the block and PDF target kinds are mutually exclusive within a single link. The link forms SHALL be:
- `paperland://paper/<paperId>` — the paper page only,
- `paperland://paper/<paperId>?h=<content_hash>` — a specific `MarkdownContent` block,
- `paperland://paper/<paperId>?h=<content_hash>&s=<start>&e=<end>` — a span within that block,
- `paperland://paper/<paperId>?pdf=<page>` — a PDF page (1‑based),
- `paperland://paper/<paperId>?pdf=<page>&ts=<start>&te=<end>` — a text selection within that PDF page, where `ts`/`te` are half‑open character offsets into the page's text content,
- `paperland://paper/<paperId>?pdf=<page>&rx=<x>&ry=<y>&rw=<w>&rh=<h>` — a rectangular region within that PDF page, where `rx`,`ry`,`rw`,`rh` are normalized `[0,1]` page‑space coordinates (left, top, width, height).

The Markdown block SHALL be identified by its `content_hash` (the same MD5-of-whitespace-stripped-content hash used by highlights), NOT by any Q&A entry or result id or index. The PDF page SHALL be identified by its 1‑based page number; a selection by `ts`/`te` offsets (the same offset model as `s`/`e`); a rectangular region by normalized `[0,1]` coordinates. If a link carries both `h` and `pdf`, the `pdf` target SHALL take precedence. If a PDF link carries both a text selection (`ts`/`te`) and a rectangle (`rx`…`rh`), the rectangle SHALL take precedence. Malformed or out-of-range coordinates SHALL be ignored, degrading to a page-only target rather than failing. Anchor links MAY appear inline anywhere in note bodies (or any other Markdown content) and a single document MAY contain multiple anchor links.

#### Scenario: Parse a block-level anchor link
- **WHEN** the system processes a link `paperland://paper/123?h=ab12cd`
- **THEN** it SHALL resolve a target of paper id 123 and content hash `ab12cd` with no offset range

#### Scenario: Parse a page-only anchor link
- **WHEN** the system processes a link `paperland://paper/123` with no query
- **THEN** it SHALL resolve a target of paper id 123 with no block and no range

#### Scenario: Offsets are optional
- **WHEN** an anchor link omits `s` and `e`
- **THEN** the target SHALL be treated as the whole block (no within-block range)

#### Scenario: Parse a PDF page anchor link
- **WHEN** the system processes a link `paperland://paper/123?pdf=5`
- **THEN** it SHALL resolve a PDF target of paper id 123, page 5, with no region

#### Scenario: Parse a PDF selection anchor link
- **WHEN** the system processes a link `paperland://paper/123?pdf=5&ts=40&te=120`
- **THEN** it SHALL resolve a PDF target of paper id 123, page 5, region `[40, 120)`

#### Scenario: Parse a PDF rectangle anchor link
- **WHEN** the system processes a link `paperland://paper/123?pdf=5&rx=0.1&ry=0.2&rw=0.3&rh=0.15`
- **THEN** it SHALL resolve a PDF target of paper id 123, page 5, rectangle `{ x: 0.1, y: 0.2, w: 0.3, h: 0.15 }`

#### Scenario: Rectangle takes precedence over a text selection
- **WHEN** a PDF link carries both `ts`/`te` and `rx`/`ry`/`rw`/`rh`
- **THEN** the system SHALL resolve the rectangle target and ignore the text-selection offsets

### Requirement: Resolve and route `paperland://` PDF targets
When a clicked `paperland://` link resolves to a PDF target, the system SHALL route it to the embedded PDF viewer rather than the Markdown block locator. When the target paper is the current page, it SHALL switch the viewer to the PDF tab and request navigation to the page (and region — a text selection or a rectangle, if any) in‑app without a full navigation. When the target paper differs from the current page, it SHALL navigate to `/papers/<id>` carrying `pdf` (and `ts`/`te`, or `rx`/`ry`/`rw`/`rh`, when present) as route query, and after the paper loads switch to the PDF tab and request the same navigation.

#### Scenario: Click a PDF anchor on the same paper
- **WHEN** the user clicks a `paperland://paper/<id>?pdf=5` link while already on that paper's page
- **THEN** the system SHALL switch the viewer to the PDF tab and scroll the PDF to page 5 without a full page navigation

#### Scenario: Click a PDF selection anchor on another paper
- **WHEN** the user clicks a `paperland://paper/<id>?pdf=5&ts=40&te=120` link whose paper differs from the current page
- **THEN** the system SHALL navigate to `/papers/<id>?pdf=5&ts=40&te=120`, switch to the PDF tab, scroll to page 5, and transiently highlight the region

#### Scenario: Click a PDF rectangle anchor on another paper
- **WHEN** the user clicks a `paperland://paper/<id>?pdf=5&rx=0.1&ry=0.2&rw=0.3&rh=0.15` link whose paper differs from the current page
- **THEN** the system SHALL navigate to `/papers/<id>` carrying `pdf` and the rectangle as route query, switch to the PDF tab, scroll to page 5, and transiently highlight the rectangle

#### Scenario: PDF target takes precedence over a block target
- **WHEN** a link carries both `h` and `pdf` query parameters
- **THEN** the system SHALL route to the PDF viewer and ignore the `h` block target

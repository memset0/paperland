## MODIFIED Requirements

### Requirement: `paperland://` anchor link scheme
The system SHALL support an in-app anchor link scheme `paperland://` that addresses a location in a paper. A target SHALL be a **Markdown block** (optionally a span within it), a **PDF page** (optionally a text selection or a rectangular region within it), or a **Q&A entry** (optionally one of its answers); the target kinds are mutually exclusive within a single link. The link forms SHALL be:
- `paperland://paper/<paperId>` — the paper page only,
- `paperland://paper/<paperId>?h=<content_hash>` — a specific `MarkdownContent` block,
- `paperland://paper/<paperId>?h=<content_hash>&s=<start>&e=<end>` — a span within that block,
- `paperland://paper/<paperId>?pdf=<page>` — a PDF page (1‑based),
- `paperland://paper/<paperId>?pdf=<page>&ts=<start>&te=<end>` — a text selection within that PDF page, where `ts`/`te` are half‑open character offsets into the page's text content,
- `paperland://paper/<paperId>?pdf=<page>&rx=<x>&ry=<y>&rw=<w>&rh=<h>` — a rectangular region within that PDF page, where `rx`,`ry`,`rw`,`rh` are normalized `[0,1]` page‑space coordinates (left, top, width, height),
- `paperland://paper/<paperId>?qa=<entryId>` — a Q&A entry, and `paperland://paper/<paperId>?qa=<entryId>&result=<resultId>` — one answer of that entry. Generated links SHALL include the owning paper id, but a Q&A target SHALL be resolved by `qa` (and `result`) alone, regardless of `<paperId>`.

A position inside a Q&A answer SHALL continue to be addressed with the block form (`h`/`s`/`e`), not combined with `qa`. If a link carries `qa`, it SHALL be treated as a Q&A target and any `h`/`s`/`e`/`pdf` parameters SHALL be ignored.

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

#### Scenario: Parse a Q&A anchor link
- **WHEN** the system processes a link `paperland://paper/7?qa=42&result=99`
- **THEN** it SHALL resolve a Q&A target of entry 42 and answer 99, independent of paper id 7

### Requirement: Intercept anchor links in rendered Markdown
`MarkdownContent` SHALL intercept clicks on rendered links whose href uses the `paperland://` scheme and handle them in-app (navigating via the router when the target paper differs from the current page and invoking the block locator) instead of performing a browser navigation. For a Q&A target it SHALL look up the entry's actual paper, navigate there if it differs from the current page, and reveal the entry (and answer), showing a "not visible" or "deleted" message when the viewer cannot see it. In Q&A answers it SHALL also intercept `#moonlight` links (opening a follow-up pre-filled with the link text) and `#cite:<id>` links (rendered as a citation element when the id is in the paper's references, otherwise as plain text), so neither navigates.

#### Scenario: Click an anchor link on the same paper
- **WHEN** a user clicks a `paperland://paper/<id>?h=<hash>` link while already on that paper's page
- **THEN** the system SHALL locate the addressed block without a full page navigation

#### Scenario: Click an anchor link to another paper
- **WHEN** a user clicks a `paperland://paper/<id>?h=<hash>` link whose paper differs from the current page
- **THEN** the system SHALL navigate to `/papers/<id>` and then locate the addressed block

#### Scenario: Click a Q&A link whose paper id is stale
- **WHEN** a user clicks `paperland://paper/7?qa=42` and entry 42 belongs to paper 9
- **THEN** the system SHALL navigate to `/papers/9` and reveal entry 42

#### Scenario: Click a suggested follow-up
- **WHEN** a user clicks `[💬 question](#moonlight)` in a Q&A answer
- **THEN** the page SHALL NOT navigate and a follow-up on that answer SHALL open pre-filled with the question

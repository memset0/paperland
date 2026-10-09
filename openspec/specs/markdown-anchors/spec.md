# markdown-anchors Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.

## Requirements

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

### Requirement: Content-hash addressable Markdown blocks
Every `MarkdownContent` render SHALL expose its content hash on the rendered container as a `data-content-hash` attribute so that any rendered block (Q&A answer, abstract/FAQ, walkthrough, note preview) can be located by hash.

#### Scenario: Rendered block carries its hash
- **WHEN** a `MarkdownContent` block renders content whose hash is `ab12cd`
- **THEN** its container SHALL carry `data-content-hash="ab12cd"`

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

### Requirement: Locate and reveal a block by content hash
The system SHALL provide `locateBlock(paperId, hash)` that reveals and scrolls to the addressed block, then transiently highlights it (without persisting a `<mark>`). When the block is already mounted in the DOM it SHALL scroll to it directly. When it is not mounted (e.g. inside a collapsed Q&A entry or an inactive answer tab), the system SHALL find the owning Q&A result by recomputing each result answer's hash from the Q&A data, expand that entry, activate that result's tab, and then locate the now-mounted block.

#### Scenario: Locate an already-visible block
- **WHEN** `locateBlock` runs and an element with the matching `data-content-hash` is already in the DOM
- **THEN** the system SHALL scroll to it and transiently highlight it

#### Scenario: Reveal a collapsed Q&A answer
- **WHEN** the addressed hash belongs to a Q&A answer whose entry is collapsed or whose answer tab is inactive
- **THEN** the system SHALL expand the entry, activate that answer's tab, and then scroll to and transiently highlight the block

#### Scenario: Locate disambiguates among multiple answers
- **WHEN** a Q&A question has several answers from different models and the hash matches exactly one answer
- **THEN** the system SHALL reveal that specific answer, independent of answer order or tab state

### Requirement: Graceful handling of stale anchors
When `locateBlock` cannot find any block matching the hash (e.g. the referenced answer was deleted), the system SHALL degrade gracefully: it SHALL NOT navigate to an arbitrary block, SHALL surface a brief "anchor stale" notice, and SHALL leave the note containing the link unchanged.

#### Scenario: Referenced answer was deleted
- **WHEN** an anchor link's hash matches no current block or Q&A answer
- **THEN** the system SHALL show a stale-anchor notice and SHALL NOT jump

#### Scenario: Regeneration does not break an existing anchor
- **WHEN** a Q&A answer is regenerated (a new result row with new text and a new hash is added) while the originally anchored answer still exists
- **THEN** the existing anchor SHALL still resolve to the original answer it referenced

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

### Requirement: Public-note rendering disables block anchors but keeps PDF anchors
`MarkdownContent` SHALL support a **public-note rendering mode**. When that mode is enabled, anchors whose `paperland://` target is a **Markdown block / Q&A target** (a `?h=…` target, i.e. no `?pdf=`) SHALL be rendered **inert** — shown as their plain link text and not actionable (no `locateBlock` invocation) — because such a target resolves against the *current viewer's* Q&A and cannot address the note author's Q&A. Anchors whose target is a **PDF target** (`?pdf=…`, including text-selection or rectangle sub-targets) SHALL remain actionable and SHALL continue to route to the embedded PDF viewer. The block-vs-PDF classification SHALL use the same `paperland://` parsing as normal interception (where `pdf` takes precedence over `h`). Outside this mode, anchor behavior SHALL be unchanged.

#### Scenario: Block anchor is inert in public-note mode
- **WHEN** `MarkdownContent` renders in public-note mode and the content contains a `paperland://paper/<id>?h=<hash>` link
- **THEN** the link SHALL appear as plain text and clicking it SHALL NOT invoke the block locator

#### Scenario: PDF anchor stays actionable in public-note mode
- **WHEN** `MarkdownContent` renders in public-note mode and the content contains a `paperland://paper/<id>?pdf=<page>` link
- **THEN** the link SHALL remain clickable and route to the embedded PDF viewer

#### Scenario: Normal rendering is unaffected
- **WHEN** `MarkdownContent` renders without public-note mode
- **THEN** both block and PDF anchors SHALL behave as before (block anchors invoke the locator, PDF anchors route to the viewer)

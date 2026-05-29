# markdown-anchors Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
### Requirement: `paperland://` anchor link scheme
The system SHALL support an in-app anchor link scheme `paperland://` that addresses a location in a paper, optionally a specific rendered text block and an optional range within it. The link forms SHALL be:
- `paperland://paper/<paperId>` — the paper page only,
- `paperland://paper/<paperId>?h=<content_hash>` — a specific `MarkdownContent` block,
- `paperland://paper/<paperId>?h=<content_hash>&s=<start>&e=<end>` — a span within that block.

The block SHALL be identified by its `content_hash` (the same MD5-of-whitespace-stripped-content hash used by highlights), NOT by any Q&A entry or result id or index. Anchor links MAY appear inline anywhere in note bodies (or any other Markdown content) and a single document MAY contain multiple anchor links.

#### Scenario: Parse a block-level anchor link
- **WHEN** the system processes a link `paperland://paper/123?h=ab12cd`
- **THEN** it SHALL resolve a target of paper id 123 and content hash `ab12cd` with no offset range

#### Scenario: Parse a page-only anchor link
- **WHEN** the system processes a link `paperland://paper/123` with no query
- **THEN** it SHALL resolve a target of paper id 123 with no block and no range

#### Scenario: Offsets are optional
- **WHEN** an anchor link omits `s` and `e`
- **THEN** the target SHALL be treated as the whole block (no within-block range)

### Requirement: Content-hash addressable Markdown blocks
Every `MarkdownContent` render SHALL expose its content hash on the rendered container as a `data-content-hash` attribute so that any rendered block (Q&A answer, abstract/FAQ, walkthrough, note preview) can be located by hash.

#### Scenario: Rendered block carries its hash
- **WHEN** a `MarkdownContent` block renders content whose hash is `ab12cd`
- **THEN** its container SHALL carry `data-content-hash="ab12cd"`

### Requirement: Intercept anchor links in rendered Markdown
`MarkdownContent` SHALL intercept clicks on rendered links whose href uses the `paperland://` scheme and handle them in-app (navigating via the router when the target paper differs from the current page and invoking the block locator) instead of performing a browser navigation.

#### Scenario: Click an anchor link on the same paper
- **WHEN** a user clicks a `paperland://paper/<id>?h=<hash>` link while already on that paper's page
- **THEN** the system SHALL locate the addressed block without a full page navigation

#### Scenario: Click an anchor link to another paper
- **WHEN** a user clicks a `paperland://paper/<id>?h=<hash>` link whose paper differs from the current page
- **THEN** the system SHALL navigate to `/papers/<id>` and then locate the addressed block

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


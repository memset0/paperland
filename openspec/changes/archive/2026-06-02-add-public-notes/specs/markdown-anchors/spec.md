## ADDED Requirements

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

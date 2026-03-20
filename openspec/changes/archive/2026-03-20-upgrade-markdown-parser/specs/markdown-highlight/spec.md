## MODIFIED Requirements

### Requirement: Highlight rendering via DOM text node traversal
The system SHALL render highlights by traversing DOM text nodes after markdown rendering and wrapping matched offset ranges with `<mark>` elements. The highlight system SHALL remain parser-agnostic — it operates on the rendered DOM tree, not the markdown parser's AST, and SHALL work correctly with any markdown renderer that produces valid HTML with KaTeX elements carrying `.katex` / `.katex-display` CSS classes.

#### Scenario: Single paragraph highlight
- **WHEN** a highlight with start_offset=10, end_offset=25 exists
- **THEN** the system SHALL find the text nodes covering offsets 10-25 and wrap them in `<mark>` elements with the appropriate color class and `data-highlight-id`

#### Scenario: Cross-paragraph highlight
- **WHEN** a highlight spans text across multiple block elements (e.g., two paragraphs)
- **THEN** the system SHALL split the highlight into multiple `<mark>` segments (one per text node in range), all sharing the same `data-highlight-id`

#### Scenario: Offset verification
- **WHEN** the text at the stored offset does not match the stored `text` field
- **THEN** the system SHALL silently skip rendering that highlight (graceful degradation)

#### Scenario: Parser change does not break highlights
- **WHEN** the markdown parser is changed from `marked` to `markdown-it`
- **THEN** existing highlights SHALL continue to render correctly because the highlight system matches on rendered `textContent` offsets, not on HTML structure

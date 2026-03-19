## ADDED Requirements

### Requirement: KaTeX elements treated as atomic units during highlighting
The system SHALL treat each KaTeX-rendered element (`.katex`, `.katex-display`) as an atomic text unit when computing text offsets for highlighting. If a highlight boundary falls inside a KaTeX element, the highlight SHALL automatically expand to cover the entire formula.

#### Scenario: Highlight partially overlaps inline math
- **WHEN** a user's text selection starts before an inline math formula and ends in the middle of it
- **THEN** the highlight SHALL automatically expand to include the entire math formula

#### Scenario: Highlight entirely within math formula
- **WHEN** a user selects text that falls entirely within a KaTeX-rendered formula
- **THEN** the entire formula element SHALL be highlighted as a single unit

#### Scenario: Text offset calculation skips KaTeX internals
- **WHEN** computing rendered text offsets for a highlight
- **THEN** each KaTeX element SHALL contribute its `textContent` length as a single offset span, without traversing into its internal DOM nodes

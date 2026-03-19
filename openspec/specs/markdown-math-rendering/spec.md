### Requirement: Inline math rendering with dollar signs
The system SHALL render text enclosed in single dollar signs (`$...$`) as inline math formulas using KaTeX.

#### Scenario: Simple inline math
- **WHEN** markdown content contains `The equation $E=mc^2$ is famous`
- **THEN** the text "E=mc^2" SHALL be rendered as a formatted inline math formula within the surrounding text

#### Scenario: Dollar sign not treated as math when followed by space
- **WHEN** markdown content contains `The price is $ 100`
- **THEN** the dollar sign SHALL be rendered as literal text, not as a math delimiter

### Requirement: Display math rendering with double dollar signs
The system SHALL render text enclosed in double dollar signs (`$$...$$`) as display (block) math formulas using KaTeX.

#### Scenario: Display math block
- **WHEN** markdown content contains `$$\int_0^1 f(x)\,dx$$`
- **THEN** the integral expression SHALL be rendered as a centered, display-style math block

#### Scenario: Multi-line display math
- **WHEN** markdown content contains a `$$...$$` block spanning multiple lines
- **THEN** the entire block SHALL be rendered as a single display math formula

### Requirement: Inline math rendering with backslash-parenthesis
The system SHALL render text enclosed in `\(...\)` as inline math formulas using KaTeX.

#### Scenario: Backslash-parenthesis inline math
- **WHEN** markdown content contains `The value \(\alpha + \beta\) is positive`
- **THEN** the Greek letters alpha and beta SHALL be rendered as formatted inline math

### Requirement: Display math rendering with backslash-bracket
The system SHALL render text enclosed in `\[...\]` as display (block) math formulas using KaTeX.

#### Scenario: Backslash-bracket display math
- **WHEN** markdown content contains `\[\sum_{i=1}^{n} x_i = S\]`
- **THEN** the summation SHALL be rendered as a centered, display-style math block

### Requirement: Math inside code blocks is not rendered
The system SHALL NOT process math delimiters that appear inside inline code or fenced code blocks.

#### Scenario: Dollar signs in code block
- **WHEN** markdown content contains `` `$x^2$` `` (inline code)
- **THEN** the text `$x^2$` SHALL be rendered as literal code, not as math

### Requirement: Graceful handling of invalid LaTeX
The system SHALL render invalid or unsupported LaTeX commands as raw source text rather than throwing errors or displaying nothing.

#### Scenario: Unsupported LaTeX command
- **WHEN** markdown content contains `$\unsupportedcommand{x}$`
- **THEN** the raw text SHALL be displayed (not an error message or blank output)

### Requirement: List bullet points are visible
The system SHALL render unordered list items with visible bullet markers (disc) and ordered list items with visible numeric markers (decimal).

#### Scenario: Unordered list bullets
- **WHEN** markdown content contains a `- item` or `* item` list
- **THEN** each list item SHALL display with a disc bullet marker

#### Scenario: Ordered list numbers
- **WHEN** markdown content contains a `1. item` list
- **THEN** each list item SHALL display with a decimal number marker

#### Scenario: Nested list indentation
- **WHEN** markdown content contains nested lists
- **THEN** nested items SHALL be indented and display appropriate sub-list markers

### Requirement: KaTeX CSS is loaded
The system SHALL include the KaTeX stylesheet so that math formulas render with correct fonts and spacing.

#### Scenario: Math formula typography
- **WHEN** any math formula is rendered
- **THEN** the formula SHALL use KaTeX's math fonts (not the page's body font)

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

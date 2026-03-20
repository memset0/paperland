## MODIFIED Requirements

### Requirement: Inline math rendering with dollar signs
The system SHALL render text enclosed in single dollar signs (`$...$`) as inline math formulas using KaTeX, via the `markdown-it` KaTeX plugin (`@traptitech/markdown-it-katex`).

#### Scenario: Simple inline math
- **WHEN** markdown content contains `The equation $E=mc^2$ is famous`
- **THEN** the text "E=mc^2" SHALL be rendered as a formatted inline math formula within the surrounding text

#### Scenario: Dollar sign not treated as math when followed by space
- **WHEN** markdown content contains `The price is $ 100`
- **THEN** the dollar sign SHALL be rendered as literal text, not as a math delimiter

### Requirement: Display math rendering with double dollar signs
The system SHALL render text enclosed in double dollar signs (`$$...$$`) as display (block) math formulas using KaTeX, via the `markdown-it` KaTeX plugin.

#### Scenario: Display math block
- **WHEN** markdown content contains `$$\int_0^1 f(x)\,dx$$`
- **THEN** the integral expression SHALL be rendered as a centered, display-style math block

#### Scenario: Multi-line display math
- **WHEN** markdown content contains a `$$...$$` block spanning multiple lines
- **THEN** the entire block SHALL be rendered as a single display math formula

### Requirement: Inline math rendering with backslash-parenthesis
The system SHALL render text enclosed in `\(...\)` as inline math formulas using KaTeX, natively handled by the `markdown-it` KaTeX plugin without manual delimiter conversion.

#### Scenario: Backslash-parenthesis inline math
- **WHEN** markdown content contains `The value \(\alpha + \beta\) is positive`
- **THEN** the Greek letters alpha and beta SHALL be rendered as formatted inline math

#### Scenario: No preprocessing required
- **WHEN** markdown content contains `\(...\)` delimiters
- **THEN** the `markdown-it` KaTeX plugin SHALL handle them directly during tokenization, without any regex-based delimiter normalization

### Requirement: Display math rendering with backslash-bracket
The system SHALL render text enclosed in `\[...\]` as display (block) math formulas using KaTeX, natively handled by the `markdown-it` KaTeX plugin without manual delimiter conversion.

#### Scenario: Backslash-bracket display math
- **WHEN** markdown content contains `\[\sum_{i=1}^{n} x_i = S\]`
- **THEN** the summation SHALL be rendered as a centered, display-style math block

### Requirement: Math inside code blocks is not rendered
The system SHALL NOT process math delimiters that appear inside inline code or fenced code blocks. This SHALL be handled natively by the `markdown-it` tokenizer (math plugin only processes tokens outside code spans/blocks).

#### Scenario: Dollar signs in code block
- **WHEN** markdown content contains `` `$x^2$` `` (inline code)
- **THEN** the text `$x^2$` SHALL be rendered as literal code, not as math

#### Scenario: Math delimiters in fenced code block
- **WHEN** markdown content contains `\(\alpha\)` or `$$formula$$` inside a fenced code block
- **THEN** the delimiters SHALL be rendered as literal text, not as math

### Requirement: Graceful handling of invalid LaTeX
The system SHALL render invalid or unsupported LaTeX commands as raw source text rather than throwing errors or displaying nothing. The KaTeX plugin SHALL be configured with `throwOnError: false`.

#### Scenario: Unsupported LaTeX command
- **WHEN** markdown content contains `$\unsupportedcommand{x}$`
- **THEN** the raw text SHALL be displayed (not an error message or blank output)

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

## ADDED Requirements

### Requirement: Click math formula to copy LaTeX source
The system SHALL copy the LaTeX source code of a math formula to the clipboard when the user clicks on it, and display a toast notification confirming the copy.

#### Scenario: Click inline math to copy
- **WHEN** the user clicks on an inline math formula (e.g., rendered from `$E=mc^2$`)
- **THEN** the LaTeX source text `E=mc^2` SHALL be copied to the clipboard
- **AND** a toast notification "LaTeX 已复制到剪贴板" SHALL appear at the bottom center of the screen

#### Scenario: Click display math to copy
- **WHEN** the user clicks on a display math formula (e.g., rendered from `$$\int_0^1 f(x)\,dx$$`)
- **THEN** the LaTeX source text `\int_0^1 f(x)\,dx` SHALL be copied to the clipboard
- **AND** a toast notification SHALL appear at the bottom center of the screen

#### Scenario: Toast auto-dismiss
- **WHEN** the toast notification is shown
- **THEN** it SHALL automatically disappear after 2 seconds with a fade-out animation

#### Scenario: Click does not interfere with text selection
- **WHEN** the user is selecting text that spans across a math formula (for highlighting)
- **THEN** the click-to-copy SHALL NOT be triggered

#### Scenario: Math formula hover hint
- **WHEN** the user hovers over a math formula
- **THEN** the formula SHALL display a subtle background color and pointer cursor to indicate it is clickable

## REMOVED Requirements

### Requirement: Manual delimiter normalization
**Reason**: The `normalizeDelimiters()` function that converted `\(...\)` to `$...$` and `\[...\]` to `$$...$$` via regex is no longer needed. The `markdown-it` KaTeX plugin handles all four delimiter styles natively during tokenization, which is more reliable and correctly handles edge cases (delimiters in code blocks, nested structures).
**Migration**: Remove the `normalizeDelimiters()` function from `MarkdownContent.vue`. No other code references it.

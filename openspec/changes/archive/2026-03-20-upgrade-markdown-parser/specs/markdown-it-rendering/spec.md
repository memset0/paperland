## ADDED Requirements

### Requirement: Markdown rendering via markdown-it
The system SHALL use `markdown-it` as the markdown rendering engine in the `MarkdownContent` component, replacing `marked`.

#### Scenario: Basic markdown rendering
- **WHEN** markdown content containing headings, paragraphs, bold, italic, links, and images is passed to `MarkdownContent`
- **THEN** the content SHALL be rendered as correctly structured HTML

#### Scenario: Render call interface
- **WHEN** the `MarkdownContent` component renders content
- **THEN** it SHALL call `md.render(content)` on a pre-configured `markdown-it` instance and set the result as `innerHTML`

### Requirement: GFM table support
The system SHALL render GitHub Flavored Markdown tables with proper structure and styling.

#### Scenario: Pipe-delimited table
- **WHEN** markdown content contains a GFM table with header row, separator row, and data rows
- **THEN** the table SHALL be rendered as an HTML `<table>` with `<thead>`, `<tbody>`, `<th>`, and `<td>` elements

#### Scenario: Table cell alignment
- **WHEN** a GFM table uses `:---`, `:---:`, or `---:` alignment markers
- **THEN** the corresponding cells SHALL be aligned left, center, or right respectively

### Requirement: GFM strikethrough support
The system SHALL render `~~text~~` as strikethrough text.

#### Scenario: Strikethrough text
- **WHEN** markdown content contains `~~deleted text~~`
- **THEN** the text SHALL be rendered with a strikethrough style (e.g., `<s>` or `<del>` element)

### Requirement: GFM task list support
The system SHALL render `- [ ]` and `- [x]` as task list checkboxes.

#### Scenario: Unchecked task item
- **WHEN** markdown content contains `- [ ] todo item`
- **THEN** the item SHALL be rendered with an unchecked checkbox

#### Scenario: Checked task item
- **WHEN** markdown content contains `- [x] done item`
- **THEN** the item SHALL be rendered with a checked checkbox

### Requirement: Soft line breaks
The system SHALL treat single newlines within a paragraph as `<br>` elements (breaks mode enabled).

#### Scenario: Single newline becomes line break
- **WHEN** markdown content contains `line one\nline two` (single newline, not double)
- **THEN** a `<br>` element SHALL be inserted between the two lines

### Requirement: Link auto-detection
The system SHALL automatically detect and linkify bare URLs in markdown content.

#### Scenario: Bare URL auto-linking
- **WHEN** markdown content contains `Visit https://example.com for details`
- **THEN** `https://example.com` SHALL be rendered as a clickable `<a>` element

### Requirement: Fenced code block rendering
The system SHALL render fenced code blocks (triple backticks) with language class annotation.

#### Scenario: Code block with language
- **WHEN** markdown content contains a fenced code block with ` ```python `
- **THEN** the code SHALL be rendered in a `<pre><code class="language-python">` block

#### Scenario: Code block without language
- **WHEN** markdown content contains a fenced code block without a language specifier
- **THEN** the code SHALL be rendered in a plain `<pre><code>` block

### Requirement: Singleton parser instance
The `markdown-it` instance SHALL be created and configured once at module level, not recreated on each render.

#### Scenario: Parser reuse across renders
- **WHEN** the `MarkdownContent` component re-renders with new content
- **THEN** it SHALL reuse the same `markdown-it` instance created at module initialization

### Requirement: No raw HTML passthrough
The system SHALL NOT allow raw HTML in markdown content to prevent XSS.

#### Scenario: HTML tags in markdown
- **WHEN** markdown content contains `<script>alert('xss')</script>`
- **THEN** the HTML SHALL be escaped and displayed as literal text, not executed

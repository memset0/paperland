## MODIFIED Requirements

### Requirement: Copy an anchor link from a selection
The selection floating toolbar (the same one offering highlight colors) SHALL provide **two** copy actions for authenticated users:

1. **Copy content + anchor link** (icon: the conventional `Copy` glyph). Choosing it SHALL place on the clipboard the **full selected content converted back to Markdown**, immediately followed by a compact anchor link of the form `[#](paperland://paper/<id>?h=<content_hash>&s=<start>&e=<end>)` that addresses the selection (paper id + the block's `content_hash` + the selection's rendered `start`/`end` offsets). The copied content SHALL be the complete selection — NOT a truncated label and NOT the render-stripped plain text.
2. **Copy anchor link only** (icon: `Link2`). Choosing it SHALL place on the clipboard **only** the positioning link — no selected content — as a compact Markdown link `[#](paperland://paper/<id>?h=<content_hash>&s=<start>&e=<end>)` (a plain link, NOT an image — no leading `!`). The link target and `[#]` link form SHALL be identical to the one emitted by the content + anchor link action; the only difference is that this action omits the preceding selected content.

Each action SHALL show a distinct success toast (e.g. content + link → "已复制内容和锚点链接"; link only → "已复制锚点链接"). Both actions SHALL clear the current selection and dismiss the toolbar after copying.

For the **content + anchor link** action, the Markdown conversion SHALL behave as follows:
- Math SHALL be reconstructed exactly from each KaTeX element's `x-tex` annotation and emitted using dollar delimiters — `$…$` for inline math and `$$…$$` for display math — never the visually rendered glyphs. The reconstructed LaTeX SHALL NOT be corrupted by Markdown escaping. Display math SHALL place its `$$` fences on their own lines (a newline before the opening `$$` and after the closing `$$`) so it re-parses as a block; inline math SHALL stay in place within its line.
- A fully selected rendered table SHALL be emitted as a GFM pipe table.
- Other inline and block formatting (bold, italics, inline code, code blocks, lists, blockquotes, links) SHALL be preserved as Markdown.

(See the `markdown-anchors` capability for the link scheme.)

#### Scenario: Copy a Q&A answer selection as Markdown plus anchor
- **WHEN** an authenticated user selects text within a Q&A answer (containing, e.g., bold text and inline math) and chooses the content + anchor link action (the `Copy` icon)
- **THEN** the clipboard SHALL contain that selection rendered as Markdown (bold as `**…**`, inline math as `$…$`) followed by a trailing `[#](paperland://paper/<id>?h=<content_hash>&s=<start>&e=<end>)` link addressing the selection

#### Scenario: Copy anchor link only
- **WHEN** an authenticated user selects text and chooses the link-only action (the `Link2` icon)
- **THEN** the clipboard SHALL contain exactly `[#](paperland://paper/<id>?h=<content_hash>&s=<start>&e=<end>)` (a plain link, no leading `!`) and SHALL NOT contain any of the selected content

#### Scenario: Both actions address the same location
- **WHEN** a user copies content + link and then copies link-only for the same unchanged selection
- **THEN** the `paperland://…` URL inside both clipboard results SHALL be identical (same paper id, `content_hash`, `s`, and `e`)

#### Scenario: Math is copied with dollar delimiters
- **WHEN** a selection includes inline or display math and the content + anchor link action is chosen
- **THEN** the copied Markdown SHALL contain the original LaTeX, taken from the KaTeX `x-tex` annotation and SHALL NOT contain the rendered math glyphs, with inline math wrapped as `$…$` in place and display math emitted with its `$$` fences on their own lines (newline before the opening and after the closing `$$`)

#### Scenario: Math containing Markdown-significant characters is not escaped
- **WHEN** a selection includes math whose LaTeX contains characters like `_`, `*`, or `\` (e.g. `x_i`) and the content + anchor link action is chosen
- **THEN** the copied Markdown SHALL reproduce the LaTeX verbatim inside the dollar delimiters (e.g. `$x_i$`, not `$x\_i$`)

#### Scenario: A whole table is copied as a GFM table
- **WHEN** the selection covers an entire rendered table and the content + anchor link action is chosen
- **THEN** the copied Markdown SHALL be a GFM pipe table

#### Scenario: Pasted content is clickable in a note
- **WHEN** the content + anchor link result is pasted into a note body and the note is previewed
- **THEN** the `[#]` anchor link SHALL be clickable and SHALL locate the addressed block per the `markdown-anchors` capability

#### Scenario: Both actions hidden for anonymous users
- **WHEN** an anonymous visitor selects text
- **THEN** the toolbar SHALL NOT offer either copy action (both require login, consistent with other selection actions)

### Requirement: Text selection creates highlight
The system SHALL display a floating toolbar when text is selected within a MarkdownContent component, allowing the user to choose a highlight color. The toolbar SHALL NOT offer a note input. On both desktop and mobile (touch) devices, the system SHALL detect text selection completion via the `selectionchange` event with debouncing, and display the toolbar near the selection.

#### Scenario: Select text and highlight on desktop
- **WHEN** a user selects text within a rendered MarkdownContent component using mouse
- **THEN** a floating toolbar SHALL appear near the selection (below the selected text) with 4 color buttons (yellow, green, blue, pink) within 100ms of selection stabilizing
- **WHEN** the user clicks a color button
- **THEN** the selected text SHALL be highlighted with that color, and a POST request SHALL be sent to create the highlight

#### Scenario: Select text and highlight on mobile (touch device)
- **WHEN** a user selects text within a rendered MarkdownContent component using touch (including Android selection handles)
- **THEN** a floating toolbar SHALL appear near the selection with 4 color buttons (yellow, green, blue, pink) after the selection stabilizes (within 300ms debounce)
- **WHEN** the user taps a color button
- **THEN** the selected text SHALL be highlighted with that color, and a POST request SHALL be sent to create the highlight

#### Scenario: Toolbar has no note input
- **WHEN** the selection toolbar is showing
- **THEN** it SHALL present only color buttons and the two copy actions (content + anchor link, and link-only), and SHALL NOT present any "add note" toggle or text input

#### Scenario: Selection cleared before highlight
- **WHEN** a user selects text and the toolbar is showing, then the selection is cleared (by tapping elsewhere or by the system)
- **THEN** the toolbar SHALL be hidden automatically via `selectionchange` detection

#### Scenario: Toolbar viewport boundary clamping
- **WHEN** the selection is near the edge of the screen (especially on narrow mobile viewports)
- **THEN** the toolbar position SHALL be clamped to remain fully visible within the container bounds

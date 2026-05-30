## MODIFIED Requirements

### Requirement: Highlight data model
The system SHALL store highlights in a `highlights` table with fields: `id`, `user_id`, `pathname`, `content_hash`, `start_offset`, `end_offset`, `text`, `color`, `created_at`. The `user_id` SHALL reference `users.id` and identify the owner of the highlight. A highlight SHALL carry only a color; the system SHALL NOT read or write any per-highlight note. A legacy `note` column MAY remain physically present in the database for historical rows, but the active Drizzle schema and all queries SHALL ignore it.

#### Scenario: Highlight record structure
- **WHEN** a highlight is created
- **THEN** the record SHALL contain `user_id` (owner), `pathname` (page path without hostname), `content_hash` (MD5 of content with all whitespace removed), `start_offset` and `end_offset` (rendered text offsets), `text` (highlighted text for verification), `color` (one of yellow/green/blue/pink), and `created_at` timestamp, and SHALL NOT contain a `note`

#### Scenario: Legacy note column is ignored
- **WHEN** the `highlights` table still has a physical `note` column populated on historical rows
- **THEN** the active schema SHALL NOT select, return, or update that column, and reading a highlight SHALL never surface a note

### Requirement: Create highlight
The system SHALL provide `POST /api/highlights` to create a new highlight record owned by the current authenticated user. The request body SHALL carry `{ pathname, content_hash, start_offset, end_offset, text, color }` and SHALL NOT carry a note. Anonymous requests SHALL be rejected with 401.

#### Scenario: Create highlight
- **WHEN** an authenticated user sends a POST request with `{ pathname, content_hash, start_offset, end_offset, text, color }`
- **THEN** the system SHALL create the highlight record with `user_id` set to that user and return it with the assigned `id` and `created_at`

#### Scenario: Note field in request is ignored
- **WHEN** a POST request body includes a `note` field (e.g. from a stale client)
- **THEN** the system SHALL ignore it and SHALL NOT persist any note

#### Scenario: Anonymous create rejected
- **WHEN** an anonymous client sends `POST /api/highlights`
- **THEN** the system SHALL respond with 401 and create nothing

### Requirement: Update highlight
The system SHALL provide `PUT /api/highlights/:id` to update a highlight's color, only when the highlight belongs to the current authenticated user. The endpoint SHALL NOT update any note.

#### Scenario: Update highlight color
- **WHEN** the owner sends a PUT request with `{ color: "green" }`
- **THEN** the highlight's color SHALL be updated to green

#### Scenario: Note field in update is ignored
- **WHEN** the owner sends a PUT request that includes a `note` field
- **THEN** the system SHALL ignore the note and update only recognized fields (e.g. `color`)

#### Scenario: Update another user's highlight rejected
- **WHEN** a user sends `PUT /api/highlights/:id` for a highlight owned by a different user (or is anonymous)
- **THEN** the system SHALL respond 404 (not owner) or 401 (anonymous) and SHALL NOT modify it

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
- **THEN** it SHALL present only color buttons and the copy-anchor action, and SHALL NOT present any "add note" toggle or text input

#### Scenario: Selection cleared before highlight
- **WHEN** a user selects text and the toolbar is showing, then the selection is cleared (by tapping elsewhere or by the system)
- **THEN** the toolbar SHALL be hidden automatically via `selectionchange` detection

#### Scenario: Toolbar viewport boundary clamping
- **WHEN** the selection is near the edge of the screen (especially on narrow mobile viewports)
- **THEN** the toolbar position SHALL be clamped to remain fully visible within the container bounds

### Requirement: Highlight interaction — click menu
The system SHALL display a context menu when the user clicks or taps on a highlighted text, with options to change color and delete. The menu SHALL NOT offer a note-editing option.

#### Scenario: Click highlight to edit on desktop
- **WHEN** the user clicks on a highlighted `<mark>` element on desktop
- **THEN** a popover menu SHALL appear with options: change color (4 colors) and delete

#### Scenario: Tap highlight to edit on touch device
- **WHEN** the user taps on a highlighted `<mark>` element on a touch device
- **THEN** a popover menu SHALL appear with options: change color (4 colors) and delete
- **AND** the menu SHALL be positioned to remain fully visible within the viewport

#### Scenario: Delete highlight from menu
- **WHEN** the user clicks/taps "delete" in the highlight context menu
- **THEN** the highlight SHALL be removed from the DOM and a DELETE request SHALL be sent to the backend

### Requirement: Copy an anchor link from a selection
The selection floating toolbar (the same one offering highlight colors) SHALL include a "复制为锚点链接" (copy anchor link) action for authenticated users. Choosing it SHALL place on the clipboard the **full selected content converted back to Markdown**, immediately followed by a compact anchor link of the form `[#](paperland://paper/<id>?h=<content_hash>&s=<start>&e=<end>)` that addresses the selection (paper id + the block's `content_hash` + the selection's rendered `start`/`end` offsets). The copied content SHALL be the complete selection — NOT a truncated label and NOT the render-stripped plain text.

- Math SHALL be reconstructed exactly from each KaTeX element's `x-tex` annotation and emitted using dollar delimiters — `$…$` for inline math and `$$…$$` for display math — never the visually rendered glyphs. The reconstructed LaTeX SHALL NOT be corrupted by Markdown escaping. Display math SHALL place its `$$` fences on their own lines (a newline before the opening `$$` and after the closing `$$`) so it re-parses as a block; inline math SHALL stay in place within its line.
- A fully selected rendered table SHALL be emitted as a GFM pipe table.
- Other inline and block formatting (bold, italics, inline code, code blocks, lists, blockquotes, links) SHALL be preserved as Markdown.

(See the `markdown-anchors` capability for the link scheme.)

#### Scenario: Copy a Q&A answer selection as Markdown plus anchor
- **WHEN** an authenticated user selects text within a Q&A answer (containing, e.g., bold text and inline math) and chooses "复制为锚点链接"
- **THEN** the clipboard SHALL contain that selection rendered as Markdown (bold as `**…**`, inline math as `$…$`) followed by a trailing `[#](paperland://paper/<id>?h=<content_hash>&s=<start>&e=<end>)` link addressing the selection

#### Scenario: Math is copied with dollar delimiters
- **WHEN** a selection includes inline or display math
- **THEN** the copied Markdown SHALL contain the original LaTeX, taken from the KaTeX `x-tex` annotation and SHALL NOT contain the rendered math glyphs, with inline math wrapped as `$…$` in place and display math emitted with its `$$` fences on their own lines (newline before the opening and after the closing `$$`)

#### Scenario: Math containing Markdown-significant characters is not escaped
- **WHEN** a selection includes math whose LaTeX contains characters like `_`, `*`, or `\` (e.g. `x_i`)
- **THEN** the copied Markdown SHALL reproduce the LaTeX verbatim inside the dollar delimiters (e.g. `$x_i$`, not `$x\_i$`)

#### Scenario: A whole table is copied as a GFM table
- **WHEN** the selection covers an entire rendered table
- **THEN** the copied Markdown SHALL be a GFM pipe table

#### Scenario: Pasted content is clickable in a note
- **WHEN** the copied text is pasted into a note body and the note is previewed
- **THEN** the `[#]` anchor link SHALL be clickable and SHALL locate the addressed block per the `markdown-anchors` capability

#### Scenario: Action hidden for anonymous users
- **WHEN** an anonymous visitor selects text
- **THEN** the toolbar SHALL NOT offer "复制为锚点链接" (it requires login, consistent with other selection actions)

## REMOVED Requirements

### Requirement: Highlight interaction — hover tooltip
**Reason**: Highlights are now color-only; with per-highlight notes removed there is nothing to show on hover. Per-paper annotation is now handled by the dedicated notes system.
**Migration**: Use the standalone notes system (`paper-notes`) for any per-paper notes. Existing highlight `note` data is left in the database but is no longer read or displayed.

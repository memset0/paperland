## ADDED Requirements

### Requirement: Highlight data model
The system SHALL store highlights in a `highlights` table with fields: `id`, `pathname`, `content_hash`, `start_offset`, `end_offset`, `text`, `color`, `note`, `created_at`.

#### Scenario: Highlight record structure
- **WHEN** a highlight is created
- **THEN** the record SHALL contain `pathname` (page path without hostname), `content_hash` (MD5 of content with all whitespace removed), `start_offset` and `end_offset` (rendered text offsets), `text` (highlighted text for verification), `color` (one of yellow/green/blue/pink), `note` (nullable), and `created_at` timestamp

### Requirement: Batch query highlights by pathname
The system SHALL provide `GET /api/highlights?pathname=<path>` that returns all highlights for the given page path in a single request.

#### Scenario: Load all highlights for a page
- **WHEN** a page loads at pathname `/papers/42`
- **THEN** a single `GET /api/highlights?pathname=/papers/42` request SHALL return all highlights for that page, across all content_hash values

#### Scenario: No highlights for page
- **WHEN** `GET /api/highlights?pathname=/papers/42` is called and no highlights exist
- **THEN** the response SHALL return `{ "data": [] }`

### Requirement: Create highlight
The system SHALL provide `POST /api/highlights` to create a new highlight record.

#### Scenario: Create highlight with note
- **WHEN** a POST request is sent with `{ pathname, content_hash, start_offset, end_offset, text, color, note }`
- **THEN** the system SHALL create the highlight record and return it with the assigned `id` and `created_at`

#### Scenario: Create highlight without note
- **WHEN** a POST request is sent with `note` as null
- **THEN** the system SHALL create the highlight record with note as null

### Requirement: Update highlight
The system SHALL provide `PUT /api/highlights/:id` to update a highlight's color or note.

#### Scenario: Update highlight color
- **WHEN** a PUT request is sent with `{ color: "green" }`
- **THEN** the highlight's color SHALL be updated to green

#### Scenario: Update highlight note
- **WHEN** a PUT request is sent with `{ note: "important finding" }`
- **THEN** the highlight's note SHALL be updated

### Requirement: Delete highlight
The system SHALL provide `DELETE /api/highlights/:id` to delete a highlight.

#### Scenario: Delete existing highlight
- **WHEN** a DELETE request is sent for an existing highlight ID
- **THEN** the highlight record SHALL be removed and the corresponding `<mark>` element SHALL be removed from the DOM

### Requirement: Text selection creates highlight
The system SHALL display a floating toolbar when text is selected within a MarkdownContent component, allowing the user to choose a highlight color and optionally add a note.

#### Scenario: Select text and highlight
- **WHEN** a user selects text within a rendered MarkdownContent component
- **THEN** a floating toolbar SHALL appear near the selection with 4 color buttons (yellow, green, blue, pink)
- **WHEN** the user clicks a color button
- **THEN** the selected text SHALL be highlighted with that color, and a POST request SHALL be sent to create the highlight

#### Scenario: Select text and add note
- **WHEN** a user selects text and the toolbar is showing
- **THEN** the toolbar SHALL include an option to add a text note before confirming the highlight

### Requirement: Highlight rendering via DOM text node traversal
The system SHALL render highlights by traversing DOM text nodes after markdown rendering and wrapping matched offset ranges with `<mark>` elements.

#### Scenario: Single paragraph highlight
- **WHEN** a highlight with start_offset=10, end_offset=25 exists
- **THEN** the system SHALL find the text nodes covering offsets 10-25 and wrap them in `<mark>` elements with the appropriate color class and `data-highlight-id`

#### Scenario: Cross-paragraph highlight
- **WHEN** a highlight spans text across multiple block elements (e.g., two paragraphs)
- **THEN** the system SHALL split the highlight into multiple `<mark>` segments (one per text node in range), all sharing the same `data-highlight-id`

#### Scenario: Offset verification
- **WHEN** the text at the stored offset does not match the stored `text` field
- **THEN** the system SHALL silently skip rendering that highlight (graceful degradation)

### Requirement: Highlight interaction — hover tooltip
The system SHALL display a tooltip with the highlight's note content when the user hovers over a highlighted text.

#### Scenario: Hover highlight with note
- **WHEN** the user hovers over a `<mark>` element that has a note
- **THEN** a tooltip SHALL appear showing the note text

#### Scenario: Hover highlight without note
- **WHEN** the user hovers over a `<mark>` element that has no note
- **THEN** no tooltip SHALL appear

### Requirement: Highlight interaction — click menu
The system SHALL display a context menu when the user clicks on a highlighted text, with options to edit note, change color, and delete.

#### Scenario: Click highlight to edit
- **WHEN** the user clicks on a highlighted `<mark>` element
- **THEN** a popover menu SHALL appear with options: edit note, change color (4 colors), delete

#### Scenario: Delete highlight from menu
- **WHEN** the user clicks "delete" in the highlight context menu
- **THEN** the highlight SHALL be removed from the DOM and a DELETE request SHALL be sent to the backend

### Requirement: Empty content protection
The system SHALL prevent highlight creation on empty MarkdownContent and display an error alert.

#### Scenario: Attempt to highlight empty content
- **WHEN** a MarkdownContent component has an empty content prop and the user attempts to select text
- **THEN** the system SHALL display an error alert indicating the content is empty and highlight creation is not possible

### Requirement: Content hash computation
The system SHALL compute content_hash as the MD5 hash of the markdown content string with all whitespace characters removed.

#### Scenario: Hash computation
- **WHEN** markdown content is `"Hello **world**\n\nNew paragraph"`
- **THEN** the content_hash SHALL be MD5 of `"Hello**world**Newparagraph"` (all whitespace stripped)

### Requirement: Page-level highlight data loading
The system SHALL load all highlights for the current page with a single API request when the page mounts, and distribute the data to individual MarkdownContent instances by content_hash.

#### Scenario: Page loads with multiple MarkdownContent instances
- **WHEN** a page containing 5 MarkdownContent components loads
- **THEN** exactly one `GET /api/highlights?pathname=...` request SHALL be made, and each component SHALL receive only the highlights matching its own content_hash

## ADDED Requirements

### Requirement: Edit paper basic fields via internal API
The system SHALL provide a `PATCH /api/papers/:id` endpoint that accepts a JSON body with optional fields: `title` (string), `authors` (string[], comma-separated also accepted), `link` (string). Only provided fields SHALL be updated. The response SHALL return the updated paper object. `updated_at` SHALL be set to current ISO 8601 timestamp on every successful update.

#### Scenario: Update title of manual paper
- **WHEN** a PATCH request is sent to `/api/papers/5` with body `{"title": "New Title"}`
- **AND** paper 5 has no arxiv_id
- **THEN** the paper's title SHALL be updated to "New Title" and `updated_at` SHALL be refreshed

#### Scenario: Update multiple fields at once
- **WHEN** a PATCH request is sent to `/api/papers/5` with body `{"title": "T", "authors": ["A", "B"], "link": "https://example.com"}`
- **AND** paper 5 has no arxiv_id
- **THEN** all three fields SHALL be updated and `updated_at` SHALL be refreshed

#### Scenario: Reject title/authors edit on arXiv paper
- **WHEN** a PATCH request is sent to `/api/papers/3` with body `{"title": "New Title"}`
- **AND** paper 3 has a non-null arxiv_id
- **THEN** the system SHALL return HTTP 400 with an error message indicating title and authors cannot be modified for arXiv papers

#### Scenario: Allow link edit on arXiv paper
- **WHEN** a PATCH request is sent to `/api/papers/3` with body `{"link": "https://new-link.com"}`
- **AND** paper 3 has a non-null arxiv_id
- **THEN** the link SHALL be updated successfully

#### Scenario: Paper not found
- **WHEN** a PATCH request is sent to `/api/papers/9999` and paper 9999 does not exist
- **THEN** the system SHALL return HTTP 404

### Requirement: Edit paper content via internal API
The `PATCH /api/papers/:id` endpoint SHALL also accept a `content` field (string). When provided, the system SHALL update the paper's `contents` JSON object by setting the `user_input` key to the provided value. Other keys in `contents` (e.g., `pdf_parsed`) SHALL remain unchanged. If `content` is an empty string, `user_input` SHALL be set to null (clearing user content).

#### Scenario: Set user_input content
- **WHEN** a PATCH request includes `{"content": "This is my analysis..."}`
- **THEN** `contents.user_input` SHALL be set to "This is my analysis..." while `contents.pdf_parsed` remains unchanged

#### Scenario: Clear user_input content
- **WHEN** a PATCH request includes `{"content": ""}`
- **THEN** `contents.user_input` SHALL be set to null

#### Scenario: Set content on paper with no existing contents
- **WHEN** a PATCH request includes `{"content": "text"}` and the paper's `contents` is null
- **THEN** `contents` SHALL be set to `{"user_input": "text"}`

### Requirement: Edit paper via external API
The system SHALL provide a `PATCH /external-api/v1/papers/:id` endpoint with Bearer Token auth, accepting the same fields as the internal API endpoint. The same arXiv edit restrictions SHALL apply.

#### Scenario: External API update paper
- **WHEN** an authenticated PATCH request is sent to `/external-api/v1/papers/5` with body `{"title": "Updated"}`
- **THEN** the paper SHALL be updated identically to the internal API behavior

### Requirement: Frontend edit mode in paper detail
The paper detail page SHALL have an "Edit" button that toggles the view into edit mode. In edit mode:
- Title, authors, and link fields SHALL become editable input fields
- For papers with arxiv_id, title and authors fields SHALL be disabled (visually grayed out)
- A content textarea SHALL appear with monospace font (`font-family: monospace`) displaying the current `contents.user_input` value
- "Save" and "Cancel" buttons SHALL appear
- "Cancel" SHALL discard changes and return to view mode
- "Save" SHALL send a PATCH request and return to view mode on success

#### Scenario: Enter edit mode for manual paper
- **WHEN** user clicks "Edit" on a paper with no arxiv_id
- **THEN** title, authors, link, and content fields SHALL all be editable

#### Scenario: Enter edit mode for arXiv paper
- **WHEN** user clicks "Edit" on a paper with arxiv_id
- **THEN** title and authors fields SHALL be disabled, while link and content fields SHALL be editable

#### Scenario: Save edits
- **WHEN** user modifies fields and clicks "Save"
- **THEN** a PATCH request SHALL be sent with only the changed fields, and the view SHALL refresh with updated data

#### Scenario: Cancel edits
- **WHEN** user clicks "Cancel" in edit mode
- **THEN** all changes SHALL be discarded and the view SHALL return to read-only mode

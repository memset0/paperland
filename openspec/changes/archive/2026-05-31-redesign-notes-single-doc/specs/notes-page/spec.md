## MODIFIED Requirements

### Requirement: Notes aggregate API
The system SHALL provide `GET /api/notes` that returns the current user's note for each paper that has one — one note per paper (the single document) — each annotated with its `paper_id` and `paper_title`. The endpoint SHALL require an authenticated user and return only that user's notes, and SHALL include only notes whose `body` is non-empty after trimming (empty documents are excluded).

#### Scenario: Fetch all of my notes
- **WHEN** an authenticated user calls `GET /api/notes`
- **THEN** the response SHALL include one entry per paper that has a non-empty note, each annotated with `paper_id` and `paper_title`

#### Scenario: Empty notes are excluded
- **WHEN** a user has papers whose note document is empty
- **THEN** those empty notes SHALL NOT appear in the `GET /api/notes` response

#### Scenario: Anonymous request rejected
- **WHEN** an anonymous client calls `GET /api/notes`
- **THEN** the system SHALL respond 401

### Requirement: Standalone notes page
The system SHALL provide a `/notes` page that requires login and lists the current user's notes — one per paper — ordered by recency, with client-side search over the note body. Selecting a note SHALL open that paper's note (navigating to the paper's note view). `paperland://` anchor links inside a note body SHALL remain clickable from this page and navigate to the addressed paper/block (see the `markdown-anchors` capability).

#### Scenario: Authenticated user opens /notes
- **WHEN** an authenticated user navigates to `/notes`
- **THEN** the page SHALL list their notes, one per paper, newest activity first

#### Scenario: Search filters notes
- **WHEN** the user types a query on the /notes page
- **THEN** the list SHALL filter to notes whose body matches

#### Scenario: Open a note from the page
- **WHEN** the user selects a note on the /notes page
- **THEN** the system SHALL navigate to that paper's note view

#### Scenario: Anchor link navigates from /notes
- **WHEN** the user clicks a `paperland://` link inside a note shown on /notes
- **THEN** the system SHALL navigate to the addressed paper and locate the addressed block

#### Scenario: Anonymous user gated
- **WHEN** an anonymous user selects the Notes sidebar entry or navigates to `/notes`
- **THEN** the system SHALL prompt for login and SHALL NOT display any notes

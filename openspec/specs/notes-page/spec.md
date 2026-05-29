# notes-page Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
### Requirement: Notes aggregate API
The system SHALL provide `GET /api/notes` that returns the current user's notes across all papers (walkthroughs and small notes), each with its `paper_id` and `paper_title`. The endpoint SHALL require an authenticated user and return only that user's notes.

#### Scenario: Fetch all of my notes
- **WHEN** an authenticated user calls `GET /api/notes`
- **THEN** the response SHALL include only that user's notes across papers, each annotated with `paper_id` and `paper_title`

#### Scenario: Anonymous request rejected
- **WHEN** an anonymous client calls `GET /api/notes`
- **THEN** the system SHALL respond 401

### Requirement: Standalone notes page
The system SHALL provide a `/notes` page that requires login and lists the current user's notes grouped by paper, ordered by recency, with client-side search over title and body. Selecting a note SHALL open it for viewing/editing in a floating editor window (see the `note-editor-window` capability). `paperland://` anchor links inside a note body SHALL remain clickable from this page and navigate to the addressed paper/block (see the `markdown-anchors` capability).

#### Scenario: Authenticated user opens /notes
- **WHEN** an authenticated user navigates to `/notes`
- **THEN** the page SHALL list their notes grouped by paper, newest activity first

#### Scenario: Search filters notes
- **WHEN** the user types a query on the /notes page
- **THEN** the list SHALL filter to notes whose title or body matches

#### Scenario: Open a note from the page
- **WHEN** the user selects a note on the /notes page
- **THEN** the system SHALL open that note in a floating editor window

#### Scenario: Anchor link navigates from /notes
- **WHEN** the user clicks a `paperland://` link inside a note shown on /notes
- **THEN** the system SHALL navigate to the addressed paper and locate the addressed block

#### Scenario: Anonymous user gated
- **WHEN** an anonymous user selects the Notes sidebar entry or navigates to `/notes`
- **THEN** the system SHALL prompt for login and SHALL NOT display any notes


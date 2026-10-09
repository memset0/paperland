## MODIFIED Requirements

### Requirement: Notes aggregate API
The system SHALL provide `GET /api/notes` that returns a note per paper that has one — one note per paper (the single document) — each annotated with `paper_id`, `paper_title`, `user_id`, `username`, `is_public`, and `shared`. The endpoint SHALL accept `?scope=mine|all` (default `mine`). It SHALL include only notes whose `body` is non-empty after trimming. Scoping rules:
- `scope=mine` SHALL return only the current user's notes and SHALL require an authenticated user (anonymous → 401).
- `scope=all` for a non-admin authenticated user SHALL return non-empty notes that are owned by the caller, OR published (`is_public`, any author), OR owned by a user whose `notes` sharing switch is on.
- `scope=all` for an admin SHALL return every user's non-empty notes.
- `scope=all` for an anonymous caller SHALL return published notes only (HTTP 200).
`shared` SHALL be true when the note is published or its owner shares notes. The former `include_private` parameter SHALL be ignored.

#### Scenario: Fetch all of my notes
- **WHEN** an authenticated user calls `GET /api/notes` (default `scope=mine`)
- **THEN** the response SHALL include one entry per paper that has a non-empty note owned by that user

#### Scenario: Empty notes are excluded
- **WHEN** a user has papers whose note document is empty
- **THEN** those empty notes SHALL NOT appear in the `GET /api/notes` response

#### Scenario: Anonymous mine request rejected
- **WHEN** an anonymous client calls `GET /api/notes` with the default `scope=mine`
- **THEN** the system SHALL respond 401

#### Scenario: All scope includes shared notes
- **WHEN** a non-admin calls `GET /api/notes?scope=all` and user A shares notes
- **THEN** the response SHALL include user A's non-empty notes even if they are not published

#### Scenario: Published notes listed regardless of switch
- **WHEN** user A has turned the `notes` switch off but published one note
- **THEN** that published note SHALL appear in every caller's `scope=all` response, and A's unpublished notes SHALL NOT appear for non-admins

#### Scenario: Admin can include others' private notes
- **WHEN** an admin calls `GET /api/notes?scope=all`
- **THEN** the response SHALL include every user's non-empty notes, with `shared: false` on those neither published nor shared

#### Scenario: Non-admin cannot include others' private notes
- **WHEN** a non-admin calls `GET /api/notes?scope=all&include_private=true`
- **THEN** the `include_private` flag SHALL be ignored and other users' notes that are neither published nor shared SHALL NOT be included

#### Scenario: Everyone scope returns public notes
- **WHEN** any client calls `GET /api/notes?scope=all`
- **THEN** the response SHALL include all non-empty published notes (any author), and SHALL include only published notes for an anonymous caller

### Requirement: Standalone notes page
The system SHALL provide a `/notes` page that requires login and lists notes — one per paper — ordered by recency, with client-side search over the note body. The page SHALL offer a Mine / All scope toggle. In All scope, each note SHALL show its author; published notes SHALL show a "Published" indicator; for an admin, other users' notes with `shared: false` SHALL show a "Private" marker. There SHALL be no separate include-private toggle. Selecting a note SHALL navigate to that note's paper and **open that note in the right-panel others' notes view** (via the `?note=<id>` deep link), rather than only navigating to the paper. `paperland://` anchor links inside a note body SHALL remain clickable from this page and navigate to the addressed paper/block (see the `markdown-anchors` capability).

#### Scenario: Authenticated user opens /notes
- **WHEN** an authenticated user navigates to `/notes`
- **THEN** the page SHALL list their notes, one per paper, newest activity first

#### Scenario: Switch to everyone's notes
- **WHEN** the user switches the scope toggle to All
- **THEN** the page SHALL list the notes visible under the all-scope rules, each showing its author and, when published, a "Published" indicator

#### Scenario: Admin includes others' private notes
- **WHEN** an admin views All and another user's note is neither published nor shared
- **THEN** the note SHALL be listed with a "Private" marker

#### Scenario: Search filters notes
- **WHEN** the user types a query on the /notes page
- **THEN** the list SHALL filter to notes whose body matches

#### Scenario: Open another user's note from the page
- **WHEN** the user selects a note authored by someone else on the /notes page
- **THEN** the system SHALL navigate to that note's paper and open that note in the right-panel others' notes view via the `?note=<id>` deep link

#### Scenario: Open the user's own note from the page
- **WHEN** the user selects their own note on the /notes page
- **THEN** the system SHALL navigate to that note's paper directly (without the `?note=` deep link), since the user's own note lives in their own Note view

#### Scenario: Anchor link navigates from /notes
- **WHEN** the user clicks a `paperland://` link inside a note shown on /notes
- **THEN** the system SHALL navigate to the addressed paper and locate the addressed block

#### Scenario: Anonymous user gated
- **WHEN** an anonymous user selects the Notes sidebar entry or navigates to `/notes`
- **THEN** the system SHALL prompt for login and SHALL NOT display any notes

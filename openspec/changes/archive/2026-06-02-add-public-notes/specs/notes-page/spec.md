## MODIFIED Requirements

### Requirement: Notes aggregate API
The system SHALL provide `GET /api/notes` that returns a note per paper that has one — one note per paper (the single document) — each annotated with `paper_id`, `paper_title`, `user_id`, `username`, and `is_public`. The endpoint SHALL accept `?scope=mine|all` (default `mine`) and an admin-only `?include_private=true` (honored only when `scope=all`). It SHALL include only notes whose `body` is non-empty after trimming (empty documents are excluded). Scoping rules:
- `scope=mine` SHALL return only the current user's notes and SHALL require an authenticated user (anonymous → 401).
- `scope=all` SHALL return non-empty notes that are **public (any author)** OR **owned by the caller**; anonymous callers are permitted and SHALL receive public notes only (HTTP 200).
- `scope=all&include_private=true` SHALL, for an authenticated **admin** only, additionally include other users' **private** non-empty notes; for non-admins the `include_private` flag SHALL have no effect.

#### Scenario: Fetch all of my notes
- **WHEN** an authenticated user calls `GET /api/notes` (default `scope=mine`)
- **THEN** the response SHALL include one entry per paper that has a non-empty note owned by that user, each annotated with `paper_id`, `paper_title`, `user_id`, `username`, and `is_public`

#### Scenario: Empty notes are excluded
- **WHEN** a user has papers whose note document is empty
- **THEN** those empty notes SHALL NOT appear in the `GET /api/notes` response

#### Scenario: Anonymous mine request rejected
- **WHEN** an anonymous client calls `GET /api/notes` with the default `scope=mine`
- **THEN** the system SHALL respond 401

#### Scenario: Everyone scope returns public notes
- **WHEN** any client calls `GET /api/notes?scope=all`
- **THEN** the response SHALL include all non-empty public notes (any author) plus the caller's own notes if authenticated, each annotated with its author `username` and `is_public`

#### Scenario: Admin can include others' private notes
- **WHEN** an authenticated admin calls `GET /api/notes?scope=all&include_private=true`
- **THEN** the response SHALL additionally include other users' non-empty private notes

#### Scenario: Non-admin cannot include others' private notes
- **WHEN** a non-admin calls `GET /api/notes?scope=all&include_private=true`
- **THEN** the response SHALL behave as if `include_private` were false and SHALL NOT include other users' private notes

### Requirement: Standalone notes page
The system SHALL provide a `/notes` page that requires login and lists notes — one per paper — ordered by recency, with client-side search over the note body. The page SHALL offer a **scope toggle** between the current user's own notes and everyone's notes (public), and SHALL show each note's author and a public/private indicator. For an **admin**, the page SHALL additionally offer a toggle to include other users' unpublished (private) notes. Selecting a note SHALL navigate to that note's paper and **open that note in the right-panel public notes view** (via the `?note=<id>` deep link), rather than only navigating to the paper. `paperland://` anchor links inside a note body SHALL remain clickable from this page and navigate to the addressed paper/block (see the `markdown-anchors` capability).

#### Scenario: Authenticated user opens /notes
- **WHEN** an authenticated user navigates to `/notes`
- **THEN** the page SHALL list their notes, one per paper, newest activity first

#### Scenario: Switch to everyone's notes
- **WHEN** the user switches the scope toggle to everyone's notes
- **THEN** the page SHALL list public notes across users, each showing its author and a public indicator

#### Scenario: Admin includes others' private notes
- **WHEN** an admin enables the include-private toggle while viewing everyone's notes
- **THEN** the page SHALL additionally list other users' private notes

#### Scenario: Search filters notes
- **WHEN** the user types a query on the /notes page
- **THEN** the list SHALL filter to notes whose body matches

#### Scenario: Open another user's note from the page
- **WHEN** the user selects a note authored by someone else on the /notes page
- **THEN** the system SHALL navigate to that note's paper and open that note in the right-panel public notes view via the `?note=<id>` deep link

#### Scenario: Open the user's own note from the page
- **WHEN** the user selects their own note on the /notes page
- **THEN** the system SHALL navigate to that note's paper directly (without the `?note=` deep link), since the user's own note lives in their own Note view

#### Scenario: Anchor link navigates from /notes
- **WHEN** the user clicks a `paperland://` link inside a note shown on /notes
- **THEN** the system SHALL navigate to the addressed paper and locate the addressed block

#### Scenario: Anonymous user gated
- **WHEN** an anonymous user selects the Notes sidebar entry or navigates to `/notes`
- **THEN** the system SHALL prompt for login and SHALL NOT display any notes

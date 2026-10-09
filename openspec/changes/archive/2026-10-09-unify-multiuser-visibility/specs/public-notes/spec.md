## MODIFIED Requirements

### Requirement: Single public note read endpoint
The system SHALL provide `GET /api/notes/:noteId` returning one note's full content annotated with `paper_id`, `paper_title`, `user_id`, `username`, `is_public`, and `shared`. The endpoint SHALL authorize the read when the note `is_public` (any caller, including anonymous), OR the note is owned by the caller, OR the caller is an authenticated admin, OR the caller is authenticated and the note's owner shares notes. Otherwise it SHALL respond 404 (not revealing whether the note exists).

#### Scenario: Anyone reads a public note
- **WHEN** any client (including anonymous) calls `GET /api/notes/:noteId` for a note whose `is_public` is true
- **THEN** the response SHALL include the note `body` annotated with `paper_id`, `paper_title`, `user_id`, `username`, and `is_public`

#### Scenario: Logged-in user reads a shared note
- **WHEN** an authenticated user requests an unpublished note whose owner shares notes
- **THEN** the system SHALL return that note

#### Scenario: Owner reads own private note
- **WHEN** the caller owns a note that is not public and calls `GET /api/notes/:noteId`
- **THEN** the system SHALL return that note

#### Scenario: Admin reads another user's private note
- **WHEN** an authenticated admin calls `GET /api/notes/:noteId` for another user's unshared, unpublished note
- **THEN** the system SHALL return that note

#### Scenario: Non-owner cannot read a private note
- **WHEN** a non-admin caller requests an unpublished note whose owner does not share notes, or an anonymous caller requests any unpublished note
- **THEN** the system SHALL respond 404 and SHALL NOT return the note body

### Requirement: Per-paper public notes list
The system SHALL provide `GET /api/papers/:id/public-notes` returning a body-less list of the non-empty notes for that paper that are visible to the caller under the all-scope rules and authored by users **other than the caller**: published notes for anyone; plus, for an authenticated caller, notes of users who share notes; plus, for an admin, every other user's note. Each entry SHALL carry `id`, `user_id`, `username`, `is_public`, `shared`, and `updated_at`. The endpoint SHALL NOT require authentication; for an anonymous caller only published notes SHALL be listed and no author is excluded. Notes whose `body` is empty after trimming SHALL be excluded. The note `body` SHALL NOT be included in this list response.

#### Scenario: List excludes the caller's own note
- **WHEN** an authenticated user calls `GET /api/papers/:id/public-notes` and they have their own note on that paper
- **THEN** the response SHALL NOT include the caller's own note

#### Scenario: Shared notes listed for logged-in users
- **WHEN** an authenticated user calls the endpoint and another user who shares notes has an unpublished note on the paper
- **THEN** the response SHALL include that note

#### Scenario: Anonymous sees all public notes for the paper
- **WHEN** an anonymous client calls `GET /api/papers/:id/public-notes`
- **THEN** the response SHALL list only published, non-empty notes and SHALL NOT include note bodies

#### Scenario: Private notes are excluded
- **WHEN** a paper has an unpublished note from a user who does not share notes and the caller is a non-admin
- **THEN** that note SHALL NOT appear in the response

### Requirement: Right-panel public notes section
The paper detail right panel SHALL present an "others' notes" section listing the entries from `GET /api/papers/:id/public-notes` (never the caller's own note). Each entry SHALL show its author, a "Published" indicator when published, and — for an admin viewing an unshared, unpublished note — a "Private" marker. Each entry SHALL be **collapsed and unrendered by default**; the entry's note content SHALL be fetched **only when the entry is expanded** (lazily via `GET /api/notes/:noteId`) and rendered on first expand. The section SHALL be available to anonymous visitors as well as authenticated users.

#### Scenario: Entries are collapsed and unfetched by default
- **WHEN** the paper detail page renders the others' notes section
- **THEN** each entry SHALL appear collapsed and its body SHALL NOT have been fetched

#### Scenario: Expanding fetches and renders lazily
- **WHEN** the user expands an entry for the first time
- **THEN** the system SHALL fetch that note's body via `GET /api/notes/:noteId` and render it

#### Scenario: Own note is never listed in the panel
- **WHEN** the caller has their own note (published or not) for the paper
- **THEN** the section SHALL NOT include the caller's own note (their note remains in their own Note view)

### Requirement: Owner publishes and shares a note
Publishing a note SHALL remain a per-note action independent of the owner's `notes` sharing switch. The owner of a note SHALL be able to publish or unpublish it from their own note surface (calling the visibility endpoint defined in the `paper-notes` capability), and the note surface SHALL show a "Published" state while it is published. A published note SHALL be readable by anyone, including visitors without a Paperland account, and SHALL appear in every all-scope notes list regardless of the owner's sharing switch. Once a note is published, the owner SHALL be able to copy a shareable link to it of the form `<origin>/papers/<paperId>?note=<noteId>`. The copy-link affordance SHALL be unavailable while the note is unpublished.

#### Scenario: Owner publishes a note
- **WHEN** the owner toggles their note to published
- **THEN** the note's `is_public` SHALL become true, the note SHALL show the "Published" state, and the note SHALL become readable by anonymous visitors

#### Scenario: Published note overrides an off switch
- **WHEN** the owner's `notes` sharing switch is off and they publish a note
- **THEN** that note SHALL appear in other users' all-scope notes lists while the owner's other notes remain hidden

#### Scenario: Copy link available only when public
- **WHEN** the owner's note is published
- **THEN** the owner SHALL be able to copy a link `<origin>/papers/<paperId>?note=<noteId>`; while the note is unpublished the copy-link affordance SHALL be hidden or disabled

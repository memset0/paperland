## MODIFIED Requirements

### Requirement: Note data model
The system SHALL store notes in a `notes` table with fields: `id`, `user_id` (→ users.id, owner), `paper_id` (→ papers.id), `body` (Markdown text), `is_public` (boolean, default false/private), `created_at`, `updated_at`. Each (user, paper) SHALL have at most one note row — the whole note is a single Markdown document held in `body`. A unique index SHALL enforce one row per `(user_id, paper_id)`. There SHALL be no `kind`, `parent_id`, `title`, or `sort_order` columns and no note tree. There SHALL be no structured anchor column — anchors live inline in `body` as `paperland://` links (see the `markdown-anchors` capability).

#### Scenario: Note record structure
- **WHEN** a note is created
- **THEN** the row SHALL carry `user_id` (owner), `paper_id`, a Markdown `body`, an `is_public` flag, and `created_at`/`updated_at`, and SHALL be the only note row for that (user, paper)

#### Scenario: Notes default to private
- **WHEN** a note row is created
- **THEN** its `is_public` SHALL default to false (private), readable only by its owner until explicitly published

#### Scenario: One row per user per paper
- **WHEN** content is written for a (user, paper) that already has a note row
- **THEN** the existing row's `body` SHALL be updated rather than a new row created

#### Scenario: Anchors are inline links, not a column
- **WHEN** a note references a paper location or Q&A span
- **THEN** the reference SHALL be a `paperland://` Markdown link inside `body`, and the table SHALL NOT have a dedicated anchor column

### Requirement: Notes API is owner-scoped
The system SHALL provide `GET /api/papers/:id/note` (returns `{ note }`, or an empty/null note when none exists yet), `PUT /api/papers/:id/note` (upsert the whole `body`), and `GET /api/notes` (cross-paper aggregate). There SHALL be no tree endpoints — no child-create, no move, no subtree delete, and no separate root endpoint — and no walkthrough endpoint. `GET /api/papers/:id/note` and `PUT /api/papers/:id/note` SHALL operate only on the current user's note: reads SHALL return only the current user's note (an empty note for anonymous, HTTP 200) and SHALL include its `is_public` flag; writes SHALL require an authenticated user and operate only on that user's note. Cross-user reads of other users' public notes are provided separately (see the `public-notes` capability), not by these owner-scoped endpoints.

#### Scenario: Owner reads own note
- **WHEN** an authenticated user calls `GET /api/papers/:id/note`
- **THEN** the response SHALL be `{ note }` containing only that user's single note document for the paper (empty when none yet), including its `is_public` flag

#### Scenario: Anonymous read returns empty
- **WHEN** an anonymous client calls `GET /api/papers/:id/note`
- **THEN** the response SHALL be HTTP 200 with an empty note

#### Scenario: Anonymous write rejected
- **WHEN** an anonymous client calls `PUT /api/papers/:id/note`
- **THEN** the system SHALL respond 401 and create/modify nothing

#### Scenario: Cannot touch another user's note
- **WHEN** a user writes a note for a paper
- **THEN** the write SHALL operate only within that user's own (user, paper) scope and SHALL NOT modify another user's note

## ADDED Requirements

### Requirement: Note visibility toggle endpoint
The system SHALL provide `PUT /api/papers/:id/note/visibility` with body `{ is_public: boolean }` that sets the `is_public` flag on the **caller's own** note for the paper. The endpoint SHALL require an authenticated user, SHALL operate only on the caller's (user, paper) note, and SHALL require an existing, non-empty note (publishing a note that does not yet exist or is empty SHALL be rejected). It SHALL return the updated note. The toggle SHALL be independent of body autosave and SHALL NOT be subject to the body's optimistic `updated_at` check.

#### Scenario: Owner publishes their note
- **WHEN** an authenticated owner calls `PUT /api/papers/:id/note/visibility` with `{ is_public: true }` for their existing non-empty note
- **THEN** the note's `is_public` SHALL be set to true and the updated note SHALL be returned

#### Scenario: Owner unpublishes their note
- **WHEN** an authenticated owner calls the endpoint with `{ is_public: false }`
- **THEN** the note's `is_public` SHALL be set to false and the note SHALL no longer be readable by others

#### Scenario: Cannot publish a non-existent or empty note
- **WHEN** the caller has no note, or an empty note, for the paper and calls the visibility endpoint
- **THEN** the system SHALL reject the request and SHALL NOT create a published empty note

#### Scenario: Anonymous toggle rejected
- **WHEN** an anonymous client calls `PUT /api/papers/:id/note/visibility`
- **THEN** the system SHALL respond 401 and change nothing

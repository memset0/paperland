## MODIFIED Requirements

### Requirement: Note data model
The system SHALL store notes in a `notes` table with fields: `id`, `user_id` (→ users.id, owner), `paper_id` (→ papers.id), `body` (Markdown text), `completed` (integer 0/1, default 0 — whether the user has marked this note's reading complete), `created_at`, `updated_at`. Each (user, paper) SHALL have at most one note row — the whole note is a single Markdown document held in `body`. A unique index SHALL enforce one row per `(user_id, paper_id)`. There SHALL be no `kind`, `parent_id`, `title`, or `sort_order` columns and no note tree. There SHALL be no structured anchor column — anchors live inline in `body` as `paperland://` links (see the `markdown-anchors` capability).

#### Scenario: Note record structure
- **WHEN** a note is created
- **THEN** the row SHALL carry `user_id` (owner), `paper_id`, a Markdown `body`, a `completed` flag (default false), and `created_at`/`updated_at`, and SHALL be the only note row for that (user, paper)

#### Scenario: One row per user per paper
- **WHEN** content is written for a (user, paper) that already has a note row
- **THEN** the existing row's `body` SHALL be updated rather than a new row created

#### Scenario: Body upsert leaves completion untouched
- **WHEN** the note body is upserted via `PUT /api/papers/:id/note`
- **THEN** the row's `completed` flag SHALL be preserved (body and completion are updated independently)

### Requirement: Notes API is owner-scoped
The system SHALL provide `GET /api/papers/:id/note` (returns `{ note }` including its `completed` flag, or an empty/null note when none exists yet), `PUT /api/papers/:id/note` (upsert the whole `body`), `POST /api/papers/:id/note/completed` (toggle the note's `completed` flag), and `GET /api/notes` (cross-paper aggregate, each entry including `completed`). There SHALL be no tree endpoints — no child-create, no move, no subtree delete, and no separate root endpoint — and no walkthrough endpoint. Reads SHALL return only the current user's note (an empty note for anonymous, HTTP 200); writes SHALL require an authenticated user and operate only on that user's note.

#### Scenario: Owner reads own note
- **WHEN** an authenticated user calls `GET /api/papers/:id/note`
- **THEN** the response SHALL include their note's `body` and `completed` flag (or an empty note when none yet)

#### Scenario: Aggregate includes completion
- **WHEN** an authenticated user calls `GET /api/notes`
- **THEN** each returned note SHALL include its `paper_id` and `completed` flag

## ADDED Requirements

### Requirement: Note completion toggle
`POST /api/papers/:id/note/completed` SHALL set the current user's note `completed` flag for the paper to the requested value. It SHALL require an authenticated user and operate only on that user's note. Completing SHALL require an existing note row (a paper with no note row cannot be marked complete). The endpoint SHALL return the updated note.

#### Scenario: Mark a note complete
- **WHEN** an authenticated user with a note for the paper posts `{ completed: true }`
- **THEN** the note's `completed` flag SHALL become true and the updated note SHALL be returned

#### Scenario: Toggle back to incomplete
- **WHEN** a user posts `{ completed: false }` for a completed note
- **THEN** the note's `completed` flag SHALL become false

#### Scenario: Cannot complete a non-existent note
- **WHEN** a user posts to complete a paper that has no note row
- **THEN** the system SHALL NOT create a completed empty note (it SHALL reject or no-op)

#### Scenario: Anonymous toggle rejected
- **WHEN** an anonymous client posts to the completion endpoint
- **THEN** the system SHALL respond 401 and change nothing

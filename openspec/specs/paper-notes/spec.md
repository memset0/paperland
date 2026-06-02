# paper-notes Specification

## Purpose
TBD - created by archiving change add-paper-notes. Update Purpose after archive.
## Requirements
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

### Requirement: Markdown body persistence with optimistic concurrency
The single note document SHALL be persisted as Markdown via `PUT /api/papers/:id/note` with debounced autosave (the editing UI is provided by the `notes-walkthrough` and `note-editor-window` capabilities; cross-surface sync semantics by `notes-shared-editing`). Concurrent saves SHALL be guarded by an optimistic `updated_at` check. The first write that creates the note (no prior row exists) SHALL succeed as a create and SHALL NOT require a matching `updated_at`.

#### Scenario: Edits autosave
- **WHEN** a user edits the note and pauses
- **THEN** the change SHALL be saved automatically without an explicit save action

#### Scenario: Conflicting update detected
- **WHEN** a `PUT` carries an `updated_at` that no longer matches the stored row
- **THEN** the system SHALL respond 409 with the latest content and the client SHALL surface a "modified elsewhere" notice

#### Scenario: First write needs no prior timestamp
- **WHEN** a user makes the first write to a note that does not yet exist
- **THEN** the system SHALL create it without requiring a matching `updated_at`

### Requirement: Paper detail notes entry
The paper detail page SHALL present, for authenticated users, the single note document in two derived views: a left-panel document view with edit / split / render modes (see the `notes-walkthrough` capability) and a right-panel mind-map derived from the document's heading structure (see the `note-mindmap` capability). Opening a section for editing SHALL launch a floating editor window (see the `note-editor-window` capability). The right-panel notes card SHALL also provide a control that opens the **whole-document floating editor** directly (see the `note-editor-window` capability). The Kimi auto-summary card SHALL be placed **directly below** the notes card in the paper detail layout. Anonymous visitors SHALL see a login prompt instead of note content.

#### Scenario: Authenticated user sees notes entry
- **WHEN** an authenticated user opens a paper detail page
- **THEN** they SHALL see the note document view (left) and its heading-derived mind-map (right)

#### Scenario: Notes card opens the whole-document editor
- **WHEN** an authenticated user activates the open-editor control on the notes card
- **THEN** the whole-document floating editor SHALL open

#### Scenario: Kimi summary sits below the notes card
- **WHEN** the paper detail page is rendered
- **THEN** the Kimi auto-summary card SHALL appear directly below the notes card

#### Scenario: Anonymous visitor sees login prompt
- **WHEN** an anonymous visitor opens a paper detail page
- **THEN** the notes area SHALL prompt for login and SHALL NOT show note content

### Requirement: Note count by content
A paper's note SHALL count toward its note total only if the document `body`, after trimming surrounding whitespace, is non-empty. Note counts surfaced in the UI (e.g. the `/notes` aggregate) SHALL reflect this rule; an empty document SHALL NOT count.

#### Scenario: Empty document does not count
- **WHEN** a paper's note document is empty after trimming
- **THEN** the paper's note count SHALL be 0

#### Scenario: Non-empty document counts
- **WHEN** a paper's note document has non-empty content
- **THEN** the paper SHALL be counted as having a note

### Requirement: Single note per user per paper, lazily created
For each (user, paper) the system SHALL maintain at most one note row holding the whole Markdown document. A paper with no note SHALL have **zero** note rows; the row SHALL be created **lazily** — only when the user first writes content. `PUT /api/papers/:id/note` SHALL upsert the note: create the row (persisting the given `body`) if absent, otherwise update its `body`. At most one row SHALL exist per (user, paper), enforced by a unique index that guards concurrent first-writes.

#### Scenario: No note means no rows
- **WHEN** a paper has never had a note written for a given user
- **THEN** there SHALL be no note rows for that (user, paper)

#### Scenario: First write creates the note row
- **WHEN** an authenticated user writes content to a paper that has no note
- **THEN** the system SHALL create a single note row owned by that user for that paper and persist the body

#### Scenario: At most one row per user per paper
- **WHEN** two writes that would each create the note for the same (user, paper) race
- **THEN** the system SHALL end with exactly one note row

### Requirement: Migrate existing note trees into a single document
The system SHALL provide a one-time migration that, after backing up the database, flattens each (user, paper) note tree into a single Markdown document and reduces the `notes` table to one row per (user, paper). The flattening SHALL follow the previous walkthrough assembly — each note's `title` becomes a heading at its tree-depth level, its `body` follows, body headings are re-leveled to nest under, and the root note's `body` becomes the leading preamble — without render-time auto-numbering. After migration each paper SHALL have exactly one note row whose heading-derived mind-map reproduces the pre-migration node tree.

#### Scenario: Backup precedes migration
- **WHEN** the migration runs
- **THEN** it SHALL create a database backup before changing any note data

#### Scenario: Tree flattened into one document
- **WHEN** a (user, paper) had a note tree with multiple nodes
- **THEN** after migration there SHALL be exactly one note row whose `body` is the depth-flattened Markdown of that tree

#### Scenario: Mind-map preserved across migration
- **WHEN** the migrated document is rendered as a mind-map
- **THEN** its node tree SHALL reproduce the pre-migration mind-map's nodes and hierarchy

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


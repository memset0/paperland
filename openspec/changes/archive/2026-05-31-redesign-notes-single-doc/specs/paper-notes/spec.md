## MODIFIED Requirements

### Requirement: Note data model
The system SHALL store notes in a `notes` table with fields: `id`, `user_id` (→ users.id, owner), `paper_id` (→ papers.id), `body` (Markdown text), `created_at`, `updated_at`. Each (user, paper) SHALL have at most one note row — the whole note is a single Markdown document held in `body`. A unique index SHALL enforce one row per `(user_id, paper_id)`. There SHALL be no `kind`, `parent_id`, `title`, or `sort_order` columns and no note tree. There SHALL be no structured anchor column — anchors live inline in `body` as `paperland://` links (see the `markdown-anchors` capability).

#### Scenario: Note record structure
- **WHEN** a note is created
- **THEN** the row SHALL carry `user_id` (owner), `paper_id`, a Markdown `body`, and `created_at`/`updated_at`, and SHALL be the only note row for that (user, paper)

#### Scenario: One row per user per paper
- **WHEN** content is written for a (user, paper) that already has a note row
- **THEN** the existing row's `body` SHALL be updated rather than a new row created

#### Scenario: Anchors are inline links, not a column
- **WHEN** a note references a paper location or Q&A span
- **THEN** the reference SHALL be a `paperland://` Markdown link inside `body`, and the table SHALL NOT have a dedicated anchor column

### Requirement: Notes API is owner-scoped
The system SHALL provide `GET /api/papers/:id/note` (returns `{ note }`, or an empty/null note when none exists yet), `PUT /api/papers/:id/note` (upsert the whole `body`), and `GET /api/notes` (cross-paper aggregate). There SHALL be no tree endpoints — no child-create, no move, no subtree delete, and no separate root endpoint — and no walkthrough endpoint. Reads SHALL return only the current user's note (an empty note for anonymous, HTTP 200); writes SHALL require an authenticated user and operate only on that user's note.

#### Scenario: Owner reads own note
- **WHEN** an authenticated user calls `GET /api/papers/:id/note`
- **THEN** the response SHALL be `{ note }` containing only that user's single note document for the paper (empty when none yet)

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
The paper detail page SHALL present, for authenticated users, the single note document in two derived views: a left-panel document view with edit / split / render modes (see the `notes-walkthrough` capability) and a right-panel mind-map derived from the document's heading structure (see the `note-mindmap` capability). Opening a section for editing SHALL launch a floating editor window (see the `note-editor-window` capability). Anonymous visitors SHALL see a login prompt instead of note content.

#### Scenario: Authenticated user sees notes entry
- **WHEN** an authenticated user opens a paper detail page
- **THEN** they SHALL see the note document view (left) and its heading-derived mind-map (right)

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Hierarchical small notes
**Reason**: The note tree is replaced by a single Markdown document; hierarchy now lives in the document's heading structure, not in note rows.
**Migration**: Existing trees are flattened into the single document by the one-time migration (see "Migrate existing note trees into a single document"); structure is thereafter expressed via Markdown headings.

### Requirement: Subtree deletion
**Reason**: There are no longer child note rows to delete; removing a section is a Markdown edit on the single document.
**Migration**: Delete a section by editing the document — remove its heading and content — in the left-panel editor or via the mind-map's delete operation.

### Requirement: Root note per user per paper, lazily created
**Reason**: There is no longer a root note distinct from child notes; each (user, paper) has a single note document.
**Migration**: Replaced by "Single note per user per paper, lazily created"; the former root row becomes the single document row.

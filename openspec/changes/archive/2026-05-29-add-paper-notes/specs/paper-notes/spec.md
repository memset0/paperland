## ADDED Requirements

### Requirement: Note data model
The system SHALL store notes in a `notes` table with fields: `id`, `user_id` (→ users.id, owner), `paper_id` (→ papers.id), `kind` (`walkthrough` | `note`), `parent_id` (→ notes.id, nullable, self-referential), `title` (nullable), `body` (Markdown text), `sort_order` (integer), `created_at`, `updated_at`. Notes are per-user and per-paper. There SHALL be no structured anchor column — anchors live inline in `body` as `paperland://` links (see the `markdown-anchors` capability).

#### Scenario: Note record structure
- **WHEN** a note is created
- **THEN** the row SHALL carry `user_id` (owner), `paper_id`, a `kind` of `walkthrough` or `note`, a Markdown `body`, and `created_at`/`updated_at`

#### Scenario: Small note carries hierarchy fields
- **WHEN** a `note`-kind row is created
- **THEN** it SHALL support a nullable `parent_id` (another note) and a `sort_order` for sibling ordering

#### Scenario: Anchors are inline links, not a column
- **WHEN** a note references a paper location or Q&A span
- **THEN** the reference SHALL be a `paperland://` Markdown link inside `body`, and the table SHALL NOT have a dedicated anchor column

### Requirement: One walkthrough per user per paper
For each (user, paper) pair the system SHALL maintain at most one `walkthrough`-kind note. `PUT /api/papers/:id/walkthrough` SHALL upsert it: create the walkthrough if absent, otherwise update its `body`.

#### Scenario: First walkthrough save creates it
- **WHEN** an authenticated user saves a walkthrough for a paper that has none
- **THEN** the system SHALL create a single `walkthrough` note owned by that user for that paper

#### Scenario: Subsequent saves update the same walkthrough
- **WHEN** the same user saves the walkthrough again
- **THEN** the system SHALL update the existing walkthrough rather than create a second one

### Requirement: Hierarchical small notes
Small notes (`kind='note'`) SHALL form a tree per (user, paper) via `parent_id`: a null `parent_id` is a top-level node, otherwise it is a child of the referenced note. Siblings SHALL be ordered by `sort_order`. The client SHALL build the tree from the flat note list.

#### Scenario: Create a top-level note
- **WHEN** an authenticated user creates a small note with no parent
- **THEN** it SHALL appear as a top-level node in that paper's note tree

#### Scenario: Create a child note
- **WHEN** a user creates a small note with `parent_id` set to an existing note they own
- **THEN** it SHALL appear nested under that parent

#### Scenario: Reparent and reorder via move
- **WHEN** `POST /api/notes/:id/move` is called with a new `parent_id` and `sort_order`
- **THEN** the note SHALL be re-attached under the new parent at the given position

#### Scenario: Move rejects cycles
- **WHEN** a move would place a note under one of its own descendants
- **THEN** the system SHALL reject the move and leave the tree unchanged

### Requirement: Subtree deletion
Deleting a small note SHALL delete its entire subtree (the note and all descendants) in a single transaction.

#### Scenario: Delete a note with children
- **WHEN** an authenticated owner deletes a note that has descendants
- **THEN** the note and all of its descendants SHALL be removed

### Requirement: Notes API is owner-scoped
The system SHALL provide `GET /api/papers/:id/notes` (returns `{ walkthrough, notes }`), `PUT /api/papers/:id/walkthrough`, `POST /api/papers/:id/notes`, `PATCH /api/notes/:id`, `POST /api/notes/:id/move`, and `DELETE /api/notes/:id`. Reads SHALL return only the current user's notes (empty for anonymous, HTTP 200); writes SHALL require an authenticated user and operate only on that user's notes.

#### Scenario: Owner reads own notes
- **WHEN** an authenticated user calls `GET /api/papers/:id/notes`
- **THEN** the response SHALL include only that user's walkthrough and small notes for the paper

#### Scenario: Anonymous read returns empty
- **WHEN** an anonymous client calls `GET /api/papers/:id/notes`
- **THEN** the response SHALL be HTTP 200 with an empty walkthrough and note list

#### Scenario: Anonymous write rejected
- **WHEN** an anonymous client calls any notes write endpoint
- **THEN** the system SHALL respond 401 and create/modify nothing

#### Scenario: Cannot touch another user's note
- **WHEN** a user calls `PATCH`/`DELETE`/`move` on a note owned by a different user
- **THEN** the system SHALL respond 404 and make no change

### Requirement: Markdown body persistence with optimistic concurrency
Walkthrough and small-note bodies SHALL be persisted as Markdown with debounced autosave (the editing UI is provided by the `note-editor-window` capability). Concurrent edits SHALL be guarded by an optimistic `updated_at` check.

#### Scenario: Edits autosave
- **WHEN** a user edits a walkthrough or note body and pauses
- **THEN** the change SHALL be saved automatically without an explicit save action

#### Scenario: Conflicting update detected
- **WHEN** a `PATCH`/`PUT` carries an `updated_at` that no longer matches the stored row
- **THEN** the system SHALL respond 409 with the latest content and the client SHALL surface a "modified elsewhere" notice

### Requirement: Paper detail notes entry
The paper detail page SHALL include a 笔记 section exposing the walkthrough entry and the small-note mind-map (see the `note-mindmap` capability), for authenticated users. Opening a note for editing SHALL launch a floating editor window (see the `note-editor-window` capability). Anonymous visitors SHALL see a login prompt instead of note content.

#### Scenario: Authenticated user sees notes entry
- **WHEN** an authenticated user opens a paper detail page
- **THEN** the 笔记 section SHALL show their walkthrough entry and small-note mind-map

#### Scenario: Anonymous visitor sees login prompt
- **WHEN** an anonymous visitor opens a paper detail page
- **THEN** the 笔记 section SHALL prompt for login and SHALL NOT show note content

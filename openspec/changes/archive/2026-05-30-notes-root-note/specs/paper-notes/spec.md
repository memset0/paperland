## ADDED Requirements

### Requirement: Root note per user per paper, lazily created
For each (user, paper) the system SHALL maintain at most one `root`-kind note, which has `parent_id IS NULL` and is the parent of all other notes for that paper. A paper with no notes SHALL have **zero** note rows; the root note SHALL be created **lazily** — only when the user first writes content to it or creates the first child note. `PUT /api/papers/:id/root` SHALL upsert the root note: create it (persisting the given `body`) if absent, otherwise update its `body`. Creating a note with no explicit parent SHALL create the root note if it does not yet exist and attach the new note as a child of the root, in a single transaction. At most one `root` note SHALL exist per (user, paper).

#### Scenario: No notes means no rows
- **WHEN** a paper has never had a note written for a given user
- **THEN** there SHALL be no note rows for that (user, paper), including no root note

#### Scenario: First root write creates the root note
- **WHEN** an authenticated user writes body content to the root note of a paper that has none
- **THEN** the system SHALL create a single `root` note owned by that user for that paper and persist the body

#### Scenario: First child creates root and child together
- **WHEN** an authenticated user creates a note with no explicit parent for a paper that has no notes yet
- **THEN** the system SHALL create the root note and the new note as its child in one transaction

#### Scenario: At most one root per user per paper
- **WHEN** two writes that would each create the root for the same (user, paper) race
- **THEN** the system SHALL end with exactly one `root` note and attach work to that single root

### Requirement: Note count by content
A note (the root note or any other note) SHALL count toward a paper's note total only if its `body`, after trimming surrounding whitespace, is non-empty. An empty root note SHALL NOT count, and a note that has a title but an empty body SHALL NOT count. Note counts surfaced in the UI (the mind-map and the `/notes` aggregate) SHALL reflect this rule.

#### Scenario: Empty root note does not count
- **WHEN** a paper has a root note with an empty body and no other notes
- **THEN** the paper's note count SHALL be 0

#### Scenario: Notes with content are counted
- **WHEN** a paper has an empty root note and two child notes that each have non-empty bodies
- **THEN** the paper's note count SHALL be 2

#### Scenario: Title-only note does not count
- **WHEN** a note has a title but an empty body
- **THEN** it SHALL NOT be included in the note count

## MODIFIED Requirements

### Requirement: Note data model
The system SHALL store notes in a `notes` table with fields: `id`, `user_id` (→ users.id, owner), `paper_id` (→ papers.id), `kind` (`root` | `note`), `parent_id` (→ notes.id, nullable, self-referential), `title` (nullable), `body` (Markdown text), `sort_order` (integer), `created_at`, `updated_at`. Notes are per-user and per-paper, organized as a single tree per (user, paper) anchored by a `root`-kind note (`parent_id IS NULL`); every other note is `kind='note'` with a non-null `parent_id`. There SHALL be no structured anchor column — anchors live inline in `body` as `paperland://` links (see the `markdown-anchors` capability).

#### Scenario: Note record structure
- **WHEN** a note is created
- **THEN** the row SHALL carry `user_id` (owner), `paper_id`, a `kind` of `root` or `note`, a Markdown `body`, and `created_at`/`updated_at`

#### Scenario: Note carries hierarchy fields
- **WHEN** a `note`-kind row is created
- **THEN** it SHALL carry a non-null `parent_id` (the root note or another note) and a `sort_order` for sibling ordering

#### Scenario: Anchors are inline links, not a column
- **WHEN** a note references a paper location or Q&A span
- **THEN** the reference SHALL be a `paperland://` Markdown link inside `body`, and the table SHALL NOT have a dedicated anchor column

### Requirement: Hierarchical small notes
Notes (`kind='note'`) SHALL form a single tree per (user, paper) under the root note via `parent_id`: a note created without an explicit parent SHALL be attached as a child of the root note (the root is the sole top-level node — there are no longer multiple parentless small notes). Siblings SHALL be ordered by `sort_order`. The client SHALL build one tree rooted at the root note from the flat note list.

#### Scenario: Create a note with no parent attaches under the root
- **WHEN** an authenticated user creates a note without specifying a parent
- **THEN** it SHALL appear as a child of the paper's root note

#### Scenario: Create a child note
- **WHEN** a user creates a note with `parent_id` set to an existing note they own
- **THEN** it SHALL appear nested under that parent

#### Scenario: Reparent and reorder via move
- **WHEN** `POST /api/notes/:id/move` is called with a new `parent_id` and `sort_order`
- **THEN** the note SHALL be re-attached under the new parent at the given position

#### Scenario: Move rejects cycles
- **WHEN** a move would place a note under one of its own descendants
- **THEN** the system SHALL reject the move and leave the tree unchanged

### Requirement: Subtree deletion
Deleting a `note` SHALL delete its entire subtree (the note and all descendants) in a single transaction. The root note SHALL NOT be deletable via `DELETE /api/notes/:id`.

#### Scenario: Delete a note with children
- **WHEN** an authenticated owner deletes a `note` that has descendants
- **THEN** the note and all of its descendants SHALL be removed

#### Scenario: Deleting the root is rejected
- **WHEN** a user calls `DELETE /api/notes/:id` on a `root`-kind note
- **THEN** the system SHALL respond 400 and remove nothing

### Requirement: Notes API is owner-scoped
The system SHALL provide `GET /api/papers/:id/notes` (returns `{ notes }`), `PUT /api/papers/:id/root`, `POST /api/papers/:id/notes`, `PATCH /api/notes/:id`, `POST /api/notes/:id/move`, and `DELETE /api/notes/:id`. There SHALL be no walkthrough endpoint. Reads SHALL return only the current user's notes (an empty list for anonymous, HTTP 200); writes SHALL require an authenticated user and operate only on that user's notes. `POST /api/notes/:id/move` and `DELETE /api/notes/:id` SHALL reject a `root`-kind target.

#### Scenario: Owner reads own notes
- **WHEN** an authenticated user calls `GET /api/papers/:id/notes`
- **THEN** the response SHALL be `{ notes }` containing only that user's notes for the paper (the root note, if it exists, plus its descendants)

#### Scenario: Anonymous read returns empty
- **WHEN** an anonymous client calls `GET /api/papers/:id/notes`
- **THEN** the response SHALL be HTTP 200 with an empty note list

#### Scenario: Anonymous write rejected
- **WHEN** an anonymous client calls any notes write endpoint
- **THEN** the system SHALL respond 401 and create/modify nothing

#### Scenario: Cannot touch another user's note
- **WHEN** a user calls `PATCH`/`DELETE`/`move` on a note owned by a different user
- **THEN** the system SHALL respond 404 and make no change

#### Scenario: Move or delete of the root is rejected
- **WHEN** a user calls `move` or `DELETE` on a `root`-kind note
- **THEN** the system SHALL respond 400 and leave the tree unchanged

### Requirement: Markdown body persistence with optimistic concurrency
Note bodies — including the root note — SHALL be persisted as Markdown with debounced autosave (the editing UI is provided by the `note-editor-window` capability). Concurrent edits SHALL be guarded by an optimistic `updated_at` check. The first write that creates the root note (no prior row exists) SHALL succeed as a create and SHALL NOT require a matching `updated_at`.

#### Scenario: Edits autosave
- **WHEN** a user edits a note body and pauses
- **THEN** the change SHALL be saved automatically without an explicit save action

#### Scenario: Conflicting update detected
- **WHEN** a `PATCH`/`PUT` carries an `updated_at` that no longer matches the stored row
- **THEN** the system SHALL respond 409 with the latest content and the client SHALL surface a "modified elsewhere" notice

#### Scenario: First root write needs no prior timestamp
- **WHEN** a user makes the first write to a root note that does not yet exist
- **THEN** the system SHALL create it without requiring a matching `updated_at`

### Requirement: Paper detail notes entry
The paper detail page SHALL include a 笔记 section exposing the note mind-map rooted at the root note (see the `note-mindmap` capability), for authenticated users. There SHALL be no separate walkthrough entry. Opening a note for editing SHALL launch a floating editor window (see the `note-editor-window` capability). Anonymous visitors SHALL see a login prompt instead of note content.

#### Scenario: Authenticated user sees notes entry
- **WHEN** an authenticated user opens a paper detail page
- **THEN** the 笔记 section SHALL show their note mind-map rooted at the root note

#### Scenario: Anonymous visitor sees login prompt
- **WHEN** an anonymous visitor opens a paper detail page
- **THEN** the 笔记 section SHALL prompt for login and SHALL NOT show note content

## REMOVED Requirements

### Requirement: One walkthrough per user per paper
**Reason**: The `walkthrough` note kind is removed. It was never used in practice (no walkthrough rows exist), and the unified root-note model supersedes it — the root note now holds any whole-paper overview content. Any future "walk through the whole paper" experience will be a separate, dedicated walkthrough view, not a special note kind.
**Migration**: The `PUT /api/papers/:id/walkthrough` endpoint is removed; the `kind='walkthrough'` value is removed. The migration deletes any stray walkthrough rows and reparents existing top-level notes under a lazily-created `root` note (see design.md). No note content is lost.

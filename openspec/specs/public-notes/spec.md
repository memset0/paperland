# public-notes Specification

## Purpose
TBD - created by archiving change add-public-notes. Update Purpose after archive.
## Requirements
### Requirement: Single public note read endpoint
The system SHALL provide `GET /api/notes/:noteId` returning one note's full content annotated with `paper_id`, `paper_title`, `user_id`, `username`, and `is_public`. The endpoint SHALL authorize the read when the note `is_public`, OR the note is owned by the caller, OR the caller is an authenticated admin. Otherwise it SHALL respond 404 (not revealing whether the note exists). The endpoint SHALL NOT require authentication for the public case (anonymous callers MAY read public notes).

#### Scenario: Anyone reads a public note
- **WHEN** any client (including anonymous) calls `GET /api/notes/:noteId` for a note whose `is_public` is true
- **THEN** the response SHALL include the note `body` annotated with `paper_id`, `paper_title`, `user_id`, `username`, and `is_public`

#### Scenario: Owner reads own private note
- **WHEN** the caller owns a note that is not public and calls `GET /api/notes/:noteId`
- **THEN** the system SHALL return that note

#### Scenario: Admin reads another user's private note
- **WHEN** an authenticated admin calls `GET /api/notes/:noteId` for another user's private note
- **THEN** the system SHALL return that note

#### Scenario: Non-owner cannot read a private note
- **WHEN** a non-admin caller (or anonymous) requests a private note they do not own
- **THEN** the system SHALL respond 404 and SHALL NOT return the note body

### Requirement: Per-paper public notes list
The system SHALL provide `GET /api/papers/:id/public-notes` returning a body-less list of the **public**, non-empty notes for that paper authored by users **other than the caller**, each entry carrying `id`, `user_id`, `username`, and `updated_at`. The endpoint SHALL NOT require authentication; for an anonymous caller no author is excluded. Notes whose `body` is empty after trimming SHALL be excluded. The note `body` SHALL NOT be included in this list response.

#### Scenario: List excludes the caller's own note
- **WHEN** an authenticated user calls `GET /api/papers/:id/public-notes` and they have their own public note on that paper
- **THEN** the response SHALL list other users' public notes for that paper and SHALL NOT include the caller's own note

#### Scenario: Anonymous sees all public notes for the paper
- **WHEN** an anonymous client calls `GET /api/papers/:id/public-notes`
- **THEN** the response SHALL list every public, non-empty note for that paper with `id`, `user_id`, `username`, and `updated_at`, and SHALL NOT include note bodies

#### Scenario: Private notes are excluded
- **WHEN** a paper has notes from other users that are not public
- **THEN** those notes SHALL NOT appear in `GET /api/papers/:id/public-notes`

### Requirement: Right-panel public notes section
The paper detail right panel SHALL present a "public notes from others" section listing the entries from `GET /api/papers/:id/public-notes` (never the caller's own note). Each entry SHALL be **collapsed and unrendered by default**; the entry's note content SHALL be fetched **only when the entry is expanded** (lazily via `GET /api/notes/:noteId`) and rendered on first expand. The section SHALL be available to anonymous visitors as well as authenticated users.

#### Scenario: Entries are collapsed and unfetched by default
- **WHEN** the paper detail page renders the public notes section
- **THEN** each other-user public note SHALL appear collapsed and its body SHALL NOT have been fetched

#### Scenario: Expanding fetches and renders lazily
- **WHEN** the user expands a public note entry for the first time
- **THEN** the system SHALL fetch that note's body via `GET /api/notes/:noteId` and render it

#### Scenario: Own note is never listed in the panel
- **WHEN** the caller has their own note (public or not) for the paper
- **THEN** the public notes section SHALL NOT include the caller's own note (their note remains in their own Note view)

### Requirement: Public note read-only rendering
A public note SHALL be rendered read-only with the **heading-derived mind-map shown first, then the full note body**. The mind-map SHALL be derived from the note `body` (the same heading-to-tree derivation used for the owner's own note) and SHALL expose no editing affordances (no drag, no undo, no node-action menus, no open-editor-on-click). Within the body, PDF-target anchors (`paperland://…?pdf=…`) SHALL remain actionable while Q&A/block-target anchors (`paperland://…?h=…`) SHALL be rendered inert (see the `markdown-anchors` capability).

#### Scenario: Mind-map precedes the body
- **WHEN** a public note is rendered
- **THEN** the heading-derived mind-map SHALL appear before the full note body

#### Scenario: Read-only — no editing affordances
- **WHEN** a viewer interacts with a rendered public note's mind-map or headings
- **THEN** no editor SHALL open and no structural edit SHALL be possible

#### Scenario: PDF anchors clickable, Q&A anchors inert
- **WHEN** a public note body contains a `paperland://…?pdf=…` link and a `paperland://…?h=…` link
- **THEN** the PDF link SHALL be clickable and route to the viewer, while the Q&A/block link SHALL be inert (not actionable)

### Requirement: Owner publishes and shares a note
The owner of a note SHALL be able to publish or unpublish it from their own note surface (calling the visibility endpoint defined in the `paper-notes` capability). Once a note is public, the owner SHALL be able to copy a shareable link to it of the form `<origin>/papers/<paperId>?note=<noteId>`. The copy-link affordance SHALL be unavailable while the note is private.

#### Scenario: Owner publishes a note
- **WHEN** the owner toggles their note to public
- **THEN** the note's `is_public` SHALL become true and the note SHALL become readable by others

#### Scenario: Copy link available only when public
- **WHEN** the owner's note is public
- **THEN** the owner SHALL be able to copy a link `<origin>/papers/<paperId>?note=<noteId>`; while the note is private the copy-link affordance SHALL be hidden or disabled

### Requirement: Note link deep-opens the note in the right panel
Opening `/papers/:paperId?note=:noteId` SHALL navigate to that paper and, after it loads, fetch the addressed note and **auto-open it in the right-panel public notes section** (switching to the Note view, expanding that entry, rendering it, and scrolling to it). If the addressed note belongs to the **current viewer**, the system SHALL instead show a brief "this is your own note" hint and SHALL NOT auto-open a public-notes entry (the owner's note already lives in their own Note view). If the note is unavailable (deleted or no longer readable), the system SHALL show a brief notice and SHALL land on the paper without opening anything.

#### Scenario: Opening another user's note link auto-opens it
- **WHEN** a viewer opens `/papers/:paperId?note=:noteId` for a public note authored by someone else
- **THEN** the system SHALL navigate to the paper, switch the right panel to the Note view, expand that note's entry, render it, and scroll to it

#### Scenario: Opening own note link shows a hint and skips auto-open
- **WHEN** a viewer opens a `?note=` link that addresses their own note
- **THEN** the system SHALL show a "this is your own note" hint and SHALL NOT auto-open a public-notes entry

#### Scenario: Stale note link degrades gracefully
- **WHEN** a `?note=` link addresses a note that is deleted or no longer readable by the viewer
- **THEN** the system SHALL show a brief "note unavailable" notice and land on the paper without opening a note


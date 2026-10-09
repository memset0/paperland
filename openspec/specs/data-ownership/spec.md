# data-ownership Specification

## Purpose
TBD - created by archiving change add-user-auth. Update Purpose after archive.

## Requirements

### Requirement: Ownership columns on user-private data
The system SHALL add a `user_id` column referencing `users.id` to the `tags`, `qa_entries`, `highlights`, and `api_tokens` tables. For `qa_entries`, `user_id` SHALL be populated for `free` entries and SHALL be null for `template` entries (which are shared and public).

#### Scenario: Free QA entry has an owner
- **WHEN** an authenticated user submits a free question
- **THEN** the created `qa_entries` row SHALL have `type='free'` and `user_id` set to that user

#### Scenario: Template QA entry has no owner
- **WHEN** a template question is triggered
- **THEN** the `qa_entries` row SHALL have `type='template'` and `user_id` null (shared/public)

#### Scenario: Highlight and tag have an owner
- **WHEN** an authenticated user creates a highlight or a tag
- **THEN** the corresponding row SHALL have `user_id` set to that user

### Requirement: Owner-scoped reads
Reads of user-owned data SHALL follow the visibility class defined in the `data-sharing-preferences` capability. Always-private data (tags, the image-host list, API tokens, Q&A reading preferences) SHALL return only rows owned by the current authenticated user. Optionally-shared data (highlights, notes, free Q&A, reference links) SHALL default to rows owned by the current user (`scope=mine`); with an explicit `scope=all` a non-admin SHALL additionally receive other users' rows whose owner shares that data type (plus published notes), and an admin SHALL receive every user's rows. Anonymous reads SHALL return public preset Q&A and published notes where applicable and an empty set for other user-owned collections, with HTTP 200 (not 401) on public endpoints.

#### Scenario: Owner sees own data
- **WHEN** an authenticated user reads tags, or reads highlights, notes, free Q&A, or reference links with `scope=mine`
- **THEN** only rows owned by that user SHALL be returned

#### Scenario: Other users do not see it
- **WHEN** a user reads tags, or reads optionally-shared data with `scope=all` while its owner's switch for that type is off
- **THEN** a non-admin SHALL NOT receive those rows

#### Scenario: Shared data visible in all scope
- **WHEN** a non-admin reads free Q&A with `scope=all` and another user shares Q&A
- **THEN** that user's free Q&A SHALL be returned with `user_id` and `username`

#### Scenario: Anonymous gets empty, not error
- **WHEN** an anonymous client reads a public owner-aware endpoint (e.g. `GET /api/highlights`)
- **THEN** the response SHALL be HTTP 200 with public preset Q&A or published notes where applicable and empty private/user collections

### Requirement: Writes record the owner and require login
When an authenticated user creates user-private data (free QA entry, highlight, tag, or paper-tag assignment), the system SHALL set `user_id` to that user. Anonymous attempts to perform these writes SHALL be rejected with 401.

#### Scenario: Authenticated write records owner
- **WHEN** an authenticated user creates user-private data
- **THEN** the new row SHALL carry that user's `user_id`

#### Scenario: Anonymous write rejected
- **WHEN** an anonymous client attempts to create user-private data or trigger an LLM question
- **THEN** the system SHALL respond 401 and SHALL NOT create any row

### Requirement: Tags are isolated per user
Tags SHALL be isolated per user. The `tags` uniqueness constraint SHALL be `(user_id, name)` instead of a global unique `name`, so two different users MAY each have a tag with the same name. A paper's `paper_tags` associations are owned via their tag's `user_id`. A paper's displayed tags SHALL be only the current user's tags for that paper; anonymous users SHALL see no tags on papers.

#### Scenario: Two users with the same tag name
- **WHEN** user A and user B each create a tag named "ML"
- **THEN** both tags SHALL exist as distinct rows owned by their respective users

#### Scenario: Paper list shows only current user's tags
- **WHEN** an authenticated user views the paper list or a paper detail page
- **THEN** each paper SHALL display only that user's tags applied to it

#### Scenario: Anonymous sees no tags
- **WHEN** an anonymous user views the paper list or a paper detail page
- **THEN** no tags SHALL be displayed on any paper

### Requirement: External API data attributed to token owner
Each `api_tokens` row SHALL have an owning `user_id`. A request authenticated by a Bearer token SHALL act as that token's owning user, so any tags or other user-private data created via the External API SHALL be owned by that user.

#### Scenario: Token-created tag owned by token user
- **WHEN** an External API request with a Bearer token creates or assigns a tag
- **THEN** the tag SHALL be created/looked up within the token owner's tag set and owned by that user

#### Scenario: Zotero sync scoped to token user
- **WHEN** the Zotero plugin syncs tags using its Bearer token
- **THEN** the synced tags SHALL belong to the token's owning user, isolated from other users' tags

### Requirement: One-time migration of existing data to admin
The migration that introduces ownership SHALL assign all existing rows with null `user_id` in `tags`, `highlights`, `api_tokens`, and free `qa_entries` to the seeded admin user. Existing `template` `qa_entries` SHALL remain unowned (null).

#### Scenario: Existing private data migrated to admin
- **WHEN** the ownership migration runs on a database with pre-existing tags, free QA, highlights, and tokens
- **THEN** all those rows SHALL be assigned `user_id` equal to the seeded admin's id

#### Scenario: Existing template QA stays public
- **WHEN** the migration runs
- **THEN** existing `template` qa_entries SHALL keep `user_id` null and remain publicly viewable

### Requirement: tags_json global cache deprecated
Because tags are now per-user, the `papers.tags_json` global cache SHALL no longer be the source of truth for tag display. The system SHALL compute a paper's tags for the current user by joining `paper_tags` and `tags` filtered by `user_id`. The `tags_json` column MAY remain in the schema unused; the previous global sync of `tags_json` SHALL no longer be relied upon.

#### Scenario: Per-user tag computation replaces cache
- **WHEN** the paper list is rendered for an authenticated user
- **THEN** each paper's tags SHALL be computed by joining `paper_tags`→`tags` filtered to the current user, not read from the global `tags_json`

### Requirement: QA Result streams follow entry visibility
An authenticated viewer SHALL be allowed to subscribe only to a Result whose parent QA entry is visible to that viewer through the `all`-scope read rules: preset entries, the viewer's own free entries, free entries of users who share Q&A, and — for an admin — every free entry. Anonymous viewers SHALL NOT open Result SSE streams, and a denied request SHALL NOT disclose whether a private Result exists.

#### Scenario: Viewer subscribes to a visible all-scope Result
- **WHEN** a logged-in viewer can read another user's free QA entry through all scope
- **THEN** the viewer MAY observe that Result stream but SHALL receive no mutation authority

#### Scenario: Viewer denied a non-shared Result
- **WHEN** a non-admin requests the stream of a Result whose free entry belongs to a user who does not share Q&A
- **THEN** the request SHALL be rejected as not found

#### Scenario: Anonymous viewer requests a stream
- **WHEN** an anonymous viewer requests a Result SSE stream, including for a preset entry
- **THEN** the request SHALL be rejected before opening the stream

### Requirement: QA Result cancellation is manager-scoped
Cancelling a free-QA Result SHALL require the entry owner or an admin. Cancelling a shared preset Result SHALL require the exact initiating user recorded on that Result or an admin. Read access alone SHALL NOT grant cancellation authority.

#### Scenario: Non-owner watches but cannot cancel
- **WHEN** a normal user can read another user's active Result through all scope
- **THEN** the user MAY observe it but SHALL NOT be able to cancel it

#### Scenario: Preset initiator cancels own run
- **WHEN** the user who initiated an active preset Result requests cancellation
- **THEN** the system SHALL cancel that exact run

#### Scenario: Admin cancels active Result
- **WHEN** an admin cancels any active Result
- **THEN** the system SHALL authorize the exact cancellation

### Requirement: All-scope QA remains read-only for non-owners
Reading another user's QA SHALL NOT grant mutation rights. User QA regeneration/deletion SHALL be limited to its owner or an administrator, and unauthorized mutation SHALL return 404 without changing data.

#### Scenario: Non-owner views another question
- **WHEN** a non-admin opens another user's QA through all scope
- **THEN** the question and results SHALL be readable but management actions SHALL be unavailable

#### Scenario: Non-owner calls mutation API
- **WHEN** that viewer directly calls regenerate or delete
- **THEN** the backend SHALL return 404 and make no change

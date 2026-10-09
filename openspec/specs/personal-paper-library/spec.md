# personal-paper-library Specification

## Purpose
TBD - created by archiving change add-personal-paper-library. Update Purpose after archive.

## Requirements

### Requirement: User–paper relationship table
The system SHALL store per-user, per-paper relationship state in a `user_papers` table with a composite primary key `(user_id, paper_id)`, an integer `in_library` flag (1 = the paper is in the user's own list), `created_at` and `updated_at`. Rows SHALL be deleted when either the user or the paper is deleted. A user's library is the set of papers whose `user_papers` row has `in_library = 1`. Library membership SHALL be private: no API SHALL expose another user's library membership.

#### Scenario: Removing keeps the relationship row
- **WHEN** a user removes a paper from their library
- **THEN** the row's `in_library` SHALL become 0, and the paper and all of that user's tags, notes, Q&A, highlights and reference links on it SHALL remain unchanged

#### Scenario: Paper deletion removes relationship rows
- **WHEN** a paper is deleted site-wide
- **THEN** all `user_papers` rows for that paper SHALL be removed

### Requirement: Mine/all paper list scope
`GET /api/papers` SHALL accept `scope=mine|all`. For a logged-in caller, the default SHALL be `mine`, which returns only papers in the caller's library. `all` SHALL return the site-wide list with the existing filters (search, tags, listed mode, sorting, pagination). For an anonymous caller, the scope SHALL always be `all`. Every paper returned by `GET /api/papers` and `GET /api/papers/:id` SHALL include a boolean `in_library` for the caller, which is `false` for anonymous callers. All other filters SHALL combine with the scope.

#### Scenario: Mine excludes others' papers
- **WHEN** user B adds a paper and user A lists papers with the default scope
- **THEN** user A SHALL NOT see that paper unless it is in user A's library

#### Scenario: All shows everything
- **WHEN** user A lists papers with `scope=all`
- **THEN** user A SHALL see every paper matching the filters, each with `in_library` reflecting user A's library

### Requirement: Adding papers to the library
Each of the following actions SHALL put the paper in the acting user's library (`in_library = 1`), whether the paper was newly created or already existed site-wide:
- `POST /api/papers`
- `POST /api/papers/open-arxiv`
- the one-click conference ingest of a listed paper
- `POST /external-api/papers` with a token bound to a user

`PUT /api/papers/:id/library` SHALL add an existing paper to the caller's library. `DELETE /api/papers/:id/library` SHALL remove it. Both SHALL require a logged-in user, SHALL return 404 for an unknown paper, SHALL be idempotent, and SHALL return `{ paper_id, in_library }`. Tagging, notes, Q&A, highlights and reference links SHALL NOT change library membership.

#### Scenario: Adding an existing paper binds it
- **WHEN** user A adds arXiv `1706.03762`, which user B had already added
- **THEN** no duplicate paper SHALL be created, and the paper SHALL appear in user A's `mine` list

#### Scenario: Add from the all view
- **WHEN** user A calls `PUT /api/papers/:id/library` on a paper outside their library
- **THEN** the paper SHALL appear in user A's `mine` list

### Requirement: Starter paper
`config.yml` SHALL accept `library.starter_arxiv_id`, defaulting to `1706.03762` ("Attention Is All You Need"). An empty value SHALL disable the starter paper.
- At startup, if the `papers` table is empty, the system SHALL ingest the starter paper and add it to every existing user's library.
- Whenever a user is created (by an admin or as the bootstrap admin), the system SHALL add the starter paper to the new user's library if a paper with that arXiv id exists.

#### Scenario: Empty database
- **WHEN** the server starts with no papers
- **THEN** the starter paper SHALL be created and be in every existing user's library

#### Scenario: New user
- **WHEN** an admin creates a user and the starter paper exists
- **THEN** the new user's `mine` list SHALL contain exactly the starter paper

### Requirement: Library backfill for existing users
The migration that introduces `user_papers` SHALL initialize each existing user's library with:
- the paper whose `arxiv_id` is `1706.03762`, if present
- every paper the user has tagged
- every paper they have a note on
- every paper with a free Q&A entry they own
- every paper with a Q&A run they requested
- every paper with a highlight they made (via the highlight's Q&A result, or its `/papers/<id>` pathname)
- every paper with a reference link they added

It SHALL NOT add papers the user never interacted with.

#### Scenario: Interaction-based backfill
- **WHEN** the migration runs and user A has a note on paper 5 and nothing on paper 9
- **THEN** paper 5 SHALL be in user A's library and paper 9 SHALL NOT

### Requirement: Paper list and detail UI
The paper list page SHALL show a Mine/All toggle, defaulting to Mine and remembered per browser. In the All view, papers in the caller's library SHALL be marked, and other papers SHALL offer an action to add them to the caller's list. The paper detail page SHALL offer add to / remove from my list for logged-in users. Fetching (promoting) a metadata-only paper from the list or detail page SHALL also add it to the acting user's list.

#### Scenario: Toggle to all and add
- **WHEN** a user switches to All and adds a paper they do not have
- **THEN** the paper SHALL be marked as in their list, and it SHALL appear after switching back to Mine

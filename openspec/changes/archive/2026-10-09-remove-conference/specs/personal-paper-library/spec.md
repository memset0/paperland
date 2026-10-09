## MODIFIED Requirements

### Requirement: Adding papers to the library
Each of the following actions SHALL put the paper in the acting user's library (`in_library = 1`), whether the paper was newly created or already existed site-wide:
- `POST /api/papers`
- `POST /api/papers/open-arxiv`
- `POST /external-api/papers` with a token bound to a user

`PUT /api/papers/:id/library` SHALL add an existing paper to the caller's library. `DELETE /api/papers/:id/library` SHALL remove it. Both SHALL require a logged-in user, SHALL return 404 for an unknown paper, SHALL be idempotent, and SHALL return `{ paper_id, in_library }`. Tagging, notes, Q&A, highlights and reference links SHALL NOT change library membership.

#### Scenario: Adding an existing paper binds it
- **WHEN** user A adds arXiv `1706.03762`, which user B had already added
- **THEN** no duplicate paper SHALL be created, and the paper SHALL appear in user A's `mine` list

#### Scenario: Add from the all view
- **WHEN** user A calls `PUT /api/papers/:id/library` on a paper outside their library
- **THEN** the paper SHALL appear in user A's `mine` list

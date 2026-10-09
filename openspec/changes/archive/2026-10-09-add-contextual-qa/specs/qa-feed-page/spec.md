## MODIFIED Requirements

### Requirement: QA feed API endpoint
The system SHALL provide `GET /api/qa/free` that returns free QA entries across all papers, ordered by `created_at` descending, with paper info, **creator identity**, and results included, **paginated** via `page` (default 1) and `page_size` (default 20) query parameters. The endpoint SHALL accept an optional `scope` query parameter with value `mine` (default) or `all`. `scope=mine` SHALL return only entries owned by the current user. `scope=all` SHALL follow the uniform all-scope rules of the `data-sharing-preferences` capability: for a non-admin, the caller's own entries plus entries of users whose `qa` sharing switch is on; for an admin, every user's entries. Each returned entry SHALL include `user_id`, `username` (or `null` when unresolvable), `shared`, `instruction`, `inputs`, `parent_entry_id`, and its number of follow-ups; its `results` SHALL exclude soft-deleted Results. The response SHALL be a `{ data, pagination }` envelope whose `pagination` object contains `page`, `page_size`, `total`, and `total_pages`, with `total` counting only entries visible under the requested scope. The endpoint SHALL require authentication.

#### Scenario: Fetch own free QA entries (paginated)
- **WHEN** an authenticated user calls `GET /api/qa/free?page=1&page_size=20` (no `scope`, or `scope=mine`)
- **THEN** the response SHALL return `{ "data": [...], "pagination": { "page", "page_size", "total", "total_pages" } }`, where `data` contains at most `page_size` of that user's free QA entries (each with fields `entry_id`, `paper_id`, `paper_title`, `status`, `error`, `prompt`, `created_at`, `results`, `user_id`, `username`, `shared`, `instruction`, `inputs`, `parent_entry_id`, `followup_count`) and `total` is the user's full free-QA count

#### Scenario: Non-admin requesting all scope is downgraded
- **WHEN** a non-admin calls `GET /api/qa/free?scope=all`, user A shares Q&A, and user C does not
- **THEN** the all scope SHALL be limited to the caller's and user A's entries and SHALL NOT include user C's entries, and `total` SHALL exclude user C's entries

#### Scenario: Admin fetches all users' free QA entries
- **WHEN** an admin calls `GET /api/qa/free?scope=all`
- **THEN** the response SHALL include free QA entries created by every user, with `shared: false` on entries whose owner does not share Q&A

#### Scenario: Creator identity included
- **WHEN** any free QA entry is returned
- **THEN** the entry SHALL include `user_id` and `username` for the creator, or both `null` when the entry has no resolvable creator

#### Scenario: Default pagination
- **WHEN** an authenticated user calls `GET /api/qa/free` with no pagination params
- **THEN** the system SHALL default to `page=1` and `page_size=20`

#### Scenario: Ordering by creation time
- **WHEN** the result set has multiple free QA entries across different papers (and, for `scope=all`, across different users)
- **THEN** entries SHALL be ordered by `created_at` descending (newest first) before pagination is applied

#### Scenario: No free QA entries
- **WHEN** the result set for the requested scope is empty
- **THEN** the response SHALL return `{ "data": [], "pagination": { "page": 1, "page_size": 20, "total": 0, "total_pages": 0 } }`

#### Scenario: Anonymous request rejected
- **WHEN** an anonymous client calls `GET /api/qa/free`
- **THEN** the system SHALL respond with 401 Unauthorized

#### Scenario: Soft-deleted results omitted
- **WHEN** one of an entry's two Results has been soft-deleted
- **THEN** the entry's `results` SHALL contain only the other Result

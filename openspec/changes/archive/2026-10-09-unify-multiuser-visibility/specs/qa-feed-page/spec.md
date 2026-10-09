## MODIFIED Requirements

### Requirement: QA feed API endpoint
The system SHALL provide `GET /api/qa/free` that returns free QA entries across all papers, ordered by `created_at` descending, with paper info, **creator identity**, and results included, **paginated** via `page` (default 1) and `page_size` (default 20) query parameters. The endpoint SHALL accept an optional `scope` query parameter with value `mine` (default) or `all`. `scope=mine` SHALL return only entries owned by the current user. `scope=all` SHALL follow the uniform all-scope rules of the `data-sharing-preferences` capability: for a non-admin, the caller's own entries plus entries of users whose `qa` sharing switch is on; for an admin, every user's entries. Each returned entry SHALL include `user_id`, `username` (or `null` when unresolvable), and `shared`. The response SHALL be a `{ data, pagination }` envelope whose `pagination` object contains `page`, `page_size`, `total`, and `total_pages`, with `total` counting only entries visible under the requested scope. The endpoint SHALL require authentication.

#### Scenario: Fetch own free QA entries (paginated)
- **WHEN** an authenticated user calls `GET /api/qa/free?page=1&page_size=20` (no `scope`, or `scope=mine`)
- **THEN** the response SHALL return `{ "data": [...], "pagination": { "page", "page_size", "total", "total_pages" } }`, where `data` contains at most `page_size` of that user's free QA entries (each with fields `entry_id`, `paper_id`, `paper_title`, `status`, `error`, `prompt`, `created_at`, `results`, `user_id`, `username`, `shared`) and `total` is the user's full free-QA count

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

## REMOVED Requirements

### Requirement: QA feed page requires login
**Reason**: The scope toggle is no longer admin-only and All now follows sharing switches; replaced by "QA feed page access and scope toggle".
**Migration**: Login gating is unchanged; see the added requirement.

## ADDED Requirements

### Requirement: QA feed page access and scope toggle
The `/qa` page SHALL require an authenticated user. The sidebar Q&A entry SHALL remain visible to anonymous users, but selecting it SHALL prompt for login instead of opening the feed. By default the feed SHALL display only the current user's free QA entries. Every authenticated user SHALL be offered a Mine / All scope toggle in the `AppPage` header `#actions` slot. In All scope, entries owned by others SHALL be labeled with their asker, and for an admin, entries with `shared: false` SHALL additionally show a "Private" marker.

#### Scenario: Authenticated user opens the feed
- **WHEN** an authenticated user navigates to `/qa`
- **THEN** the page SHALL load and display only that user's free QA entries by default

#### Scenario: Anonymous user attempts the feed
- **WHEN** an anonymous user selects the Q&A sidebar entry or navigates to `/qa`
- **THEN** the system SHALL prompt for login and SHALL NOT display any QA entries

#### Scenario: Any user switches to All
- **WHEN** a logged-in user activates All on the scope toggle
- **THEN** the page SHALL re-fetch the feed with `scope=all` from the first page and display the entries visible to that user, each labeled with its asker

#### Scenario: Admin sees private marker
- **WHEN** an admin views All and an entry belongs to a user who does not share Q&A
- **THEN** that entry SHALL show a "Private" marker

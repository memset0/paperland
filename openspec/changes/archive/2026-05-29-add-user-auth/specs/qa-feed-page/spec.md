## MODIFIED Requirements

### Requirement: QA feed API endpoint
The system SHALL provide `GET /api/qa/free` that returns the current authenticated user's free QA entries across all papers, ordered by `created_at` descending, with paper info and results included. The endpoint SHALL require authentication and SHALL return only entries owned by the current user.

#### Scenario: Fetch own free QA entries
- **WHEN** an authenticated user calls `GET /api/qa/free`
- **THEN** the response SHALL return `{ "data": [...] }` containing only that user's free QA entries with fields: `entry_id`, `paper_id`, `paper_title`, `status`, `error`, `prompt`, `created_at`, and `results` array

#### Scenario: Ordering by creation time
- **WHEN** the current user has multiple free QA entries across different papers
- **THEN** entries SHALL be ordered by `created_at` descending (newest first)

#### Scenario: No free QA entries
- **WHEN** the current user has no free QA entries
- **THEN** the response SHALL return `{ "data": [] }`

#### Scenario: Anonymous request rejected
- **WHEN** an anonymous client calls `GET /api/qa/free`
- **THEN** the system SHALL respond with 401 Unauthorized

## ADDED Requirements

### Requirement: QA feed page requires login
The `/qa` page SHALL require an authenticated user. The sidebar Q&A entry SHALL remain visible to anonymous users, but selecting it SHALL prompt for login instead of opening the feed. The feed SHALL display only the current user's free QA entries.

#### Scenario: Authenticated user opens the feed
- **WHEN** an authenticated user navigates to `/qa`
- **THEN** the page SHALL load and display only that user's free QA entries

#### Scenario: Anonymous user attempts the feed
- **WHEN** an anonymous user selects the Q&A sidebar entry or navigates to `/qa`
- **THEN** the system SHALL prompt for login and SHALL NOT display any QA entries

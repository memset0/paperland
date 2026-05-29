# qa-feed-page Specification

## Purpose
Provides a dedicated /qa page that displays all free QA entries across all papers as a chronological feed, with collapsible panels supporting full QA management actions.
## Requirements
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

### Requirement: QA feed page displays chronological list
The /qa page SHALL display all free QA entries as a flat chronological list of collapsible panels, ordered by creation time (newest first).

#### Scenario: Page load with entries
- **WHEN** a user navigates to /qa
- **THEN** the page SHALL load all free QA entries and display each as a collapsible panel

#### Scenario: Empty state
- **WHEN** no free QA entries exist
- **THEN** the page SHALL display an appropriate empty state message

### Requirement: QA feed panel structure
Each QA entry panel SHALL display a header with the paper title (as a clickable link to `/papers/:id`), the question text, status indicator, and creation time. The panel body SHALL be collapsed by default.

#### Scenario: Panel header content
- **WHEN** a QA entry for paper "Attention Is All You Need" with question "What is the main contribution?" is displayed
- **THEN** the panel header SHALL show the paper title as a link to the paper detail page, the question text, and the creation timestamp

#### Scenario: Panel default state
- **WHEN** the /qa page loads
- **THEN** all QA entry panels SHALL be collapsed (body hidden)

#### Scenario: Panel expand/collapse
- **WHEN** a user clicks on a collapsed panel header
- **THEN** the panel body SHALL expand to show the full QA results
- **WHEN** a user clicks on an expanded panel header
- **THEN** the panel body SHALL collapse

### Requirement: QA feed panel actions
Each expanded QA panel SHALL support all QA management actions: regenerate with model selection, delete individual results, copy answer, and pin result.

#### Scenario: Regenerate from feed panel
- **WHEN** a user clicks regenerate on a QA result in the feed panel
- **THEN** the system SHALL trigger LLM regeneration for that entry, same as on paper detail page

#### Scenario: Delete result from feed panel
- **WHEN** a user clicks delete on a QA result in the feed panel
- **THEN** the result SHALL be deleted and removed from the panel display

#### Scenario: Copy answer from feed panel
- **WHEN** a user clicks copy on a QA result
- **THEN** the answer text SHALL be copied to clipboard with visual feedback

#### Scenario: Pin result from feed panel
- **WHEN** a user clicks pin on a QA result
- **THEN** the result SHALL be pinned (sorted first among results for that entry)

### Requirement: QA feed polling
The /qa page SHALL poll for updates when any displayed QA entry has status "pending" or "running".

#### Scenario: Active entries trigger polling
- **WHEN** the feed contains entries with status "pending" or "running"
- **THEN** the page SHALL poll `GET /api/qa/free` every 3 seconds until all entries reach "done" or "failed"

#### Scenario: No active entries
- **WHEN** all feed entries have status "done" or "failed"
- **THEN** the page SHALL NOT poll

### Requirement: QA result view reuse
The feed panel body SHALL reuse the existing `QAResultView.vue` component for rendering model tabs, markdown answers, and action buttons.

#### Scenario: Result display consistency
- **WHEN** a QA entry is expanded in the feed panel
- **THEN** the results SHALL be rendered identically to how they appear on the paper detail page (same model tabs, markdown rendering, action buttons)

### Requirement: QA feed page requires login
The `/qa` page SHALL require an authenticated user. The sidebar Q&A entry SHALL remain visible to anonymous users, but selecting it SHALL prompt for login instead of opening the feed. The feed SHALL display only the current user's free QA entries.

#### Scenario: Authenticated user opens the feed
- **WHEN** an authenticated user navigates to `/qa`
- **THEN** the page SHALL load and display only that user's free QA entries

#### Scenario: Anonymous user attempts the feed
- **WHEN** an anonymous user selects the Q&A sidebar entry or navigates to `/qa`
- **THEN** the system SHALL prompt for login and SHALL NOT display any QA entries


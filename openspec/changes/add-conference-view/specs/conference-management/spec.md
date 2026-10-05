## ADDED Requirements

### Requirement: Conferences page is a top-level sibling of paper management
The system SHALL provide a `/conferences` page reachable from a top-level navigation entry placed at the same level as the「论文管理」(paper management) entry.

#### Scenario: Navigation entry exists at top level
- **WHEN** the user views the main navigation sidebar
- **THEN** a「会议」entry SHALL be present alongside「论文管理」, linking to `/conferences`

#### Scenario: Conferences entry is highlighted when active
- **WHEN** the user is on `/conferences` or any `/conferences/:id` route
- **THEN** the「会议」navigation entry SHALL be shown as active

### Requirement: Conference list shows all conferences with name and time filtering
The conference list page SHALL display all conferences and SHALL support filtering by name (search) and by time (year).

#### Scenario: List all conferences
- **WHEN** the user opens `/conferences`
- **THEN** the page SHALL fetch `GET /api/conferences` and render each conference as a clickable card

#### Scenario: Filter by name
- **WHEN** the user types a query into the name search box
- **THEN** the list SHALL show only conferences whose name matches the query

#### Scenario: Filter by time
- **WHEN** the user selects or enters a year filter
- **THEN** the list SHALL show only conferences matching that year

#### Scenario: Open a conference
- **WHEN** the user clicks a conference card
- **THEN** the app SHALL navigate to `/conferences/:id` (the conference detail page)

### Requirement: Conference CRUD via Internal API
The system SHALL provide Internal API endpoints (HTTP Basic Auth, snake_case) to create, read, update, and delete conferences.

#### Scenario: Create conference
- **WHEN** `POST /api/conferences` is called with at least `{ name }`
- **THEN** a conference is created with optional `year`, `start_date`, `end_date`, `location`, `description`, `link`, and returned with its `id`

#### Scenario: List conferences with pagination and filters
- **WHEN** `GET /api/conferences?search=&year=&page=` is called
- **THEN** the system SHALL return `{ data, pagination }` where each item includes the conference fields plus `paper_count` and per-status counts

#### Scenario: Get conference detail
- **WHEN** `GET /api/conferences/:id` is called for an existing conference
- **THEN** the system SHALL return the conference record

#### Scenario: Update conference
- **WHEN** `PATCH /api/conferences/:id` is called with changed fields
- **THEN** the system SHALL update those fields and `updated_at`

#### Scenario: Delete conference cascades only its candidates
- **WHEN** `DELETE /api/conferences/:id` is called
- **THEN** the conference and its `conference_papers` rows SHALL be deleted within a single transaction
- **AND** any already-ingested `papers` records SHALL NOT be deleted

### Requirement: Conference detail groups papers by topic with key fields
The conference detail page SHALL display the conference's papers grouped by topic, and SHALL show for each paper its title, topic, external source, and current status.

#### Scenario: Papers grouped by topic
- **WHEN** the conference detail page loads its papers via `GET /api/conferences/:id/papers`
- **THEN** papers SHALL be rendered in groups keyed by `topic`
- **AND** papers with no topic SHALL appear under a「未分类」group

#### Scenario: Each paper shows key fields
- **WHEN** a conference paper is rendered
- **THEN** it SHALL display its `title`, `topic`, a source badge (arXiv / OpenReview / Semantic Scholar), and a status badge (待确认 / 候选中 / 已入库)

#### Scenario: Ingested paper links to library
- **WHEN** a conference paper has status `ingested` and a `paper_id`
- **THEN** the UI SHALL allow navigating to that paper's detail page (`/papers/:paper_id`)

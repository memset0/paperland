## MODIFIED Requirements

### Requirement: Highlight data model
The system SHALL store highlights in a `highlights` table with fields: `id`, `user_id`, `pathname`, `content_hash`, nullable `qa_result_id`, `start_offset`, `end_offset`, `text`, `color`, `created_at`. The `user_id` SHALL reference `users.id` and identify the owner of the highlight. When present, `qa_result_id` SHALL identify the containing completed QA result; non-QA highlights SHALL keep it null. A highlight SHALL carry only a color; the system SHALL NOT read or write any per-highlight note. A legacy `note` column MAY remain physically present in the database for historical rows, but the active Drizzle schema and all queries SHALL ignore it.

#### Scenario: Highlight record structure
- **WHEN** a highlight is created
- **THEN** the record SHALL contain `user_id` (owner), `pathname` (page path without hostname), `content_hash` (MD5 of content with all whitespace removed), `start_offset` and `end_offset` (rendered text offsets), `text` (highlighted text for verification), `color` (one of yellow/green/blue/pink), and `created_at` timestamp, and SHALL NOT contain a `note`

#### Scenario: Legacy note column is ignored
- **WHEN** the `highlights` table still has a physical `note` column populated on historical rows
- **THEN** the active schema SHALL NOT select, return, or update that column, and reading a highlight SHALL never surface a note

#### Scenario: QA highlight record structure
- **WHEN** a highlight is created in QA result 75
- **THEN** it SHALL store the current owner and qa_result_id 75 together with the ordinary highlight fields, with no note

### Requirement: Create highlight
The system SHALL provide `POST /api/highlights` to create a new highlight record owned by the current authenticated user. The request body SHALL carry `{ pathname, content_hash, start_offset, end_offset, text, color, qa_result_id? }` and SHALL NOT carry a note. Anonymous requests SHALL be rejected with 401. When `qa_result_id` is supplied, the backend SHALL verify that the result exists, belongs to the pathname's paper and has the submitted content hash.

#### Scenario: Create highlight
- **WHEN** an authenticated user sends a POST request with `{ pathname, content_hash, start_offset, end_offset, text, color, qa_result_id? }`
- **THEN** the system SHALL create the highlight record with `user_id` set to that user and return it with the assigned `id` and `created_at`

#### Scenario: Note field in request is ignored
- **WHEN** a POST request body includes a `note` field (e.g. from a stale client)
- **THEN** the system SHALL ignore it and SHALL NOT persist any note

#### Scenario: Anonymous create rejected
- **WHEN** an anonymous client sends `POST /api/highlights`
- **THEN** the system SHALL respond with 401 and create nothing

#### Scenario: Create QA highlight
- **WHEN** a logged-in user submits a valid QA highlight
- **THEN** it SHALL be stored with that result attribution

#### Scenario: Invalid QA attribution
- **WHEN** result paper or hash does not match
- **THEN** the request SHALL be rejected without creating data

## ADDED Requirements

### Requirement: Safe legacy attribution backfill
An existing highlight SHALL be linked to a QA result only when pathname and content hash identify exactly one result. Ambiguous, stale, or non-QA rows SHALL remain unchanged.

#### Scenario: Unique historical match
- **WHEN** exactly one result on the pathname's paper matches the hash
- **THEN** migration SHALL set that result id while preserving all highlight fields

#### Scenario: Ambiguous historical match
- **WHEN** several results match equally
- **THEN** migration SHALL leave attribution null

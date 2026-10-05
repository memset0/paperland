## MODIFIED Requirements

### Requirement: Highlight data model
The system SHALL store highlights with `id`, `user_id`, `pathname`, `content_hash`, optional `qa_result_id`, offsets, text, color, and created_at. `qa_result_id` SHALL identify the containing QA result when present and be null for other content. The legacy note column remains ignored.

#### Scenario: Highlight record structure
- **WHEN** a highlight is created in QA result 75
- **THEN** it SHALL store the current owner, `qa_result_id=75`, pathname, hash, offsets, text, color, and timestamp, with no note

#### Scenario: Legacy note column is ignored
- **WHEN** a physical legacy note column exists
- **THEN** active reads/writes SHALL continue to ignore it

### Requirement: Create highlight
`POST /api/highlights` SHALL accept optional `qa_result_id`. When supplied, the backend SHALL verify that the result exists, belongs to the pathname's paper, and has the submitted content hash. Login/owner behavior and ordinary highlights SHALL remain unchanged.

#### Scenario: Create highlight
- **WHEN** a logged-in user submits a valid QA highlight
- **THEN** it SHALL be stored with that result attribution

#### Scenario: Note field in request is ignored
- **WHEN** a stale client sends note
- **THEN** it SHALL remain ignored

#### Scenario: Anonymous create rejected
- **WHEN** an anonymous user submits a highlight
- **THEN** the request SHALL return 401

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


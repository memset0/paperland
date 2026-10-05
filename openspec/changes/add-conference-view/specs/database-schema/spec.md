## ADDED Requirements

### Requirement: Conferences table
The database SHALL have a `conferences` table with columns: `id` (integer, primary key, autoincrement), `name` (text, not null), `year` (integer, nullable), `start_date` (text, nullable, ISO 8601), `end_date` (text, nullable, ISO 8601), `location` (text, nullable), `description` (text, nullable), `link` (text, nullable), `created_at` (text, not null, ISO 8601), `updated_at` (text, not null, ISO 8601).

#### Scenario: Create conference
- **WHEN** a conference is inserted with name "NeurIPS 2024" and year 2024
- **THEN** the conference SHALL be stored and retrievable by id, with `updated_at` set equal to `created_at`

#### Scenario: Conference with only a name
- **WHEN** a conference is inserted with only `name` and the other optional fields omitted
- **THEN** the conference SHALL be stored with `year`, `start_date`, `end_date`, `location`, `description`, and `link` as null

### Requirement: Conference_papers candidate pool table
The database SHALL have a `conference_papers` table representing the conference candidate pool, with columns: `id` (integer, primary key, autoincrement), `conference_id` (integer, not null, foreign key to conferences.id), `title` (text, not null), `topic` (text, nullable), `authors` (text, nullable, JSON array), `abstract` (text, nullable), `source` (text, nullable; one of `arxiv`, `openreview`, `semantic_scholar`), `external_id` (text, nullable), `link` (text, nullable), `status` (text, not null, default `pending`; one of `pending`, `candidate`, `ingested`), `paper_id` (integer, nullable, foreign key to papers.id), `metadata` (text, nullable, JSON), `created_at` (text, not null, ISO 8601), `updated_at` (text, not null, ISO 8601). The table SHALL have an index on (`conference_id`, `status`).

#### Scenario: Insert candidate paper
- **WHEN** a row is inserted with conference_id 1, title "Test", topic "Alignment", source "arxiv", external_id "2401.12345"
- **THEN** the row SHALL be stored with status defaulting to `pending` and `paper_id` null

#### Scenario: Candidate links to ingested paper
- **WHEN** a candidate is ingested and its `paper_id` is set to an existing papers.id and `status` to `ingested`
- **THEN** the candidate SHALL reference that paper and remain queryable by conference

#### Scenario: Authors and metadata stored as JSON
- **WHEN** a candidate is inserted with authors `["A","B"]` and metadata `{"raw": {...}}`
- **THEN** the `authors` and `metadata` fields SHALL store the JSON strings and be parseable back to the original values

#### Scenario: Deleting a conference removes its candidates
- **WHEN** a conference is deleted
- **THEN** all `conference_papers` rows for that conference SHALL be deleted within the same transaction
- **AND** any `papers` rows referenced by ingested candidates SHALL NOT be deleted

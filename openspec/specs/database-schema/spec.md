# database-schema Specification

## Purpose
TBD - created by archiving change project-init. Update Purpose after archive.
## Requirements
### Requirement: Papers table
The database SHALL have a `papers` table with columns: `id` (integer, primary key, autoincrement), `arxiv_id` (text, nullable, unique), `corpus_id` (text, nullable, unique), `title` (text, not null), `authors` (text, not null, JSON array), `abstract` (text, nullable), `contents` (text, nullable, JSON object), `pdf_path` (text, nullable), `metadata` (text, nullable, JSON), `created_at` (text, not null, ISO 8601).

#### Scenario: Create paper with arxiv_id
- **WHEN** a paper is inserted with arxiv_id "2401.12345" and title "Test Paper"
- **THEN** the paper SHALL be stored and retrievable by id or arxiv_id

#### Scenario: Unique constraint on arxiv_id
- **WHEN** a paper with arxiv_id "2401.12345" already exists and another insert attempts the same arxiv_id
- **THEN** the database SHALL reject the insert with a unique constraint violation

#### Scenario: Contents stored as JSON
- **WHEN** a paper is inserted with contents `{"user_input": "some text", "pdf_parsed": null}`
- **THEN** the contents field SHALL store the JSON string and it SHALL be parseable back to the original object

### Requirement: Tags table
The database SHALL have a `tags` table with columns: `id` (integer, primary key, autoincrement), `name` (text, unique, not null).

#### Scenario: Create tag
- **WHEN** a tag "transformer" is inserted
- **THEN** the tag SHALL be stored with an auto-generated id

### Requirement: Paper_tags junction table
The database SHALL have a `paper_tags` table with columns: `paper_id` (integer, foreign key to papers.id), `tag_id` (integer, foreign key to tags.id), with a composite primary key on (paper_id, tag_id).

#### Scenario: Associate paper with tag
- **WHEN** paper 1 is associated with tag 2
- **THEN** a row (paper_id=1, tag_id=2) SHALL exist in paper_tags

### Requirement: QA entries table
The database SHALL have a `qa_entries` table with columns: `id` (integer, primary key, autoincrement), `paper_id` (integer, foreign key to papers.id, not null), `type` (text, not null, "template" or "free"), `template_name` (text, nullable), `status` (text, not null, default "pending"), `error` (text, nullable), `created_at` (text, not null, ISO 8601).

#### Scenario: Template QA entry
- **WHEN** a QA entry is created with type "template" and template_name "abstract" for paper 1
- **THEN** the entry SHALL be stored and queryable by paper_id and template_name, with `created_at` set to the current ISO 8601 timestamp

#### Scenario: Free QA entry
- **WHEN** a QA entry is created with type "free" for paper 1
- **THEN** the entry SHALL be stored with template_name as null, an auto-incremented id, and `created_at` set to the current ISO 8601 timestamp

#### Scenario: Backfill existing entries
- **WHEN** the migration runs on a database with existing `qa_entries` rows that have no `created_at`
- **THEN** the migration SHALL backfill `created_at` using the earliest `completed_at` from associated `qa_results`, or the current timestamp if no results exist

### Requirement: QA results table
The database SHALL have a `qa_results` table with columns: `id` (integer, primary key, autoincrement), `qa_entry_id` (integer, foreign key to qa_entries.id, not null), `prompt` (text, not null), `answer` (text, not null), `model_name` (text, not null), `completed_at` (text, not null, ISO 8601).

#### Scenario: Multiple results per entry
- **WHEN** two QA results are inserted for the same qa_entry_id with different model_names
- **THEN** both results SHALL be stored and retrievable, ordered by completed_at

### Requirement: Service executions table
The database SHALL have a `service_executions` table with columns: `id` (integer, primary key, autoincrement), `service_name` (text, not null), `paper_id` (integer, foreign key to papers.id, not null), `status` (text, not null), `progress` (integer, not null, default 0), `created_at` (text, not null), `finished_at` (text, nullable), `result` (text, nullable), `error` (text, nullable).

#### Scenario: Track service execution
- **WHEN** a service execution is created with service_name "arxiv_service" and status "pending"
- **THEN** the execution SHALL be stored and its status SHALL be updatable to "running", "done", or "failed"

### Requirement: API tokens table
The database SHALL have an `api_tokens` table with columns: `id` (integer, primary key, autoincrement), `token` (text, unique, not null), `created_at` (text, not null), `revoked_at` (text, nullable).

#### Scenario: Create and revoke token
- **WHEN** a token is created and later revoked by setting revoked_at
- **THEN** the token SHALL have a non-null revoked_at timestamp and SHALL be considered invalid

### Requirement: SQLite WAL mode
The database SHALL be initialized with WAL (Write-Ahead Logging) mode enabled for better concurrent read performance.

#### Scenario: WAL mode enabled
- **WHEN** the database connection is established
- **THEN** `PRAGMA journal_mode=WAL` SHALL be executed

### Requirement: Drizzle migrations
The database schema SHALL be managed via Drizzle Kit migrations stored in `packages/backend/src/db/migrations/`.

#### Scenario: Run migrations on startup
- **WHEN** the server starts
- **THEN** pending Drizzle migrations SHALL be applied automatically before the server begins accepting requests


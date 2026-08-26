# database-schema Specification

## Purpose
TBD - created by archiving change project-init. Update Purpose after archive.
## Requirements
### Requirement: Papers table
The database SHALL have a `papers` table with columns: `id` (integer, primary key, autoincrement), `arxiv_id` (text, nullable, unique), `corpus_id` (text, nullable, unique), `title` (text, not null), `authors` (text, not null, JSON array), `abstract` (text, nullable), `contents` (text, nullable, JSON object), `pdf_path` (text, nullable), `metadata` (text, nullable, JSON), `link` (text, nullable), `created_at` (text, not null, ISO 8601), `updated_at` (text, not null, ISO 8601).

Deletion of a paper SHALL be performed via application-level cascade within a single database transaction. The application SHALL delete all related records from `qa_results` (via `qa_entries`), `qa_entries`, `service_executions`, `paper_tags`, and `highlights` (matched by `pdf_path`) before deleting the paper record. No database-level ON DELETE CASCADE constraints are required.

#### Scenario: Create paper with arxiv_id
- **WHEN** a paper is inserted with arxiv_id "2401.12345" and title "Test Paper"
- **THEN** the paper SHALL be stored and retrievable by id or arxiv_id, with `updated_at` set equal to `created_at`

#### Scenario: Unique constraint on arxiv_id
- **WHEN** a paper with arxiv_id "2401.12345" already exists and another insert attempts the same arxiv_id
- **THEN** the database SHALL reject the insert with a unique constraint violation

#### Scenario: Contents stored as JSON
- **WHEN** a paper is inserted with contents `{"user_input": "some text", "pdf_parsed": null}`
- **THEN** the contents field SHALL store the JSON string and it SHALL be parseable back to the original object

#### Scenario: Cascade delete paper and all associations
- **WHEN** a paper with id 5 is deleted and it has qa_entries, qa_results, service_executions, paper_tags, and highlights
- **THEN** all associated records SHALL be deleted within the same transaction before the paper record is removed
- **AND** the transaction SHALL either fully complete or fully roll back on error

### Requirement: Tags table schema
The `tags` table SHALL include id, name, and color columns.

#### Scenario: Tag record structure
- **WHEN** a tag exists in the database
- **THEN** it has columns: `id` (integer, auto-increment PK), `name` (text, unique, not null), `color` (text, not null, default empty string)

### Requirement: Papers table includes tags_json
The `papers` table SHALL include a `tags_json` column for denormalized tag storage.

#### Scenario: Papers tags_json column
- **WHEN** a paper exists in the database
- **THEN** it has a `tags_json` (text, nullable) column storing JSON array of `[{"id": number, "name": string}]`

#### Scenario: Migration backfills tags_json
- **WHEN** the migration runs on existing data
- **THEN** existing papers have their tags_json populated from current paper_tags relationships

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

### Requirement: Translations table
The database SHALL have a `translations` table with columns: `id` (integer, primary key, autoincrement), `source_hash` (text, not null, SHA-256 hex of the normalized source text), `source_text` (text, not null, the normalized source), `source_lang` (text, not null, default "en"), `target_lang` (text, not null, default "zh"), `translated_text` (text, not null), `model_name` (text, nullable), `created_at` (text, not null, ISO 8601), `updated_at` (text, not null, ISO 8601). The table SHALL enforce a unique constraint on `(source_hash, target_lang)`, and SHALL have an index on `source_hash` for lookup by hash. This is an additive migration (CREATE TABLE only); no existing tables are changed and no backfill is required.

#### Scenario: Create translation cache row
- **WHEN** a translation is inserted with a `source_hash`, `source_text`, `translated_text`, `source_lang` "en", and `target_lang` "zh"
- **THEN** the row SHALL be stored and retrievable by `(source_hash, target_lang)`, with `updated_at` set equal to `created_at`

#### Scenario: Unique constraint on source_hash + target_lang
- **WHEN** a translation for a given `(source_hash, target_lang)` already exists and another insert attempts the same pair
- **THEN** the database SHALL reject the insert with a unique constraint violation

#### Scenario: Re-translate updates the same row
- **WHEN** a re-translation is persisted for an existing `(source_hash, target_lang)`
- **THEN** the existing row's `translated_text`, `model_name`, and `updated_at` SHALL be updated in place and no duplicate row SHALL be created

#### Scenario: Lookup by hash
- **WHEN** a translation is queried by its `source_hash`
- **THEN** the matching cached row(s) SHALL be returned using the `source_hash` index

### Requirement: QA Result runtime lifecycle columns
The existing `qa_results` table SHALL additionally store `status`, `error`, `requested_by_user_id`, `streaming_capable`, `created_at`, `started_at`, `first_chunk_at`, `finished_at`, and `updated_at`. `answer` SHALL hold the latest persisted partial or authoritative final text. Existing `prompt`, `model_name`, `execution_id`, `content_hash`, `completed_at`, ids, and entry relationships SHALL be retained. The migration SHALL backfill every historical successful Result as `done`, using its existing completion time for the new created/updated/finished timestamps, without changing historical answer content or ids.

#### Scenario: Existing successful Result is migrated
- **WHEN** the migration runs on a Result that existed before per-run state
- **THEN** it SHALL remain linked to the same entry/execution with the same prompt, answer, model, completion time, and content hash, and SHALL read as `done`

#### Scenario: Active Result stores partial output
- **WHEN** a new Result has begun streaming but has not completed
- **THEN** its row SHALL contain `status='streaming'`, the latest persisted partial `answer`, a first-chunk timestamp, and no successful final content hash

#### Scenario: Initiating user is deleted
- **WHEN** a user who initiated a shared preset Result is deleted
- **THEN** the Result history SHALL remain and `requested_by_user_id` SHALL safely become null rather than deleting the Result

### Requirement: QA Result lifecycle migration is additive and recoverable
The migration SHALL add lifecycle fields to the existing Result table without replacing the QA entry/result cardinality or creating a second answer store. A verified online backup and a disposable-copy migration check SHALL precede live application.

#### Scenario: Migration preserves QA history
- **WHEN** pre/post migration counts and identity/content hashes are compared
- **THEN** all existing QA entry ids, Result ids, prompts, answers, execution links, and content hashes SHALL match

### Requirement: Thinking duration is derived from lifecycle timestamps
The database SHALL use `started_at`, `first_chunk_at`, and `finished_at` as the source of truth for thinking duration and SHALL NOT store a redundant mutable duration column. Internal serializers MAY expose a derived `thinking_duration_ms`: while awaiting output it SHALL represent elapsed time through the server's current time, after first output it SHALL equal `first_chunk_at - started_at`, and when a no-output run terminates it SHALL equal `finished_at - started_at`.

#### Scenario: Streaming Result thinking duration
- **WHEN** a Result has both `started_at` and `first_chunk_at`
- **THEN** its thinking duration SHALL be derived from their difference and remain frozen while answer output continues

#### Scenario: Awaiting Result thinking duration
- **WHEN** a Result is still awaiting its first output
- **THEN** its serialized elapsed thinking duration SHALL advance without writing a new database value each second

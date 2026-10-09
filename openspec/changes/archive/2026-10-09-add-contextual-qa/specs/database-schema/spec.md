## MODIFIED Requirements

### Requirement: Papers table
The database SHALL have a `papers` table with columns: `id` (integer, primary key, autoincrement), `arxiv_id` (text, nullable, unique), `corpus_id` (text, nullable, unique), `title` (text, not null), `authors` (text, not null, JSON array), `abstract` (text, nullable), `contents` (text, nullable, JSON object), `pdf_path` (text, nullable), `metadata` (text, nullable, JSON), `link` (text, nullable), `created_at` (text, not null, ISO 8601), `updated_at` (text, not null, ISO 8601).

Deletion of a paper SHALL be performed via application-level cascade within a single database transaction. The application SHALL delete all related records from `qa_result_cites` and `qa_results` (via `qa_entries`, including soft-deleted results), `qa_entries`, `service_executions`, `paper_tags`, and `highlights` (matched by `pdf_path`) before deleting the paper record. No database-level ON DELETE CASCADE constraints are required.

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
- **WHEN** a paper with id 5 is deleted and it has qa_entries, qa_results, qa_result_cites, service_executions, paper_tags, and highlights
- **THEN** all associated records SHALL be deleted within the same transaction before the paper record is removed
- **AND** the transaction SHALL either fully complete or fully roll back on error

### Requirement: QA entries table
The database SHALL have a `qa_entries` table with columns: `id` (integer, primary key, autoincrement), `paper_id` (integer, foreign key to papers.id, not null), `type` (text, not null, "template" or "free"), `template_name` (text, nullable), `status` (text, not null, default "pending"), `error` (text, nullable), `created_at` (text, not null, ISO 8601), `instruction` (text, nullable: the system prompt name; null means the default), `inputs` (text, nullable, JSON array of immutable inputs — `text_selection`, `image` with an image-host id, and at most one `history` input referencing a parent Result id — each with its chain-unique label), and `parent_entry_id` (integer, nullable, indexed: derived from the `history` input's parent Result for tree queries). The `id` SHALL serve as the site-wide Q&A identifier shown as `QA-<id>`.

#### Scenario: Template QA entry
- **WHEN** a QA entry is created with type "template" and template_name "abstract" for paper 1
- **THEN** the entry SHALL be stored and queryable by paper_id and template_name, with `created_at` set to the current ISO 8601 timestamp

#### Scenario: Free QA entry
- **WHEN** a QA entry is created with type "free" for paper 1
- **THEN** the entry SHALL be stored with template_name as null, an auto-incremented id, and `created_at` set to the current ISO 8601 timestamp

#### Scenario: Backfill existing entries
- **WHEN** the migration runs on a database with existing `qa_entries` rows that have no `created_at`
- **THEN** the migration SHALL backfill `created_at` using the earliest `completed_at` from associated `qa_results`, or the current timestamp if no results exist

#### Scenario: Follow-up entry records its parent
- **WHEN** a free entry is created with a `history` input referencing Result 99 of entry 42
- **THEN** the entry SHALL store that input in `inputs` and `parent_entry_id` SHALL be 42

#### Scenario: Existing entries need no backfill of new columns
- **WHEN** the migration adds `instruction`, `inputs`, and `parent_entry_id`
- **THEN** existing rows SHALL keep null values and SHALL behave as plain questions with the default system prompt

### Requirement: QA results table
The database SHALL have a `qa_results` table with columns: `id` (integer, primary key, autoincrement), `qa_entry_id` (integer, foreign key to qa_entries.id, not null), `prompt` (text, not null), `answer` (text, not null), `model_name` (text, not null), `completed_at` (text, not null, ISO 8601), and `deleted_at` (text, nullable, ISO 8601). A non-null `deleted_at` marks a soft-deleted Result: it SHALL be excluded from every user-facing read but SHALL be kept for building follow-up conversation history. Results SHALL be ordered by `created_at` with `id` as tiebreaker when a recency order is needed.

#### Scenario: Multiple results per entry
- **WHEN** two QA results are inserted for the same qa_entry_id with different model_names
- **THEN** both results SHALL be stored and retrievable, ordered by creation time with id as tiebreaker

#### Scenario: Soft-deleted result kept
- **WHEN** a Result is deleted by its owner
- **THEN** its row SHALL remain with `deleted_at` set, and it SHALL NOT appear in user-facing reads

### Requirement: QA Result runtime lifecycle columns
The existing `qa_results` table SHALL additionally store `status`, `error`, `requested_by_user_id`, `streaming_capable`, `created_at`, `started_at`, `first_chunk_at`, `finished_at`, `updated_at`, and `deleted_at`. `answer` SHALL hold the latest persisted partial or authoritative final text. Existing `prompt`, `model_name`, `execution_id`, `content_hash`, `completed_at`, ids, and entry relationships SHALL be retained. The migration SHALL backfill every historical successful Result as `done`, using its existing completion time for the new created/updated/finished timestamps, without changing historical answer content or ids; `deleted_at` SHALL be null for all existing rows.

#### Scenario: Existing successful Result is migrated
- **WHEN** the migration runs on a Result that existed before per-run state
- **THEN** it SHALL remain linked to the same entry/execution with the same prompt, answer, model, completion time, and content hash, and SHALL read as `done`

#### Scenario: Active Result stores partial output
- **WHEN** a new Result has begun streaming but has not completed
- **THEN** its row SHALL contain `status='streaming'`, the latest persisted partial `answer`, a first-chunk timestamp, and no successful final content hash

#### Scenario: Initiating user is deleted
- **WHEN** a user who initiated a shared preset Result is deleted
- **THEN** the Result history SHALL remain and `requested_by_user_id` SHALL safely become null rather than deleting the Result

## ADDED Requirements

### Requirement: QA result citations table
The database SHALL have a `qa_result_cites` table with columns: `id` (integer, primary key, autoincrement), `qa_result_id` (integer, foreign key to qa_results.id, not null), `paper_id` (integer, foreign key to papers.id, not null), `cite_id` (text, not null), `id_kind` (text, not null, `s2_paper_id` or `corpus_id`), `link_text` (text, not null), and `created_at` (text, not null, ISO 8601), with a unique constraint on `(qa_result_id, cite_id)`. It SHALL record `#cite:` ids found in finished answers that are not among the paper's stored references.

#### Scenario: One row per id per answer
- **WHEN** a finished answer links the same unknown id twice
- **THEN** exactly one row SHALL exist for that answer and id

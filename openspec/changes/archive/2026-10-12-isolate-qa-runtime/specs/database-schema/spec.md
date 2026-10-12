## MODIFIED Requirements

### Requirement: QA entries table
The database SHALL have a `qa_entries` table with columns: `id` (integer, primary key, autoincrement), `paper_id` (integer, foreign key to papers.id, not null), `type` (text, not null, "template" or "free"), `template_name` (text, nullable), `user_id` (integer, nullable, references users.id), `prompt` (text, nullable), `status` (text, not null, default "pending"), `error` (text, nullable), `created_at` (text, not null, ISO 8601), `instruction` (text, nullable: the system prompt name; null means the default), `inputs` (text, nullable, JSON array of immutable inputs — `text_selection`, `image` with an image-host id, and at most one `history` input referencing a parent Result id — each with its chain-unique label), and `parent_entry_id` (integer, nullable, indexed: derived from the `history` input's parent Result for tree queries). The `id` SHALL serve as the site-wide Q&A identifier shown as `QA-<id>`.

Every new entry SHALL persist its question in `prompt` before model execution. Free entry prompts SHALL be immutable; preset entry prompts SHALL refresh from the latest configured template on each run. Null question text SHALL be allowed only for unrecoverable legacy data.

#### Scenario: Template QA entry
- **WHEN** a QA entry is created with type "template" and template_name "abstract" for paper 1
- **THEN** the entry SHALL be stored and queryable by paper_id and template_name, with `created_at` set to the current ISO 8601 timestamp and `prompt` set to the latest configured question before execution

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

#### Scenario: Backfill existing question text
- **WHEN** an existing entry has one or more results
- **THEN** migration SHALL backfill its prompt from the newest result without altering any result

#### Scenario: Unrecoverable legacy free prompt
- **WHEN** a failed free entry has no prompt and no result from which to recover it
- **THEN** the system SHALL NOT invent text
- **AND** deletion SHALL require explicit user authorization plus a current verified backup

#### Scenario: Template prompt changes between runs
- **WHEN** configured preset text changes before regeneration
- **THEN** the entry SHALL update to the latest text while old result prompt snapshots remain unchanged

#### Scenario: Free prompt remains immutable
- **WHEN** a free entry is rerun any number of times
- **THEN** the entry prompt SHALL remain the original question

### Requirement: QA results table
The database SHALL have a `qa_results` table with columns: `id` (integer, primary key, autoincrement), `qa_entry_id` (integer, foreign key to qa_entries.id, not null), `prompt` (text, not null), `answer` (text, not null), `model_name` (text, not null), `completed_at` (text, not null, ISO 8601), nullable `execution_id`, nullable stable `content_hash`, and `deleted_at` (text, nullable, ISO 8601). A non-null `deleted_at` marks a soft-deleted Result: it SHALL be excluded from every user-facing read but SHALL be kept for building follow-up conversation history. Results SHALL be ordered by `created_at` with `id` as tiebreaker when a recency order is needed.

Every new result SHALL store the exact Service execution id supplied for its run; ambiguous historical execution links SHALL remain unchanged. Each successful answer SHALL set `content_hash` to the MD5 of its answer after removing all whitespace; existing answers SHALL be backfilled without changing answer content or result IDs. Repeated runs of the same model SHALL remain separate results. Runtime lifecycle fields and active-run persistence SHALL follow the QA Result runtime lifecycle requirements below.

#### Scenario: Multiple results per entry
- **WHEN** two QA results are inserted for the same qa_entry_id with different model_names
- **THEN** both results SHALL be stored and retrievable, each with its own answer, content hash and exact Service execution id for new runs, ordered by creation time with id as tiebreaker

#### Scenario: Soft-deleted result kept
- **WHEN** a Result is deleted by its owner
- **THEN** its row SHALL remain with `deleted_at` set, and it SHALL NOT appear in user-facing reads

#### Scenario: Historical result backfill
- **WHEN** migration runs on an existing answer
- **THEN** it SHALL compute the same hash as frontend MarkdownContent without changing the answer or result id

## ADDED Requirements

### Requirement: Safe prompt migration and authorized cleanup
Prompt migration SHALL be preceded by a SQLite-consistent online backup and integrity check. It SHALL add/backfill prompt without changing historical result ids or answer content. A second current backup SHALL precede any explicitly authorized deletion of exact unrecoverable entry ids.

#### Scenario: Backup validation fails
- **WHEN** backup creation or `PRAGMA integrity_check` fails
- **THEN** migration or cleanup SHALL NOT proceed

#### Scenario: Prompt backfill completes
- **WHEN** migration completes successfully
- **THEN** every entry with a historical result SHALL have a prompt and all historical results SHALL remain unchanged

#### Scenario: Delete exact authorized rows
- **WHEN** the user authorizes deletion of listed `free + failed + prompt IS NULL + no result` ids after backup
- **THEN** only those ids SHALL be deleted transactionally
- **AND** papers, results, and service executions SHALL remain unchanged

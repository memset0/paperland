## MODIFIED Requirements

### Requirement: QA entries table
The database SHALL retain the `qa_entries` table with columns: `id`, `paper_id`, `user_id`, `type`, `template_name`, nullable `prompt`, legacy compatibility `status`/`error`, and `created_at`. Every new entry SHALL set `prompt` before model execution. A free entry's prompt SHALL remain immutable; a template entry's prompt SHALL track the latest configured template text used for its newest run. Null prompt SHALL be allowed only for unrecoverable legacy data.

#### Scenario: Template QA entry
- **WHEN** a template QA entry is created or rerun
- **THEN** it SHALL store the latest configured template question in `prompt`

#### Scenario: Free QA entry
- **WHEN** an authenticated user submits a free question
- **THEN** the new entry SHALL store the original question and owner before the Service execution begins

#### Scenario: Backfill existing entries
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
The database SHALL retain `qa_results` with columns: `id`, `qa_entry_id`, `prompt`, `answer`, `model_name`, `completed_at`, and nullable `execution_id`. Every newly completed result SHALL store the exact execution id supplied for its own run. Historical execution links SHALL remain unchanged when their true identity cannot be proven.

#### Scenario: Multiple results per entry
- **WHEN** different models or the same model run repeatedly for one entry
- **THEN** every successful run SHALL append a distinct result rather than overwrite an old result
- **AND** every new result SHALL reference its own exact service execution

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


## MODIFIED Requirements

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

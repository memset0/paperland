## MODIFIED Requirements

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

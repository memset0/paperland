## ADDED Requirements

### Requirement: Research tables
The database SHALL have a `research_sessions` table (`id`, `user_id` → users, `topic`, `seed` JSON nullable, `created_at`, `updated_at`) and a `research_steps` table (`id`, `session_id` → research_sessions with cascade delete, `step_index` unique per session, `kind` (`agent` | `title_edit`), `user_text` nullable, `model_name` nullable, `status`, `answer`, `report` nullable, `changes_note` nullable, `repaired` (integer 0/1, default 0), `paper_list` JSON nullable, `parse_error` nullable, `error` nullable, `created_at`, `started_at`, `first_chunk_at`, `finished_at`, `updated_at`). `paper_list` and `report` SHALL be null when an agent round produced no valid version; title-edit steps SHALL have `status = done`, no model, and non-null `paper_list` and `report`. Both tables SHALL be created by an additive migration.

#### Scenario: Deleting a session removes its steps
- **WHEN** a research session is deleted
- **THEN** all of its `research_steps` rows SHALL be deleted

#### Scenario: Step order is unique
- **WHEN** a second step with an existing `step_index` is inserted for the same session
- **THEN** the insert SHALL fail

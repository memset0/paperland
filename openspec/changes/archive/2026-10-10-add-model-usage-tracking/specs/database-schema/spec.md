## ADDED Requirements

### Requirement: Model usage table
The database SHALL have a `model_usage` table: `id`, `category` (text: `qa` | `research` | `translation`), `user_id` → users (nullable, `ON DELETE SET NULL`), `qa_result_id` → qa_results (nullable, `ON DELETE SET NULL`), `research_step_id` → research_steps (nullable, `ON DELETE SET NULL`), `translation_id` → translations (nullable, `ON DELETE SET NULL`), `model_name`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_tokens`, `total_tokens` (integers, default 0), `cost_usd` (real, nullable), `created_at`, with indexes on `user_id` and `created_at`. It SHALL be created by an additive migration that changes no existing table.

#### Scenario: Deleting the source keeps the cost
- **WHEN** a Q&A Result or research session referenced by usage rows is deleted
- **THEN** the usage rows SHALL remain with the source FK set to null

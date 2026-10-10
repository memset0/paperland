## ADDED Requirements

### Requirement: Research queued messages table
The database SHALL have a `research_queued_messages` table: `id` (autoincrement; also the enqueue order), `session_id` → research_sessions (`ON DELETE CASCADE`), `user_id` → users (`ON DELETE CASCADE`), `text`, `model_name`, `created_at`, with an index on `session_id`. Rows are temporary: they are deleted when merged into a round or removed by the owner. It SHALL be created by an additive migration.

#### Scenario: Deleting a session removes its queue
- **WHEN** a research session with queued messages is deleted
- **THEN** its `research_queued_messages` rows SHALL be deleted

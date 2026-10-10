## ADDED Requirements

### Requirement: Feature views table
The database SHALL have a `feature_views` table with `id` (integer primary key), `user_id` (not null, foreign key to `users.id`, cascade on delete), `feature_key` (text, not null) and `seen_at` (text ISO timestamp, not null), with a unique constraint on (`user_id`, `feature_key`). It SHALL be created by a Drizzle migration that does not alter existing tables.

#### Scenario: Unique seen record
- **WHEN** a second row with the same `user_id` and `feature_key` is inserted
- **THEN** the unique constraint SHALL reject it

#### Scenario: User deletion
- **WHEN** a user is deleted
- **THEN** that user's `feature_views` rows SHALL be deleted

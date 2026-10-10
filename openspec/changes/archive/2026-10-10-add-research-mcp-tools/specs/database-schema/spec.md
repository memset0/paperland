## MODIFIED Requirements

### Requirement: API tokens table
The database SHALL have an `api_tokens` table with columns: `id` (integer, primary key, autoincrement), `token` (text, unique, not null), `user_id` (integer, nullable, references `users.id`), `created_at` (text, not null), `revoked_at` (text, nullable), `kind` (text, not null, default `personal`; `personal` | `agent`), and `rotated_at` (text, nullable; when an agent token's value was last replaced). A partial unique index on `user_id` where `kind = 'agent'` SHALL allow at most one agent token per user. The additive migration that adds `kind` and `rotated_at` SHALL backfill one agent token (`sk-` followed by 64 hex characters) for every active user.

#### Scenario: Create and revoke token
- **WHEN** a token is created and later revoked by setting revoked_at
- **THEN** the token SHALL have a non-null revoked_at timestamp and SHALL be considered invalid

#### Scenario: Second agent token rejected
- **WHEN** an insert attempts a second `agent` token for a user who already has one
- **THEN** the database SHALL reject it with a unique constraint violation

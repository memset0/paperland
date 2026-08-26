## ADDED Requirements

### Requirement: QA Result runtime lifecycle columns
The existing `qa_results` table SHALL additionally store `status`, `error`, `requested_by_user_id`, `streaming_capable`, `created_at`, `started_at`, `first_chunk_at`, `finished_at`, and `updated_at`. `answer` SHALL hold the latest persisted partial or authoritative final text. Existing `prompt`, `model_name`, `execution_id`, `content_hash`, `completed_at`, ids, and entry relationships SHALL be retained. The migration SHALL backfill every historical successful Result as `done`, using its existing completion time for the new created/updated/finished timestamps, without changing historical answer content or ids.

#### Scenario: Existing successful Result is migrated
- **WHEN** the migration runs on a Result that existed before per-run state
- **THEN** it SHALL remain linked to the same entry/execution with the same prompt, answer, model, completion time, and content hash, and SHALL read as `done`

#### Scenario: Active Result stores partial output
- **WHEN** a new Result has begun streaming but has not completed
- **THEN** its row SHALL contain `status='streaming'`, the latest persisted partial `answer`, a first-chunk timestamp, and no successful final content hash

#### Scenario: Initiating user is deleted
- **WHEN** a user who initiated a shared preset Result is deleted
- **THEN** the Result history SHALL remain and `requested_by_user_id` SHALL safely become null rather than deleting the Result

### Requirement: QA Result lifecycle migration is additive and recoverable
The migration SHALL add lifecycle fields to the existing Result table without replacing the QA entry/result cardinality or creating a second answer store. A verified online backup and a disposable-copy migration check SHALL precede live application.

#### Scenario: Migration preserves QA history
- **WHEN** pre/post migration counts and identity/content hashes are compared
- **THEN** all existing QA entry ids, Result ids, prompts, answers, execution links, and content hashes SHALL match

### Requirement: Thinking duration is derived from lifecycle timestamps
The database SHALL use `started_at`, `first_chunk_at`, and `finished_at` as the source of truth for thinking duration and SHALL NOT store a redundant mutable duration column. Internal serializers MAY expose a derived `thinking_duration_ms`: while awaiting output it SHALL represent elapsed time through the server's current time, after first output it SHALL equal `first_chunk_at - started_at`, and when a no-output run terminates it SHALL equal `finished_at - started_at`.

#### Scenario: Streaming Result thinking duration
- **WHEN** a Result has both `started_at` and `first_chunk_at`
- **THEN** its thinking duration SHALL be derived from their difference and remain frozen while answer output continues

#### Scenario: Awaiting Result thinking duration
- **WHEN** a Result is still awaiting its first output
- **THEN** its serialized elapsed thinking duration SHALL advance without writing a new database value each second

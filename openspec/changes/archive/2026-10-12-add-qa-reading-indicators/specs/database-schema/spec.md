## MODIFIED Requirements

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

### Requirement: Highlight result attribution column
`highlights` SHALL have nullable `qa_result_id` referencing `qa_results` and an index beginning with `(user_id, qa_result_id)`. Non-QA highlights SHALL keep null. Deleting a result SHALL clear the optional attribution rather than delete the historical highlight row.

#### Scenario: QA highlight relation
- **WHEN** a highlight is created in a completed QA answer
- **THEN** it SHALL reference that result

#### Scenario: Non-QA highlight
- **WHEN** a highlight belongs to other Markdown content
- **THEN** `qa_result_id` SHALL be null

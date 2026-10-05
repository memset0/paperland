## MODIFIED Requirements

### Requirement: QA results table
The database SHALL retain `qa_results` with `id`, `qa_entry_id`, `prompt`, `answer`, `model_name`, `completed_at`, nullable `execution_id`, and nullable stable `content_hash`. Every stored successful answer SHALL set `content_hash` to the MD5 of its answer after removing all whitespace. Migration SHALL backfill existing results without changing answer content.

#### Scenario: Multiple results per entry
- **WHEN** multiple results exist for one entry
- **THEN** each result SHALL retain its own answer and content hash

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


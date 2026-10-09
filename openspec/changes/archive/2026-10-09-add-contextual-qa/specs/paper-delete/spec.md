## MODIFIED Requirements

### Requirement: Delete paper via internal API
The system SHALL provide a `DELETE /api/papers/:id` endpoint. The endpoint SHALL delete the paper and all associated data in a single database transaction, in the following order:
1. All `qa_result_cites` for this paper
2. All `qa_results` linked via `qa_entries` for this paper, including soft-deleted ones
3. All `qa_entries` for this paper
4. All `service_executions` for this paper
5. All `paper_tags` for this paper
6. All `highlights` matching the paper's pdf_path (if pdf_path is not null)
7. The paper record itself

The response SHALL return HTTP 200 with `{"success": true, "deleted_id": <id>}`.

#### Scenario: Delete paper with all associations
- **WHEN** a DELETE request is sent to `/api/papers/5` and paper 5 has QA entries, tags, service executions, and highlights
- **THEN** all associated records SHALL be deleted and the paper SHALL be removed

#### Scenario: Delete paper with no associations
- **WHEN** a DELETE request is sent to `/api/papers/10` and paper 10 has no QA, tags, or other records
- **THEN** the paper record SHALL be deleted successfully

#### Scenario: Delete non-existent paper
- **WHEN** a DELETE request is sent to `/api/papers/9999` and no paper with id 9999 exists
- **THEN** the system SHALL return HTTP 404

#### Scenario: ID not reused after deletion
- **WHEN** paper 5 is deleted and a new paper is created
- **THEN** the new paper SHALL receive an id greater than the previously highest id (SQLite autoincrement behavior)

## ADDED Requirements

### Requirement: Delete paper via internal API
The system SHALL provide a `DELETE /api/papers/:id` endpoint. The endpoint SHALL delete the paper and all associated data in a single database transaction, in the following order:
1. All `qa_results` linked via `qa_entries` for this paper
2. All `qa_entries` for this paper
3. All `service_executions` for this paper
4. All `paper_tags` for this paper
5. All `highlights` matching the paper's pdf_path (if pdf_path is not null)
6. The paper record itself

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

### Requirement: Delete paper via external API
The system SHALL provide a `DELETE /external-api/v1/papers/:id` endpoint with Bearer Token auth. The cascade deletion behavior SHALL be identical to the internal API.

#### Scenario: External API delete paper
- **WHEN** an authenticated DELETE request is sent to `/external-api/v1/papers/5`
- **THEN** the paper and all associated data SHALL be deleted identically to the internal API

### Requirement: Frontend delete confirmation dialog
The paper detail page SHALL have a "Delete" button. When clicked, a confirmation dialog SHALL appear showing:
- The paper's title and internal ID
- A warning message explaining that all Q&A entries and results will be permanently deleted
- A text input requiring the user to type the paper's internal ID (as a number)
- A "Delete" button that is disabled until the typed ID matches the paper's actual ID
- A "Cancel" button to dismiss the dialog

#### Scenario: Successful deletion with correct ID confirmation
- **WHEN** user clicks "Delete" on paper with id 5
- **AND** the confirmation dialog appears
- **AND** user types "5" in the input field
- **THEN** the "Delete" button SHALL become enabled
- **AND WHEN** user clicks "Delete"
- **THEN** a DELETE request SHALL be sent and on success the user SHALL be redirected to the paper list page

#### Scenario: Incorrect ID prevents deletion
- **WHEN** user clicks "Delete" on paper with id 5
- **AND** user types "3" in the confirmation input
- **THEN** the "Delete" button SHALL remain disabled

#### Scenario: Cancel deletion
- **WHEN** user clicks "Cancel" in the confirmation dialog
- **THEN** the dialog SHALL close and no deletion SHALL occur

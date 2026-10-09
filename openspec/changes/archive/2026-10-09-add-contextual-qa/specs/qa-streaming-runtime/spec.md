## MODIFIED Requirements

### Requirement: Every QA model run has a durable Result identity
The system SHALL create one `qa_results` record for every selected model run before that run waits for ServiceRunner capacity. The record SHALL contain the question text snapshot, model name, initiating user when known, and exact Service execution id; the full model input SHALL NOT be stored (see `contextual-qa`). Repeated runs of the same question and model SHALL remain separate records. When one submission selects several models, the records SHALL be created in reverse order of the model selection list, so the first-listed model's Result is the most recently created.

#### Scenario: Submit one question to multiple models
- **WHEN** a user submits one free question to three selected models
- **THEN** the system SHALL immediately create three Result records linked to three distinct Service executions under one QA entry

#### Scenario: Repeat the same model
- **WHEN** a user regenerates an entry twice with the same model
- **THEN** both runs SHALL remain independently addressable and SHALL NOT overwrite the earlier Result

#### Scenario: Reverse creation order
- **WHEN** a user submits a question with models A, B, C selected in that order
- **THEN** the Results SHALL be created for C, then B, then A

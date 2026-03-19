## ADDED Requirements

### Requirement: QA executes through service_runner
The QA service SHALL be registered as a pure service in `service_runner` and all QA executions (template and free) SHALL go through `service_runner.executePureService()`.

#### Scenario: QA respects max_concurrency
- **WHEN** `config.yml` sets `services.qa.max_concurrency: 2` and 5 QA questions are submitted simultaneously
- **THEN** at most 2 QA questions execute concurrently; remaining 3 wait in queue

#### Scenario: QA execution creates service_execution record
- **WHEN** a QA question is submitted (template or free)
- **THEN** a `service_executions` record is created with `service_name: 'qa'` and the corresponding `paper_id`
- **AND** the record status transitions through pending → running → done/failed

#### Scenario: QA visible in service dashboard
- **WHEN** user visits the service dashboard page
- **THEN** QA appears in the service list with its running count, pending queue, and max_concurrency

### Requirement: QA results link to service_executions
The `qa_results` table SHALL include an `execution_id` column referencing `service_executions.id`.

#### Scenario: Tracing QA result to service execution
- **WHEN** a QA result is written after successful execution
- **THEN** the `qa_results.execution_id` field references the corresponding `service_executions` record

### Requirement: QA service_executions retryable from service dashboard
Users SHALL be able to see failed QA executions in the service dashboard and identify them for retry.

#### Scenario: Failed QA shows in execution history
- **WHEN** a QA execution fails (model error, timeout, etc.)
- **THEN** the `service_executions` record has `status: 'failed'` with the error message
- **AND** the execution appears in the service dashboard's execution history with a failed badge

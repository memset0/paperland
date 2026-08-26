# service-runner Specification

## Purpose
TBD - created by archiving change service-framework. Update Purpose after archive.
## Requirements
### Requirement: Per-service concurrency control
The ServiceRunner SHALL enforce max_concurrency per service as configured in config.yml. When the limit is reached, new executions SHALL queue until a slot is available.

#### Scenario: Concurrency limit respected
- **WHEN** arxiv_service has max_concurrency=3 and 3 executions are running
- **THEN** a 4th execution SHALL wait in queue until one completes

### Requirement: Per-service rate limiting
The ServiceRunner SHALL enforce rate_limit_interval per service. After each execution completes, the next execution for the same service SHALL wait at least rate_limit_interval seconds.

#### Scenario: Rate limit cooldown
- **WHEN** arxiv_service has rate_limit_interval=3 and an execution just completed
- **THEN** the next arxiv_service execution SHALL not start until 3 seconds have passed

#### Scenario: Rate limit does not block other services
- **WHEN** arxiv_service is in cooldown
- **THEN** semantic_scholar_service executions SHALL proceed independently

### Requirement: Execution status lifecycle
Each service execution SHALL track status: pending → waiting → running → done/failed/blocked. Status transitions SHALL be persisted to the service_executions table.

#### Scenario: Successful execution
- **WHEN** a service execution runs and completes successfully
- **THEN** its status SHALL transition: pending → running → done

#### Scenario: Failed execution
- **WHEN** a service execution throws an error
- **THEN** its status SHALL transition to failed with the error message stored

### Requirement: Service registration
Services SHALL be registered with the ServiceRunner at startup, providing name, type (paper_bound or pure), and execution function.

#### Scenario: Register service
- **WHEN** the server starts
- **THEN** all known services SHALL be registered with the ServiceRunner

### Requirement: Service and execution listing API
The backend SHALL provide API endpoints to list registered services and their execution history with pagination.

#### Scenario: List service executions
- **WHEN** GET /api/services/executions?page=1&page_size=20
- **THEN** the response SHALL include paginated execution records with service_name, paper_id, status, progress, timestamps

### Requirement: Pure-service execution identity is available before queueing
For a pure service, the runner SHALL expose the newly persisted execution identity to an optional synchronous preparation hook before the background worker can enter its concurrency/rate-limit queue. If preparation fails, the execution SHALL become failed and the service body SHALL NOT run.

#### Scenario: QA prepares a Result before waiting
- **WHEN** QA schedules one model run
- **THEN** it SHALL be able to create the exact linked queued Result before the execution begins waiting or running

#### Scenario: Result preparation fails
- **WHEN** the QA Result cannot be persisted in the preparation hook
- **THEN** the Service execution SHALL fail without invoking the model

### Requirement: Pure-service executions expose exact cancellation signals
Each scheduled pure-service execution SHALL own an AbortSignal that is delivered to its execution callback. Cancelling by exact execution id SHALL abort a pending semaphore/rate-limit wait or active callback, SHALL NOT affect other executions, and SHALL still release concurrency resources exactly once. Services without a caller-provided cancellation action SHALL retain their existing behavior.

#### Scenario: Cancel queued execution
- **WHEN** a queued pure-service execution is cancelled before acquiring capacity
- **THEN** its wait SHALL end as an unsuccessful terminal execution without consuming a later slot

#### Scenario: Cancel running execution
- **WHEN** an active pure-service execution is cancelled
- **THEN** its signal SHALL abort while sibling executions continue and its semaphore slot SHALL be released once

#### Scenario: Unknown or terminal execution cancellation
- **WHEN** cancellation targets an unknown or already terminal execution id
- **THEN** the runner SHALL report that no active execution was cancelled and SHALL NOT alter history

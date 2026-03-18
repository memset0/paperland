## ADDED Requirements

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

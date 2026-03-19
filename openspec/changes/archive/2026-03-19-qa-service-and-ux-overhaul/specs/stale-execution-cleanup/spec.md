## ADDED Requirements

### Requirement: Clean up stale executions on startup
The backend SHALL reset all in-flight service executions and QA entries to failed status when the server starts.

#### Scenario: Stale service_executions cleaned on startup
- **WHEN** the server starts and there exist `service_executions` records with `status` in ('pending', 'running')
- **THEN** those records SHALL be updated to `status: 'failed'`, `error: 'interrupted by server restart'`, `finished_at` set to current timestamp

#### Scenario: Stale qa_entries cleaned on startup
- **WHEN** the server starts and there exist `qa_entries` records with `status` in ('pending', 'running')
- **THEN** those records SHALL be updated to `status: 'failed'`, `error: 'interrupted by server restart'`

#### Scenario: No stale records
- **WHEN** the server starts and all `service_executions` and `qa_entries` have terminal status (done, failed, blocked)
- **THEN** no records are modified

### Requirement: Cleaned executions are retryable
Users SHALL be able to retry executions that were interrupted by restart.

#### Scenario: Retry interrupted QA from QA page
- **WHEN** a QA entry was marked as failed due to restart
- **THEN** the user can click "重试" to re-submit the question

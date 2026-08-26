## ADDED Requirements

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

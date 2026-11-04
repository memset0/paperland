## ADDED Requirements

### Requirement: Answer time limit
Each Q&A answer run SHALL be limited to `services.qa.time_limit` seconds of wall-clock time (default 7200, i.e. 2 hours), counted from when the run starts executing (status `awaiting_output`); time spent `queued` SHALL NOT count. When the limit is reached, the system SHALL abort the model call and SHALL finalize the result without waiting for the model provider to shut down: the result SHALL become `failed` with an error naming the limit (e.g. "Answer exceeded the 2h time limit"), any partial answer already streamed SHALL be kept, the entry state SHALL be recomputed, stream subscribers SHALL receive the error event, the `qa` service execution SHALL be marked `failed`, and its concurrency slot SHALL be released. A timed-out result SHALL NOT be reported as cancelled by the user. A run that finishes, fails, or is cancelled before the limit SHALL be unaffected.

#### Scenario: Answer hangs past the limit
- **WHEN** a Q&A run has been executing for `services.qa.time_limit` seconds and the model call has not settled
- **THEN** the result SHALL be `failed` with an error naming the time limit, its partial answer SHALL be kept, and the next queued Q&A run SHALL be able to start

#### Scenario: Provider ignores the abort
- **WHEN** the time limit is reached and the model call never settles after the abort
- **THEN** the result and its service execution SHALL still be finalized as failed

#### Scenario: Queued time does not count
- **WHEN** a run waits in the queue for longer than the limit and then completes within the limit after it starts
- **THEN** the result SHALL be `done`

#### Scenario: Default limit
- **WHEN** `services.qa.time_limit` is not configured
- **THEN** the limit SHALL be 7200 seconds

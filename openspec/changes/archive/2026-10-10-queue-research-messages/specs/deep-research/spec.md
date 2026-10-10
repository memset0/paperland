## MODIFIED Requirements

### Requirement: Linear history of steps and versions
A session's history SHALL be a strictly ordered, non-branching sequence of steps. A step SHALL be either an agent round (user text + one model + agent output) or a title edit by the owner. Every step that yields a list SHALL create a new list version; all versions SHALL be kept and viewable. The owner SHALL be able to submit a new agent round (free text plus a model); when a round is active (`queued`, `awaiting_output`, or `streaming`) the message SHALL be queued instead (see "Queued messages") rather than rejected. Only the latest step, when it is an agent round, SHALL be retryable; retrying SHALL replace that round's output (the user MAY edit its text and model). The owner SHALL be able to cancel an active round. A new round's model SHALL default to the most recent agent round's model.

#### Scenario: Cannot submit while running
- **WHEN** the latest round is `streaming` and the owner submits a new message
- **THEN** no new round SHALL start and no step SHALL be created yet; the server SHALL respond 202 and store the message in the session's queue

#### Scenario: Retry replaces the latest round
- **WHEN** the owner retries the latest agent round with edited text
- **THEN** the number of steps SHALL be unchanged, and that round SHALL run again with the edited text

#### Scenario: Earlier steps are not retryable
- **WHEN** the owner tries to retry a step that is not the latest
- **THEN** the server SHALL respond with 409

## ADDED Requirements

### Requirement: Queued messages
While a round of a session is active, messages the owner submits SHALL be stored in the database as that session's queued messages (text, model, and enqueue order) and SHALL NOT start a round. When the active round ends — `done`, `failed`, or `cancelled` — and the session has queued messages, the system SHALL merge all of them, in enqueue order, into one user message joined only by newlines (`\n`), create one new agent round with that text, using the model of the most recently queued message, delete the queued messages, and start the round. The new round's creation time SHALL be the time it is created from the queue; enqueue times SHALL NOT be kept. After a server restart, sessions that have queued messages and no active round SHALL have their queue dispatched the same way during startup (after interrupted rounds are marked failed). The owner SHALL be able to remove a queued message before it is sent. Session detail SHALL include the queued messages for the owner; other viewers SHALL NOT see them. Deleting a session SHALL delete its queued messages.

#### Scenario: Two queued messages become one round
- **WHEN** round 3 is running and the owner submits "add benchmarks" and then "drop surveys"
- **THEN** after round 3 finishes, exactly one new round SHALL start whose user text is "add benchmarks\ndrop surveys" and the queue SHALL be empty

#### Scenario: Queue is sent after a failed or cancelled round
- **WHEN** the running round fails or is cancelled while one message is queued
- **THEN** a new round SHALL start with that message

#### Scenario: Removing a queued message
- **WHEN** the owner removes one of two queued messages before the round ends
- **THEN** only the remaining message SHALL be sent

#### Scenario: Others cannot queue or see the queue
- **WHEN** a viewer of a shared session who is not the owner submits a message or loads the session
- **THEN** the submission SHALL be rejected with 403 and the session detail SHALL contain no queued messages

#### Scenario: Restart dispatches the queue
- **WHEN** the server restarts while a round is running and a message is queued
- **THEN** on startup the round SHALL be marked failed and a new round SHALL start with the queued message

## MODIFIED Requirements

### Requirement: Queued messages
The owner SHALL be able to add messages to the session's queue (stored in the database with text, model and enqueue order) at any time: while a round is active every submitted message is queued, and while no round is active the owner MAY explicitly choose "add to queue" instead of sending, to write a long instruction in several parts. Queued messages SHALL NOT start a round by themselves while the session is idle. Sending while idle SHALL merge all queued messages plus the newly typed text (if any), in order, into one round; sending with no new text SHALL be allowed when the queue is not empty. When an active round ends — `done`, `failed`, or `cancelled` — and the session has queued messages, the system SHALL merge all of them, in enqueue order, into one user message joined only by newlines (`\n`), create one new agent round with that text, using the model of the most recently queued message, delete the queued messages, and start the round. The new round's creation time SHALL be the time it is created from the queue; enqueue times SHALL NOT be kept. After a server restart, only sessions whose round was interrupted by the restart SHALL have their queue dispatched during startup (after interrupted rounds are marked failed); queues held while idle SHALL stay queued. The owner SHALL be able to remove a queued message before it is sent. Session detail SHALL include the queued messages for the owner; other viewers SHALL NOT see them. Deleting a session SHALL delete its queued messages.

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
- **THEN** on startup the round SHALL be marked failed and a new round SHALL start with the queued message; a session that was idle with queued messages SHALL keep them queued

#### Scenario: Writing an instruction in parts while idle
- **WHEN** no round is running and the owner adds "part 1" and "part 2" to the queue, then sends "part 3"
- **THEN** no round SHALL start until the send, and then exactly one round SHALL start with "part 1\npart 2\npart 3"

#### Scenario: Send the queue without new text
- **WHEN** no round is running, the queue holds two messages, and the owner sends with an empty input
- **THEN** one round SHALL start with the two messages merged

## MODIFIED Requirements

### Requirement: PaperDetail shows every QA Result attempt state
PaperDetail SHALL render queued, awaiting-output, streaming, done, failed, and cancelled Result attempts as independently selectable tabs within their existing QA entry; soft-deleted Results SHALL NOT be rendered. A newly created run SHALL appear immediately and become the selected latest tab; older completed answers SHALL remain accessible. "Latest" SHALL mean the most recently created Result (by `created_at`, then id), regardless of completion time or status.

#### Scenario: New regeneration appears beside history
- **WHEN** a user regenerates an entry that already has completed answers
- **THEN** a new active tab SHALL appear and be selected without removing or relabeling the prior tabs

#### Scenario: Failed Result remains inspectable
- **WHEN** a run fails after partial output
- **THEN** its tab SHALL retain the partial answer, failed status, model, error, and retry action while completed sibling tabs remain usable

#### Scenario: Latest by request time
- **WHEN** an entry has a Result created at 10:00 that finished at 10:05 and another created at 10:01 that finished at 10:02
- **THEN** the Result created at 10:01 SHALL be selected by default

### Requirement: PaperDetail offers exact stop and retry actions
An authorized viewer SHALL see a stop action only for an active Result they may cancel and a retry action for a failed/cancelled Result they may manage. Stopping SHALL target that Result only; retrying SHALL create a new Result with the existing preset/free prompt rules rather than mutate the failed one. A free entry's retry SHALL reuse its immutable question, system prompt name, inputs, and history reference, assembling the model input with the current rules.

#### Scenario: Stop one active tab
- **WHEN** the user stops one active Result in an entry with another active Result
- **THEN** only that tab SHALL become cancelled and the other tab SHALL continue updating

#### Scenario: Retry failed free question
- **WHEN** the owner retries a failed free Result
- **THEN** a new Result SHALL use the immutable persisted free-question text

#### Scenario: Retry failed preset question
- **WHEN** an authorized user retries a failed preset Result
- **THEN** a new Result SHALL use the latest preset text from `config.yml`

#### Scenario: Retry a follow-up
- **WHEN** the owner retries a failed Result of a follow-up entry with a screenshot input
- **THEN** the new Result SHALL be built with the same inputs and the same parent answer history

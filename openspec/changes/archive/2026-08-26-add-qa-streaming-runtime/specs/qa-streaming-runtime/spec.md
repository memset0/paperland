## Purpose

Defines durable, independently observable QA model runs that preserve prompt and partial output, stream live progress without coupling generation to a browser connection, and recover safely from failure, cancellation, or server restart.

## ADDED Requirements

### Requirement: Every QA model run has a durable Result identity
The system SHALL create one `qa_results` record for every selected model run before that run waits for ServiceRunner capacity. The record SHALL contain the exact prompt snapshot, model name, initiating user when known, and exact Service execution id. Repeated runs of the same question and model SHALL remain separate records.

#### Scenario: Submit one question to multiple models
- **WHEN** a user submits one free question to three selected models
- **THEN** the system SHALL immediately create three Result records linked to three distinct Service executions under one QA entry

#### Scenario: Repeat the same model
- **WHEN** a user regenerates an entry twice with the same model
- **THEN** both runs SHALL remain independently addressable and SHALL NOT overwrite the earlier Result

### Requirement: Result lifecycle distinguishes queue, first output, and terminal state
Each Result SHALL follow `queued → awaiting_output → streaming → done|failed|cancelled`, except that a provider without incremental output MAY transition directly from `awaiting_output` to a terminal state. `queued` SHALL mean it is waiting for ServiceRunner capacity/rate limit; `awaiting_output` SHALL mean the provider invocation has started but no non-empty output has arrived and SHALL be presented to users as Thinking; `streaming` SHALL begin with the first non-empty provider delta.

#### Scenario: Streaming provider starts producing text
- **WHEN** ServiceRunner starts a Result and its provider later emits a first non-empty delta
- **THEN** the Result SHALL move from `queued` to `awaiting_output` and then to `streaming`

#### Scenario: Buffered provider completes
- **WHEN** the selected provider truthfully reports no incremental-output capability
- **THEN** the Result SHALL remain `awaiting_output` while the provider runs and SHALL move directly to `done` when the authoritative answer returns

#### Scenario: Provider fails before first character
- **WHEN** a provider fails after starting but before any non-empty delta
- **THEN** the Result SHALL become `failed` with its prompt, model, execution link, and error still available

#### Scenario: Thinking ends at first output
- **WHEN** an awaiting-output Result receives its first non-empty provider delta
- **THEN** the system SHALL persist `first_chunk_at`, transition it to `streaming`, and freeze its thinking duration at `first_chunk_at - started_at`

#### Scenario: Thinking continues for buffered provider
- **WHEN** a provider exposes no genuine incremental output and remains active
- **THEN** the Result SHALL remain `awaiting_output` and its user-visible Thinking timer SHALL continue until the final response or terminal error

### Requirement: Partial output is persisted before live publication
The system SHALL accumulate genuine provider deltas in order, persist each bounded output batch to the Result before publishing that batch to viewers, and flush pending text at every terminal transition. On success, the provider's authoritative final text SHALL replace the assembled preview and SHALL be the only text used to compute `content_hash`.

#### Scenario: Failure after partial output
- **WHEN** a provider emits partial text and then fails
- **THEN** the Result SHALL become `failed` and retain the emitted partial answer together with the terminal error

#### Scenario: Final provider text differs from accumulated deltas
- **WHEN** the provider completes with authoritative final text that differs from the accumulated preview
- **THEN** the `done` Result SHALL store and publish the authoritative final text and its matching content hash

### Requirement: Entry status is an aggregate of Result runs
The existing `qa_entries.status` SHALL remain a compatibility summary computed from all Result runs for that entry. It SHALL be `pending` while active runs are only queued, `running` while any run is awaiting output or streaming, `done` when no run is active and at least one run succeeded, and `failed` when no run is active and no run succeeded. A terminal failed/cancelled regeneration SHALL remain visible on its Result even when an older success makes the aggregate entry `done`.

#### Scenario: First of two concurrent models completes
- **WHEN** one Result is done while another Result for the same entry is still streaming
- **THEN** the entry SHALL remain `running`

#### Scenario: Regeneration fails beside an older success
- **WHEN** an entry has an older done Result and its only active regeneration fails
- **THEN** the entry SHALL return to `done` while the failed Result retains its own failed status and error

#### Scenario: All attempts fail
- **WHEN** an entry has no active or successful Result and all attempts are failed or cancelled
- **THEN** the entry SHALL be `failed`

### Requirement: Result live stream is reconnectable and observer-only
The system SHALL provide a visibility-checked SSE stream for one Result using named `start`, `delta`, `done`, and `error` events with snake_case JSON. `start` SHALL include the durable current snapshot, provider streaming capability, and derived thinking duration; ordered `delta` events SHALL contain only already-persisted text batches and SHALL identify the first-output transition; `done` SHALL contain the authoritative successful Result; and `error` SHALL contain the durable failed/cancelled Result. A terminal stream SHALL emit exactly one terminal event. Reconnecting SHALL start from the latest persisted answer so the client can replace, rather than duplicate, its preview.

#### Scenario: Subscribe while a Result is already streaming
- **WHEN** a permitted viewer subscribes after some partial text was persisted
- **THEN** `start` SHALL include that complete partial snapshot and later `delta` events SHALL continue from it without losing already published text

#### Scenario: Viewer disconnects
- **WHEN** the SSE client closes or navigates away while the Result is active
- **THEN** only that subscription SHALL close and the Service execution/model invocation SHALL continue in the background

#### Scenario: Subscribe to a terminal Result
- **WHEN** a permitted viewer subscribes to an already done, failed, or cancelled Result
- **THEN** the stream SHALL send its snapshot and matching terminal event without starting a new model call

#### Scenario: Done is authoritative after queued deltas
- **WHEN** the provider completes while the client still has scheduled delta paints
- **THEN** the client SHALL process the ordered delta callbacks first and then treat `done.result.answer` as the authoritative final text for one final render

### Requirement: One exact Result run can be cancelled
The system SHALL allow an authorized user to cancel one active Result by its id. Cancellation SHALL abort that Result's queued wait or provider invocation through its execution-owned `AbortSignal`, preserve any persisted partial text, mark the Result `cancelled`, and let ServiceRunner close the exact associated execution as an unsuccessful terminal execution. It SHALL NOT cancel sibling Results for the same entry.

#### Scenario: Cancel one model in a multi-model question
- **WHEN** two models are active for one entry and the user cancels one Result
- **THEN** only the selected Result/execution SHALL be aborted and the other SHALL continue

#### Scenario: Closing a tab is not cancellation
- **WHEN** a user closes a Result tab, collapses the QA card, or leaves the page
- **THEN** the system SHALL NOT interpret that UI action as cancellation

### Requirement: Interrupted active Results recover without data loss
At backend startup, any persisted Result left in `queued`, `awaiting_output`, or `streaming` SHALL be marked `failed` with an interruption error, preserving its prompt and partial answer. Its parent entry aggregate and exact Service execution SHALL be reconciled consistently. The system SHALL NOT claim to resume a provider stream that cannot be resumed; an authorized user SHALL be able to start a fresh Result from the persisted entry prompt.

#### Scenario: Server restarts after partial output
- **WHEN** the backend restarts with a Result persisted as `streaming`
- **THEN** that Result SHALL become failed with its partial answer intact and regeneration SHALL still use the saved question text

#### Scenario: Server restarts before first output
- **WHEN** the backend restarts with a Result in `queued` or `awaiting_output`
- **THEN** the Result SHALL become failed without losing its prompt, model, or execution identity

### Requirement: Configured Codex QA models expose their native streaming capability
Codex models intended for interactive QA SHALL use structured app-server configuration with `stream: true`, an explicit executable, Codex home, model id, reasoning effort, and timeout. Stable Paperland model names and reasoning choices SHALL remain unchanged. A deliberately buffered Codex definition MAY remain `stream: false`, but the system SHALL then report `streaming_capable=false` and SHALL NOT claim incremental output.

#### Scenario: Default Codex QA model streams
- **WHEN** the configured default QA model is a Codex model intended for interactive use
- **THEN** its capabilities SHALL report streaming and new QA Results SHALL be eligible to transition from Thinking to streaming on genuine final-answer deltas

#### Scenario: Buffered compatibility model remains truthful
- **WHEN** an operator explicitly configures a Codex model with `stream: false`
- **THEN** QA SHALL display Thinking until the final answer and SHALL NOT fabricate chunks

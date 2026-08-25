## ADDED Requirements

### Requirement: Codex CLI is a first-class model provider
The shared model invocation layer SHALL treat `type: codex` as a first-class provider independent from `type: openai_api`. Codex invocation SHALL use the local Codex executable, inherited Codex authentication environment, and Codex-native process protocol; it SHALL NOT require an OpenAI-compatible HTTP endpoint, API-key field, Chat Completions request, or Chat Completions response parser. Provider selection SHALL remain transparent to QA, translation, and other callers that resolve a model by its configured Paperland name.

#### Scenario: Translation selects a Codex model
- **WHEN** `translation.model` names an available model with `type: codex`
- **THEN** the shared invocation facade SHALL route it to the Codex provider without entering the OpenAI API provider

#### Scenario: QA selects an OpenAI model
- **WHEN** a QA call resolves a model with `type: openai_api`
- **THEN** it SHALL use the OpenAI provider without starting a Codex process

#### Scenario: Provider-independent final result
- **WHEN** either a Codex or OpenAI provider completes successfully
- **THEN** callers that did not request chunks SHALL receive the same final-string contract

### Requirement: Codex stream setting selects the native invocation mode
A model definition with `type: codex` SHALL use the same optional `stream` capability flag exposed to callers. When `stream` is absent or false, CodexProvider SHALL use `codex exec --ephemeral`, preserve the existing one-process final-string behavior, and accept legacy definitions that provide `shell`. When `stream: true`, CodexProvider SHALL use app-server and structured fields for the Codex binary path, `CODEX_HOME`, underlying model id, reasoning effort, timeout, and working directory instead of parsing those values from a shell command.

#### Scenario: Legacy Codex shell remains compatible
- **WHEN** an existing model has `type: codex` and `shell` but no `stream`
- **THEN** the system SHALL invoke it through the existing buffered `codex exec` path and return its final text
- **AND** SHALL add `--ephemeral` so the invocation does not create a resumable Codex session

#### Scenario: Structured app-server model selected
- **WHEN** a model has `type: codex`, `stream: true`, `cli_path: /root/.local/bin/codex`, `codex_home: /root/.codex`, `model_id: gpt-5.3-codex-spark`, and `reasoning_effort: xhigh`
- **THEN** the system SHALL start that binary's app-server protocol and request the specified model and reasoning effort

#### Scenario: Incomplete app-server config rejected
- **WHEN** a Codex app-server model omits a required structured field or uses an unsupported reasoning effort
- **THEN** config loading SHALL fail with a validation error naming the invalid model definition

### Requirement: Codex app-server exposes genuine agent-message deltas
For a Codex model with `stream: true`, the system SHALL complete the required initialization handshake, create an ephemeral read-only thread, verify the returned thread is still marked ephemeral, start a turn with the translation prompt, and consume newline-delimited JSON-RPC messages. It SHALL forward `item/agentMessage/delta` text only for an `agentMessage` item identified as `phase: final_answer`, preserve delta order, use the completed final-answer item's text as authoritative, and require a successful `turn/completed` terminal status.

#### Scenario: Spark emits multiple final-answer deltas
- **WHEN** `gpt-5.3-codex-spark` emits multiple `item/agentMessage/delta` notifications for the final-answer item
- **THEN** the adapter SHALL report each delta in order before returning the completed item text

#### Scenario: Non-final agent message is not translated output
- **WHEN** app-server emits an agent message whose phase is not `final_answer`
- **THEN** its deltas SHALL NOT be forwarded as translation text or included in the returned final translation

#### Scenario: Completed item and turn establish success
- **WHEN** a final-answer item completes and the enclosing turn completes successfully
- **THEN** the adapter SHALL return the completed item's full text as the authoritative result

#### Scenario: App-server refuses ephemeral root thread
- **WHEN** `thread/start` does not return a thread with `ephemeral: true`
- **THEN** the adapter SHALL fail closed before `turn/start` and SHALL NOT run a request that could enter the user's normal Codex history

#### Scenario: Turn fails after deltas
- **WHEN** app-server emits final-answer deltas but the turn ends as failed or interrupted
- **THEN** the adapter SHALL reject the invocation and retain the observed deltas only as transient progress

### Requirement: Codex app-server lifecycle is bounded per invocation
Each Codex invocation using `stream: true` SHALL have bounded process ownership: it SHALL inherit the server environment with the configured `CODEX_HOME`, continuously drain stdout and stderr, enforce the configured timeout, and terminate the child after success, error, cancellation, or protocol failure. Client cancellation SHALL request turn interruption when possible and SHALL kill the process if it does not exit promptly. Unknown future notifications SHALL be ignored without corrupting known message handling.

#### Scenario: App-server invocation times out
- **WHEN** no successful terminal turn is received before the configured timeout
- **THEN** the child process SHALL be terminated and the invocation SHALL fail with a timeout error

#### Scenario: Caller cancels app-server invocation
- **WHEN** the model invocation's abort signal fires during a Codex turn
- **THEN** the adapter SHALL stop forwarding deltas, interrupt or terminate the turn, and release all process resources

#### Scenario: App-server emits an unknown notification
- **WHEN** a newer Codex version emits a notification method the adapter does not recognize
- **THEN** the adapter SHALL ignore that notification and continue processing known events

### Requirement: Final-string callers remain compatible
The shared model invocation API SHALL continue to return one final text string to callers that do not register an incremental-output callback. Enabling an app-server or HTTP streaming transport SHALL NOT require QA, translation, or future callers to consume chunks unless they opt in.

#### Scenario: Caller omits chunk callback
- **WHEN** a caller invokes a streaming-capable model without an output callback
- **THEN** it SHALL receive the same authoritative final string or terminal error contract as a non-streaming model

## MODIFIED Requirements

### Requirement: Codex stream setting selects the native invocation mode
A model definition with `type: codex` SHALL use the same optional `stream` capability flag exposed to callers. When `stream` is absent or false, CodexProvider SHALL use `codex exec --ephemeral`, preserve the existing one-process final-string behavior, and accept legacy definitions that provide `shell`. When `stream: true`, CodexProvider SHALL use app-server and structured fields for the Codex binary path, `CODEX_HOME`, underlying model id, reasoning effort, timeout, and working directory instead of parsing those values from a shell command. For structured model input, exec mode SHALL pass the system prompt as `-c developer_instructions=…` and each image as `--image <absolute path>`, keeping the user text on stdin.

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

#### Scenario: Exec mode with system prompt and image
- **WHEN** a Codex exec model receives input with a system prompt and one image stored in the image host
- **THEN** the command SHALL include `-c developer_instructions=…` with the system prompt and `--image` with the image's absolute path, and the user text SHALL be piped on stdin

### Requirement: Codex app-server exposes genuine agent-message deltas
For a Codex model with `stream: true`, the system SHALL complete the required initialization handshake, create an ephemeral read-only thread, verify the returned thread is still marked ephemeral, start a turn with the caller's input, and consume newline-delimited JSON-RPC messages. When the input has a system prompt, `thread/start` SHALL carry it as `developerInstructions` (not `baseInstructions`); the turn input SHALL contain the user text and, for each image, a `localImage` item with the image's absolute path. When enabled by configuration for Q&A, the thread SHALL allow the native web search tool. It SHALL forward `item/agentMessage/delta` text only for an `agentMessage` item identified as `phase: final_answer`, preserve delta order, use the completed final-answer item's text as authoritative, and require a successful `turn/completed` terminal status.

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

#### Scenario: System prompt and image reach app-server
- **WHEN** a Q&A run with a system prompt and one screenshot input uses a Codex app-server model
- **THEN** `thread/start` SHALL include the system prompt as `developerInstructions` and `turn/start` SHALL include a `localImage` item pointing to the screenshot's file in the image host

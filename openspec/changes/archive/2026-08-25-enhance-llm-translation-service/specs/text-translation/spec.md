## MODIFIED Requirements

### Requirement: Configurable translation prompt
The system SHALL read the translation prompt from a `translation` block in `config.yml`. The block SHALL support a `prompt` template containing exactly usable `{TEXT}` substitution semantics for the source text, and an optional `model` naming an entry of `models.available`; when `translation.model` is absent, the service SHALL fall back to `models.default`. Config loading SHALL reject a non-string prompt, a prompt without `{TEXT}`, or a selected model name that does not exist. The repository's default prompt SHALL follow the single-text translation pattern used by kiss-translator: establish a professional translation role, state the English-to-Simplified-Chinese task, require only the final translation, preserve meaning and tone, and protect Markdown/HTML structure, whitespace, code, math, URLs, identifiers, and placeholders. Changing the prompt or selected translation model SHALL NOT require code changes.

#### Scenario: Assemble prompt from template
- **WHEN** the translation prompt template is `"Translate to Chinese:\n{TEXT}"` and the source text is "Hello"
- **THEN** the prompt sent to the model SHALL be `"Translate to Chinese:\nHello"`

#### Scenario: Translation model overrides the global default
- **WHEN** `translation.model` names `codex-gpt-5.3-codex-spark-xhigh`
- **THEN** the translation service SHALL use that model even when `models.default` names a different model

#### Scenario: Model selection falls back to default
- **WHEN** the `translation` block has no `model` field
- **THEN** the service SHALL use `models.default` as the model

#### Scenario: Invalid translation config rejected at startup
- **WHEN** the `translation` block has a non-string prompt or a prompt without `{TEXT}`
- **THEN** config loading SHALL fail with a validation error naming the `translation.prompt` field

#### Scenario: Unknown translation model rejected at startup
- **WHEN** `translation.model` does not match any `models.available[].name`
- **THEN** config loading SHALL fail before the backend accepts requests and SHALL identify the unknown model name

## ADDED Requirements

### Requirement: Translation model invocation supports optional incremental output
The translation service SHALL invoke every configured provider through one contract that returns the authoritative final text and MAY report ordered non-empty text deltas while generation is in progress. When the selected provider exposes genuine incremental text, the service SHALL forward those deltas in order. When the provider exposes only a final response, the service SHALL still complete successfully without fabricating intermediate deltas. The same invocation SHALL accept cancellation and timeout signals.

#### Scenario: Provider emits multiple translation deltas
- **WHEN** the selected provider emits three ordered text deltas before successful completion
- **THEN** the service SHALL expose the same three deltas in the same order
- **AND** the authoritative completed translation SHALL equal the provider's final text

#### Scenario: Provider only exposes final text
- **WHEN** the selected provider has no incremental output capability
- **THEN** the service SHALL return its final translation through the existing final-string contract
- **AND** SHALL NOT split or replay the final string as fake token chunks

#### Scenario: Invocation is cancelled
- **WHEN** the caller aborts an in-progress translation
- **THEN** the model invocation SHALL be cancelled or its local subprocess SHALL be terminated
- **AND** the service SHALL reject the invocation as cancelled rather than report success

### Requirement: Streaming translation API
The system SHALL expose authenticated `POST /api/translate/stream` accepting `{ text, force? }` and returning `text/event-stream`. The stream SHALL use named `start`, `delta`, `done`, and `error` events whose JSON data uses snake_case. `start` SHALL identify `source_hash`, `cached`, `model_name`, and whether the provider offers true incremental output; each `delta` SHALL carry the next text fragment; `done` SHALL carry the same authoritative translation fields as `POST /api/translate`; and `error` SHALL carry a stable error code and message. Exactly one `done` or `error` terminal event SHALL be emitted.

#### Scenario: Cache miss streams provider output
- **WHEN** a logged-in user requests an uncached text and the selected provider exposes incremental output
- **THEN** the endpoint SHALL emit `start`, followed by ordered `delta` events as text arrives, followed by one `done` event containing the complete translation with `cached: false`

#### Scenario: Cache hit completes without model invocation
- **WHEN** a logged-in user requests text already present in the translation cache without `force`
- **THEN** the endpoint SHALL emit `start` with `cached: true` and then `done` with the stored translation
- **AND** SHALL emit no fabricated `delta` events and SHALL NOT invoke the model

#### Scenario: Non-streaming provider degrades truthfully
- **WHEN** the selected provider exposes only a final response
- **THEN** the endpoint SHALL emit `start` indicating that incremental output is unavailable and one `done` event after completion
- **AND** SHALL NOT claim that the response was token-streamed

#### Scenario: Provider fails after partial output
- **WHEN** one or more `delta` events have been emitted and the provider then fails or times out
- **THEN** the endpoint SHALL emit one `error` terminal event and SHALL NOT emit `done`

#### Scenario: Unauthenticated streaming request
- **WHEN** an unauthenticated request hits `POST /api/translate/stream`
- **THEN** it SHALL be rejected before opening the event stream and no model call SHALL be made

#### Scenario: Client disconnect cancels generation
- **WHEN** the streaming HTTP client disconnects before a terminal event
- **THEN** the endpoint SHALL propagate cancellation to the in-progress provider invocation and release its translation concurrency slot

### Requirement: Completed translations are cached atomically
Only a non-empty authoritative translation from a successfully completed model invocation SHALL be written to the `translations` cache. Incremental text SHALL remain transient until completion. A failed, timed-out, interrupted, or cancelled invocation SHALL NOT create a cache row or replace an existing row. On successful completion, both streaming and non-streaming paths SHALL upsert exactly the same complete translation using the existing `(source_hash, target_lang)` key.

#### Scenario: Successful stream is cached after completion
- **WHEN** a cache miss emits deltas and then completes successfully
- **THEN** no successful cache row SHALL be visible before provider completion
- **AND** the final complete text SHALL be persisted once and returned by a subsequent cache lookup

#### Scenario: Failed first translation is not cached
- **WHEN** an uncached translation emits partial text and then fails
- **THEN** no translation cache row SHALL be created for that `(source_hash, target_lang)`

#### Scenario: Failed forced re-translation preserves prior cache
- **WHEN** `force: true` bypasses an existing cached translation but the replacement invocation fails
- **THEN** the previously completed cached row SHALL remain unchanged

#### Scenario: Streaming and non-streaming callers share cache
- **WHEN** either API path successfully translates a source text
- **THEN** the other API path SHALL subsequently return the same shared cached translation without a new model call

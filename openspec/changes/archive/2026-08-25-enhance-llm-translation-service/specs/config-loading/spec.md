## MODIFIED Requirements

### Requirement: Models configuration
The config SHALL support a `models` section with `default` (string) and `available` (array of model definitions). Each definition SHALL have `name` and one of exactly two supported provider types: `openai_api` or `codex`. Both providers SHALL use an optional `stream` boolean whose absent value defaults to `false`. An `openai_api` definition SHALL retain `endpoint` and `api_key_env`; `stream: false` SHALL use the existing JSON Chat Completions response and `stream: true` SHALL use Chat Completions SSE. A `codex` definition SHALL be independent from OpenAI API fields; `stream: false` SHALL use ephemeral `codex exec`, while `stream: true` SHALL use app-server and require `cli_path`, `codex_home`, provider `model_id`, and MAY configure `reasoning_effort`, timeout, and working directory. The backend SHALL pass `codex_home` to the child as `CODEX_HOME` without copying or parsing its credentials. The former `claude_cli` and `codex_cli` types SHALL be rejected after this breaking change.

#### Scenario: OpenAI API model configured
- **WHEN** config.yml contains a model with `type: openai_api`, `endpoint`, and `api_key_env`
- **THEN** the system SHALL read the API key from the environment variable named in `api_key_env` and route calls to the OpenAI provider

#### Scenario: OpenAI-compatible streaming enabled explicitly
- **WHEN** an `openai_api` model additionally sets `stream: true`
- **THEN** its provider SHALL use the existing endpoint/model semantics and expose genuine Chat Completions text deltas

#### Scenario: Existing Codex shell remains compatible
- **WHEN** an existing model has `type: codex` and `shell` but no `stream`
- **THEN** config loading SHALL accept it as `stream: false` and use ephemeral buffered exec

#### Scenario: Codex app-server profile configured
- **WHEN** a `codex` model sets `stream: true`, an executable `cli_path`, an existing `codex_home`, `model_id: gpt-5.3-codex-spark`, and a known `reasoning_effort`
- **THEN** config loading SHALL expose those values only to the Codex provider and the child SHALL use that `codex_home` for its existing login state

#### Scenario: Incomplete Codex app-server config rejected
- **WHEN** a `codex` model sets `stream: true` but omits `cli_path`, `codex_home`, or `model_id`
- **THEN** config loading SHALL fail with a path-specific error identifying the incomplete model entry

#### Scenario: Removed legacy CLI type rejected
- **WHEN** config.yml contains a model with the former `claude_cli` or `codex_cli` type
- **THEN** config loading SHALL fail with a migration message directing Codex users to `type: codex` and SHALL NOT silently route through a generic CLI provider

## ADDED Requirements

### Requirement: Translation model selection is configuration-driven
The existing `translation.model` field SHALL remain the translation service's dedicated default model selector. When present it SHALL match a `models.available[].name`; when absent the existing `models.default` fallback SHALL remain unchanged. An invalid translation-model reference SHALL fail startup rather than fail on the first translation request.

#### Scenario: Dedicated Spark translation model
- **WHEN** `translation.model` is `codex-gpt-5.3-codex-spark-xhigh` and that name exists in `models.available`
- **THEN** uncached translation calls SHALL use that Codex provider definition while QA and other callers retain their existing model selection

#### Scenario: Translation model omitted
- **WHEN** `translation.model` is absent
- **THEN** translation SHALL continue to use `models.default`

#### Scenario: Translation model reference is invalid
- **WHEN** `translation.model` names no available model
- **THEN** config loading SHALL fail with a descriptive error for `translation.model`

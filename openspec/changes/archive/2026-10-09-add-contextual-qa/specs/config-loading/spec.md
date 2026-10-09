## MODIFIED Requirements

### Requirement: Config schema validation
The config Zod schema and `AppConfig` TypeScript interface SHALL include `qa` (array of `{name: string, prompt: string, system_prompt?: string}`, required) and `qa_prompt` (object with `system_prompts_dir`, `default_system_prompt`, `direct_ask: {system_prompt?, question}`, `codex_web_search`, and `max_history_turns`, all with explicit defaults). They SHALL NOT include a top-level `system_prompt`. Config loading SHALL verify that `default_system_prompt`, `direct_ask.system_prompt`, and every preset's `system_prompt` name an existing file in `system_prompts_dir`, failing with an error naming the missing file otherwise.

#### Scenario: AppConfig type includes template fields
- **WHEN** code accesses `getConfig().qa` or `getConfig().qa_prompt`
- **THEN** TypeScript SHALL recognize these as valid typed fields

#### Scenario: Missing system prompt file
- **WHEN** `qa_prompt.default_system_prompt` is `paper-qa` and `prompts/system/paper-qa.md` does not exist
- **THEN** config loading SHALL fail with an error naming the missing system prompt file

#### Scenario: qa_prompt omitted
- **WHEN** `config.yml` has no `qa_prompt` block
- **THEN** the defaults SHALL apply (the repository's bundled `prompts/system`, `paper-qa`, the default direct-ask question, Codex web search on, at most 20 history turns)

### Requirement: Models configuration
The config SHALL support a `models` section with `default` (string) and `available` (array of model definitions). Each definition SHALL have `name` and one of exactly two supported provider types: `openai_api` or `codex`. Each definition MAY set `vision` (boolean, default `false`) declaring that the model accepts image input; only vision models SHALL be selectable for Q&A entries with image inputs. Both providers SHALL use an optional `stream` boolean whose absent value defaults to `false`. An `openai_api` definition SHALL retain `endpoint` and `api_key_env`; `stream: false` SHALL use the existing JSON Chat Completions response and `stream: true` SHALL use Chat Completions SSE. A `codex` definition SHALL be independent from OpenAI API fields; `stream: false` SHALL use ephemeral `codex exec`, while `stream: true` SHALL use app-server and require `cli_path`, `codex_home`, provider `model_id`, and MAY configure `reasoning_effort`, timeout, and working directory. The backend SHALL pass `codex_home` to the child as `CODEX_HOME` without copying or parsing its credentials. The former `claude_cli` and `codex_cli` types SHALL be rejected after this breaking change.

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

#### Scenario: Vision flag defaults to false
- **WHEN** a model definition omits `vision`
- **THEN** it SHALL be treated as not accepting image input

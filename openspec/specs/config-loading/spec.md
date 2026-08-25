# config-loading Specification

## Purpose
TBD - created by archiving change project-init. Update Purpose after archive.
## Requirements
### Requirement: Config file discovery
The system SHALL locate `config.yml` by traversing upward from `process.cwd()`, checking each directory until the file is found or the filesystem root is reached. If `configPath` is explicitly provided, it SHALL be used directly without traversal. Once found, the config SHALL be validated against the expected schema using Zod. If invalid, the server SHALL fail to start with a descriptive error message.

#### Scenario: Backend started from project root
- **WHEN** backend is started with `cwd` at the project root where `config.yml` exists
- **THEN** the system SHALL find and load `config.yml` from the project root

#### Scenario: Backend started from packages/backend via bun --filter
- **WHEN** backend is started with `cwd` at `packages/backend/` (e.g., via `bun run --filter`)
- **THEN** the system SHALL traverse upward and find `config.yml` in the project root (two levels up)

#### Scenario: Config file not found anywhere
- **WHEN** `config.yml` does not exist in any parent directory
- **THEN** the system SHALL throw an error with a descriptive message

#### Scenario: Explicit configPath provided
- **WHEN** `loadConfig('/custom/path/config.yml')` is called
- **THEN** the system SHALL use that exact path without upward traversal

#### Scenario: Invalid config.yml
- **WHEN** the server starts with a `config.yml` that has missing required fields or invalid values
- **THEN** the server SHALL exit with a Zod validation error describing which fields are invalid

### Requirement: Database configuration
The config SHALL support database configuration with `type` (sqlite or postgresql), `path` (for SQLite), and optional `backup` settings.

#### Scenario: SQLite database config
- **WHEN** config.yml contains `database.type: sqlite` and `database.path: ./data/paperland.db`
- **THEN** the system SHALL use SQLite with the specified file path

#### Scenario: Backup configuration
- **WHEN** config.yml contains `database.backup.enabled: true`, `database.backup.dir`, and `database.backup.retention_days`
- **THEN** the system SHALL use these values for the backup scheduler

### Requirement: Auth configuration
The config SHALL support an `auth.users` array where each entry has `username` and `password` fields.

#### Scenario: Single user configured
- **WHEN** config.yml contains one entry in `auth.users` with username "admin" and password "secret"
- **THEN** the system SHALL accept HTTP Basic Auth with those credentials

### Requirement: Services configuration
The config SHALL support a `services` map where each key is a service name and the value contains `max_concurrency` (integer) and optional `rate_limit_interval` (number, seconds).

#### Scenario: Service with rate limit
- **WHEN** config.yml contains `services.arxiv.max_concurrency: 3` and `services.arxiv.rate_limit_interval: 3`
- **THEN** the system SHALL configure arxiv service to allow max 3 concurrent executions with 3-second cooldown between requests

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

### Requirement: Content priority configuration
The config SHALL support a `content_priority` array of strings defining the priority order for Q&A text context sources.

#### Scenario: Default content priority
- **WHEN** config.yml contains `content_priority: [user_input, pdf_parsed]`
- **THEN** the system SHALL use user_input first, then pdf_parsed when selecting text context for Q&A

### Requirement: Config schema validation
The config Zod schema and `AppConfig` TypeScript interface SHALL be extended to include `system_prompt` (string) and `qa` (array of `{name: string, prompt: string}`) fields. Both are required.

#### Scenario: AppConfig type includes template fields
- **WHEN** code accesses `getConfig().system_prompt` or `getConfig().qa`
- **THEN** TypeScript SHALL recognize these as valid typed fields (`string` and `Array<{name: string, prompt: string}>` respectively)

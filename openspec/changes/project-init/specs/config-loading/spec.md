## ADDED Requirements

### Requirement: Load config.yml at startup
The system SHALL load `config.yml` from the project root at server startup and validate it against the expected schema using Zod. If the file is missing or invalid, the server SHALL fail to start with a descriptive error message.

#### Scenario: Valid config.yml
- **WHEN** the server starts with a valid `config.yml` in the project root
- **THEN** the configuration is parsed, validated, and accessible throughout the application via a typed config object

#### Scenario: Missing config.yml
- **WHEN** the server starts and `config.yml` does not exist
- **THEN** the server SHALL exit with an error message indicating the file is missing

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
The config SHALL support a `models` section with `default` (string) and `available` (array of model definitions). Each model definition SHALL have `name`, `type` (openai_api, claude_cli, or codex_cli), and type-specific fields.

#### Scenario: OpenAI API model configured
- **WHEN** config.yml contains a model with `type: openai_api`, `endpoint`, and `api_key_env`
- **THEN** the system SHALL read the API key from the environment variable named in `api_key_env`

### Requirement: Content priority configuration
The config SHALL support a `content_priority` array of strings defining the priority order for Q&A text context sources.

#### Scenario: Default content priority
- **WHEN** config.yml contains `content_priority: [user_input, alphaxiv, pdf_parsed]`
- **THEN** the system SHALL use user_input first, then alphaxiv, then pdf_parsed when selecting text context for Q&A

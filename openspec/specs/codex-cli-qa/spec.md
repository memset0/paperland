# codex-cli-qa Specification

## Purpose
Codex CLI integration for Q&A — spawn local codex with full env inheritance, stdin prompt piping, timeout, and configurable binary path.

## Requirements

### Requirement: Codex CLI env inheritance
When spawning the codex CLI, the subprocess SHALL inherit all environment variables from the server process.

#### Scenario: Env vars passed through
- **WHEN** the server has CODEX_HOME and custom API key env vars set
- **THEN** the spawned codex process SHALL have access to those same env vars

### Requirement: Stdin prompt piping
The prompt SHALL be passed to the codex CLI via stdin pipe, not command-line arguments.

#### Scenario: Long prompt handling
- **WHEN** a prompt is longer than 100KB
- **THEN** it SHALL be piped via stdin without truncation

### Requirement: Configurable binary path
The model config SHALL support an optional `cli_path` field to specify a custom codex binary location.

#### Scenario: Custom binary
- **WHEN** a model config has `cli_path: /opt/codex/bin/codex`
- **THEN** the system SHALL spawn that specific binary instead of looking up `codex` in PATH

### Requirement: Timeout handling
CLI calls SHALL have a configurable timeout (default 120 seconds) after which the process is killed.

#### Scenario: Timeout exceeded
- **WHEN** the codex process runs longer than the configured timeout
- **THEN** the process SHALL be killed and the QA result SHALL be marked as failed with a timeout error

## MODIFIED Requirements

### Requirement: Config file discovery
The system SHALL locate `config.yml` by traversing upward from `process.cwd()`, checking each directory until the file is found or the filesystem root is reached. If `configPath` is explicitly provided, it SHALL be used directly without traversal.

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

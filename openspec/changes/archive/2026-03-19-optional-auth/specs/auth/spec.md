## ADDED Requirements

### Requirement: Auth enabled toggle in config
The `auth` section in `config.yml` SHALL support an `enabled` field (boolean, default `true`). When `enabled` is `false`, HTTP Basic Auth SHALL be completely disabled for all `/api/*` routes.

#### Scenario: Auth disabled via config
- **WHEN** `config.yml` has `auth.enabled: false`
- **THEN** all `/api/*` requests SHALL be allowed without any authentication

#### Scenario: Auth enabled explicitly
- **WHEN** `config.yml` has `auth.enabled: true` and valid `auth.users`
- **THEN** all `/api/*` requests SHALL require HTTP Basic Auth (existing behavior)

#### Scenario: Auth enabled by default (field omitted)
- **WHEN** `config.yml` does not include `auth.enabled`
- **THEN** the system SHALL behave as if `auth.enabled: true` — Basic Auth is required

### Requirement: Users field optional when auth disabled
When `auth.enabled` is `false`, the `auth.users` field SHALL NOT be required. It MAY be omitted entirely or set to an empty array.

#### Scenario: No users when auth disabled
- **WHEN** `config.yml` has `auth.enabled: false` and `auth.users` is omitted
- **THEN** config validation SHALL pass successfully

#### Scenario: Users still required when auth enabled
- **WHEN** `config.yml` has `auth.enabled: true` (or omitted) and `auth.users` is empty or missing
- **THEN** config validation SHALL fail with an error

### Requirement: Startup warning when auth disabled
When auth is disabled, the server SHALL log a warning message at startup indicating that API authentication is off.

#### Scenario: Warning logged on startup
- **WHEN** the server starts with `auth.enabled: false`
- **THEN** a warning message SHALL be printed to the console (e.g., "WARNING: Auth is disabled — all API routes are publicly accessible")

## MODIFIED Requirements

### Requirement: HTTP Basic Auth for website
All Internal API routes and frontend pages SHALL require HTTP Basic Auth when `auth.enabled` is `true` (default). Credentials SHALL be validated against the `auth.users` array in config.yml. When `auth.enabled` is `false`, no authentication SHALL be required.

#### Scenario: Valid credentials (auth enabled)
- **WHEN** `auth.enabled` is `true` and a request to `/api/papers` includes valid Basic Auth credentials matching an entry in config.yml auth.users
- **THEN** the request SHALL be allowed to proceed

#### Scenario: Invalid credentials (auth enabled)
- **WHEN** `auth.enabled` is `true` and a request to `/api/papers` includes invalid Basic Auth credentials
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: No credentials (auth enabled)
- **WHEN** `auth.enabled` is `true` and a request to `/api/papers` has no Authorization header
- **THEN** the server SHALL respond with 401 Unauthorized and WWW-Authenticate header

#### Scenario: Any request (auth disabled)
- **WHEN** `auth.enabled` is `false` and a request is made to `/api/papers` with no Authorization header
- **THEN** the request SHALL be allowed to proceed

## ADDED Requirements

### Requirement: HTTP Basic Auth for website
All Internal API routes and frontend pages SHALL require HTTP Basic Auth. Credentials SHALL be validated against the `auth.users` array in config.yml.

#### Scenario: Valid credentials
- **WHEN** a request to `/api/papers` includes valid Basic Auth credentials matching an entry in config.yml auth.users
- **THEN** the request SHALL be allowed to proceed

#### Scenario: Invalid credentials
- **WHEN** a request to `/api/papers` includes invalid Basic Auth credentials
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: No credentials
- **WHEN** a request to `/api/papers` has no Authorization header
- **THEN** the server SHALL respond with 401 Unauthorized and WWW-Authenticate header

### Requirement: Basic Auth excludes External API
HTTP Basic Auth SHALL NOT be applied to `/external-api/*` routes. These routes use Bearer Token auth instead.

#### Scenario: External API not blocked by Basic Auth
- **WHEN** a request to `/external-api/v1/papers` has no Basic Auth but has a valid Bearer Token
- **THEN** the request SHALL be allowed to proceed

### Requirement: Bearer Token auth for External API
All `/external-api/*` routes SHALL require a valid Bearer Token in the Authorization header. Tokens SHALL be looked up in the `api_tokens` database table.

#### Scenario: Valid token
- **WHEN** a request to `/external-api/v1/papers` includes `Authorization: Bearer <valid-token>` where the token exists in api_tokens and revoked_at is null
- **THEN** the request SHALL be allowed to proceed

#### Scenario: Revoked token
- **WHEN** a request includes a Bearer Token that exists in api_tokens but has a non-null revoked_at
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Invalid token
- **WHEN** a request includes a Bearer Token that does not exist in api_tokens
- **THEN** the server SHALL respond with 401 Unauthorized

### Requirement: Token issuance API
The Internal API SHALL provide an endpoint to issue new API tokens. The generated token SHALL be stored in the api_tokens table with created_at set to the current time.

#### Scenario: Issue new token
- **WHEN** an authenticated user calls POST `/api/settings/tokens`
- **THEN** the server SHALL generate a random token, store it in api_tokens, and return the token value in the response

### Requirement: Token revocation API
The Internal API SHALL provide an endpoint to revoke an existing API token by setting its revoked_at timestamp.

#### Scenario: Revoke token
- **WHEN** an authenticated user calls DELETE `/api/settings/tokens/:id`
- **THEN** the server SHALL set revoked_at to the current time for that token

### Requirement: Token listing API
The Internal API SHALL provide an endpoint to list all API tokens with their id, masked token value, created_at, and revoked_at.

#### Scenario: List tokens
- **WHEN** an authenticated user calls GET `/api/settings/tokens`
- **THEN** the server SHALL return all tokens with the token value partially masked (e.g., "sk-xxxx...xxxx")

## MODIFIED Requirements

### Requirement: Bearer Token auth for External API
All `/external-api/*` routes SHALL require a valid Bearer Token in the Authorization header. Tokens SHALL be looked up in the `api_tokens` table. On success, the request SHALL be treated as acting on behalf of the token's owning `user_id`, so data created via the External API is owned by that user. Only tokens of kind `personal` SHALL be accepted; an `agent` token SHALL receive 401. A token whose owning user exists but is not `active` (e.g. a pending registration) SHALL receive 401; a legacy token with no owning user SHALL keep working without a user context.

#### Scenario: Valid token resolves owner
- **WHEN** a request to `/external-api/v1/papers` includes `Authorization: Bearer <valid-token>` where the token exists in `api_tokens` and `revoked_at` is null
- **THEN** the request SHALL be allowed and SHALL act as the token's owning user

#### Scenario: Revoked token
- **WHEN** a request includes a Bearer Token that exists but has a non-null `revoked_at`
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Invalid token
- **WHEN** a request includes a Bearer Token that does not exist in `api_tokens`
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Agent token rejected
- **WHEN** a request to `/external-api/v1/papers` uses a user's Codex agent token
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Inactive owner rejected
- **WHEN** a request uses a personal token whose owning user has status `pending`
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Owner-less legacy token
- **WHEN** a request uses a non-revoked token whose `user_id` is null
- **THEN** the request SHALL be allowed without acting as any user

### Requirement: Token revocation API
The Internal API SHALL provide an admin-only endpoint to revoke an existing API token by setting its `revoked_at` timestamp. Agent tokens SHALL NOT be revocable this way (400); only their owner can reset them.

#### Scenario: Revoke token
- **WHEN** an authenticated admin calls `DELETE /api/settings/tokens/:id`
- **THEN** the server SHALL set `revoked_at` to the current time for that token

#### Scenario: Non-admin cannot revoke
- **WHEN** a non-admin or anonymous caller calls `DELETE /api/settings/tokens/:id`
- **THEN** the server SHALL respond with 403 or 401 respectively

#### Scenario: Agent token cannot be revoked by an admin
- **WHEN** an admin calls `DELETE /api/settings/tokens/:id` for an agent token
- **THEN** the server SHALL respond with 400 and the token SHALL stay valid

### Requirement: Token listing API
The Internal API SHALL provide an admin-only endpoint to list all API tokens with their id, kind (`personal` | `agent`), masked token value, owning user, `created_at`, `rotated_at`, and `revoked_at`. For agent tokens the token value SHALL be null (not even masked).

#### Scenario: List tokens
- **WHEN** an authenticated admin calls `GET /api/settings/tokens`
- **THEN** the server SHALL return all tokens with the token value partially masked (e.g., "sk-xxxx...xxxx") and the owning user

#### Scenario: Agent token listed without value
- **WHEN** an admin lists tokens and a user has an agent token
- **THEN** that row SHALL have `kind: "agent"` and `token: null`

## ADDED Requirements

### Requirement: Personal token self-service
Every signed-in user SHALL be able to manage their own personal API tokens, which work for the External API and for `/mcp`: `GET /api/auth/me/tokens` lists the caller's personal tokens (id, masked value, `created_at`, `revoked_at`, newest first) together with their agent token's `created_at` and `rotated_at` (no value); `POST /api/auth/me/tokens` creates a personal token owned by the caller and returns its full value in that response only; `DELETE /api/auth/me/tokens/:id` revokes one of the caller's own personal tokens. A token that is not the caller's, or is not a personal token, SHALL be answered with 404 and left unchanged. Anonymous callers SHALL receive 401. The account dialog SHALL offer listing, creating (showing the new value once), and revoking (after confirmation), and SHALL show the MCP URL.

#### Scenario: New token shown once
- **WHEN** a user creates a personal token and then lists their tokens
- **THEN** the creation response SHALL contain the full value and the listing SHALL show it masked

#### Scenario: Cannot revoke another user's token
- **WHEN** a user calls `DELETE /api/auth/me/tokens/:id` for another user's token
- **THEN** the server SHALL respond with 404 and the token SHALL stay valid

### Requirement: Codex agent token
Every active user SHALL have exactly one API token of kind `agent` (enforced by a unique index on `user_id` for agent tokens). It SHALL be created automatically when a user becomes active (admin creation, registration approval, the initial admin seeding, and a startup backfill for any active user without one) and on demand when it is needed but missing; creation SHALL be idempotent. The agent token is used by the Codex agents Paperland runs on the user's behalf and SHALL only be accepted by `/mcp`. No API SHALL return its value. `POST /api/auth/me/agent-token/reset` SHALL replace its value in place (same row, `rotated_at` set) so that the previous value stops working immediately, returning only `created_at` and `rotated_at`. The account dialog SHALL show "Codex agent token" with its creation or reset time and a Reset button that asks for confirmation.

#### Scenario: Exactly one per user
- **WHEN** the agent token of a user is requested several times, concurrently or not
- **THEN** exactly one agent token row SHALL exist for that user

#### Scenario: Reset invalidates the old value
- **WHEN** a user resets their agent token
- **THEN** the old value SHALL be rejected and a new value SHALL be used for later Deep Research rounds, and the response SHALL NOT contain any token value

#### Scenario: Approved registration gets an agent token
- **WHEN** an admin approves a pending registration
- **THEN** the user SHALL have exactly one agent token

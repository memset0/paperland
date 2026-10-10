## MODIFIED Requirements

### Requirement: Personal token self-service
Every signed-in user SHALL be able to manage their own personal API tokens, which work for the External API and for `/mcp`: `GET /api/auth/me/tokens` lists the caller's personal tokens (id, masked value, `created_at`, `revoked_at`, newest first) together with their agent token's `created_at` and `rotated_at` (no value); `POST /api/auth/me/tokens` creates a personal token owned by the caller and returns its full value in that response only; `DELETE /api/auth/me/tokens/:id` revokes one of the caller's own personal tokens. A token that is not the caller's, or is not a personal token, SHALL be answered with 404 and left unchanged. Anonymous callers SHALL receive 401. The API Tokens section of the Settings page's Account area SHALL offer listing, creating (showing the new value once), and revoking (after confirmation), and SHALL show the MCP URL.

#### Scenario: New token shown once
- **WHEN** a user creates a personal token and then lists their tokens
- **THEN** the creation response SHALL contain the full value and the listing SHALL show it masked

#### Scenario: Cannot revoke another user's token
- **WHEN** a user calls `DELETE /api/auth/me/tokens/:id` for another user's token
- **THEN** the server SHALL respond with 404 and the token SHALL stay valid

### Requirement: Codex agent token
Every active user SHALL have exactly one API token of kind `agent` (enforced by a unique index on `user_id` for agent tokens). It SHALL be created automatically when a user becomes active (admin creation, registration approval, the initial admin seeding, and a startup backfill for any active user without one) and on demand when it is needed but missing; creation SHALL be idempotent. The agent token is used by the Codex agents Paperland runs on the user's behalf and SHALL only be accepted by `/mcp`. No API SHALL return its value. `POST /api/auth/me/agent-token/reset` SHALL replace its value in place (same row, `rotated_at` set) so that the previous value stops working immediately, returning only `created_at` and `rotated_at`. The same section SHALL show "Codex agent token" with its creation or reset time and a Reset button that asks for confirmation.

#### Scenario: Exactly one per user
- **WHEN** the agent token of a user is requested several times, concurrently or not
- **THEN** exactly one agent token row SHALL exist for that user

#### Scenario: Reset invalidates the old value
- **WHEN** a user resets their agent token
- **THEN** the old value SHALL be rejected and a new value SHALL be used for later Deep Research rounds, and the response SHALL NOT contain any token value

#### Scenario: Approved registration gets an agent token
- **WHEN** an admin approves a pending registration
- **THEN** the user SHALL have exactly one agent token

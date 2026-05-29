# auth Specification

## Purpose
Authentication and authorization for Paperland. HTTP Basic Auth (optionally disabled) for website `/api/*` routes, Bearer Token auth for `/external-api/*` routes.
## Requirements
### Requirement: Auth enabled toggle in config
The `auth` section in `config.yml` SHALL support an `enabled` field (boolean, default `true`). When `enabled` is `true` (or omitted), the website SHALL use session-based login with the tiered access model. When `enabled` is `false`, the website SHALL bypass login and treat every `/api/*` request as an authenticated admin (development convenience).

#### Scenario: Auth disabled via config
- **WHEN** `config.yml` has `auth.enabled: false`
- **THEN** all `/api/*` requests SHALL be permitted as an admin without any login

#### Scenario: Auth enabled explicitly
- **WHEN** `config.yml` has `auth.enabled: true`
- **THEN** the website SHALL require session login and enforce the authorization tiers

#### Scenario: Auth enabled by default (field omitted)
- **WHEN** `config.yml` does not include `auth.enabled`
- **THEN** the system SHALL behave as if `auth.enabled: true`

### Requirement: Startup warning when auth disabled
When auth is disabled (development bypass), the server SHALL log a warning at startup indicating that login is bypassed and all API routes are accessible as admin.

#### Scenario: Warning logged on startup
- **WHEN** the server starts with `auth.enabled: false`
- **THEN** a warning message SHALL be printed to the console (e.g., "WARNING: Auth is disabled — all API routes are accessible as admin")

### Requirement: Bearer Token auth for External API
All `/external-api/*` routes SHALL require a valid Bearer Token in the Authorization header. Tokens SHALL be looked up in the `api_tokens` table. On success, the request SHALL be treated as acting on behalf of the token's owning `user_id`, so data created via the External API is owned by that user.

#### Scenario: Valid token resolves owner
- **WHEN** a request to `/external-api/v1/papers` includes `Authorization: Bearer <valid-token>` where the token exists in `api_tokens` and `revoked_at` is null
- **THEN** the request SHALL be allowed and SHALL act as the token's owning user

#### Scenario: Revoked token
- **WHEN** a request includes a Bearer Token that exists but has a non-null `revoked_at`
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Invalid token
- **WHEN** a request includes a Bearer Token that does not exist in `api_tokens`
- **THEN** the server SHALL respond with 401 Unauthorized

### Requirement: Token issuance API
The Internal API SHALL provide an admin-only endpoint to issue new API tokens. The generated token SHALL be stored in `api_tokens` with `created_at` set to the current time and an owning `user_id` (defaulting to the issuing admin, or a specified user).

#### Scenario: Issue new token
- **WHEN** an authenticated admin calls `POST /api/settings/tokens`
- **THEN** the server SHALL generate a random token, store it with an owning `user_id`, and return the token value in the response

#### Scenario: Non-admin cannot issue token
- **WHEN** a `user`-role account or an anonymous caller calls `POST /api/settings/tokens`
- **THEN** the server SHALL respond with 403 (non-admin) or 401 (anonymous)

### Requirement: Token revocation API
The Internal API SHALL provide an admin-only endpoint to revoke an existing API token by setting its `revoked_at` timestamp.

#### Scenario: Revoke token
- **WHEN** an authenticated admin calls `DELETE /api/settings/tokens/:id`
- **THEN** the server SHALL set `revoked_at` to the current time for that token

#### Scenario: Non-admin cannot revoke
- **WHEN** a non-admin or anonymous caller calls `DELETE /api/settings/tokens/:id`
- **THEN** the server SHALL respond with 403 or 401 respectively

### Requirement: Token listing API
The Internal API SHALL provide an admin-only endpoint to list all API tokens with their id, masked token value, owning user, `created_at`, and `revoked_at`.

#### Scenario: List tokens
- **WHEN** an authenticated admin calls `GET /api/settings/tokens`
- **THEN** the server SHALL return all tokens with the token value partially masked (e.g., "sk-xxxx...xxxx") and the owning user

### Requirement: Authorization tiers for website API
The website Internal API SHALL enforce three access tiers. Public endpoints SHALL be reachable without authentication; login-required endpoints SHALL require an authenticated user; admin-only endpoints SHALL require the `admin` role. `/external-api/*` SHALL remain governed solely by Bearer Token auth and SHALL NOT be subject to website session auth. Identity SHALL be resolved once per request; authorization SHALL be enforced per route.

- **Public (no login):** `GET /api/health`; `GET /api/papers`; `GET /api/papers/:id`; `GET /api/templates`; `GET /api/files/*`; `POST /api/auth/login`; `GET /api/auth/me`. Owner-scoped reads (`GET /api/papers/:id/qa`, `GET /api/highlights`, `GET /api/papers/:id/tags`) are reachable anonymously but return only public/template data plus the current user's private rows (empty when anonymous).
- **Login required (any authenticated user):** creating/editing/deleting papers and `PUT /api/papers/:id/tags`; all QA generation/regeneration/result-deletion (`/api/papers/:id/qa/*`, `/api/qa/*`); highlight create/update/delete; tag management (`/api/tags*`); `GET /api/qa/free`; `GET /api/config/models`; all `/api/idea-forge/*`; per-paper service status/trigger (`/api/papers/:id/services*`); `POST /api/auth/logout`; `PATCH /api/auth/me`.
- **Admin only:** the global Services dashboard (`GET /api/services`, `GET /api/services/executions`); token management (`/api/settings/tokens*`); user management (`/api/users*`).

#### Scenario: Anonymous reads public paper data
- **WHEN** an anonymous client calls `GET /api/papers` or `GET /api/papers/:id`
- **THEN** the request SHALL succeed and return paper data

#### Scenario: Anonymous write rejected
- **WHEN** an anonymous client calls a login-required endpoint such as `POST /api/papers` or `POST /api/papers/:id/qa/free`
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Non-admin blocked from admin endpoints
- **WHEN** an authenticated `user`-role account calls an admin-only endpoint such as `GET /api/services` or `GET /api/users`
- **THEN** the server SHALL respond with 403 Forbidden

#### Scenario: Admin allowed on admin endpoints
- **WHEN** an authenticated `admin` calls an admin-only endpoint
- **THEN** the request SHALL be allowed

#### Scenario: External API unaffected by website auth
- **WHEN** an `/external-api/*` request presents a valid Bearer Token but no session cookie
- **THEN** the request SHALL be allowed (governed by token auth, not website session auth)

### Requirement: Public read access without login
Anonymous visitors SHALL be able to browse papers and view template Q&A and the paper viewers, but SHALL NOT be able to perform any write or LLM-triggering action.

#### Scenario: Anonymous views template QA
- **WHEN** an anonymous visitor opens a paper detail page
- **THEN** the paper's basic fields, template Q&A results, and viewers SHALL be visible, while free QA, highlights, and tags SHALL NOT be visible and action controls SHALL prompt for login


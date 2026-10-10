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
The website Internal API SHALL require an authenticated, active user for every `/api/*` request, except for this anonymous allowlist: `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, and `GET /api/notes/:noteId` (which still only returns published notes to anonymous callers). Any other `/api/*` request without a session SHALL be rejected with 401 before the route runs. Within the authenticated tier, admin-only endpoints SHALL additionally require the `admin` role. `/external-api/*` SHALL remain governed solely by Bearer Token auth and SHALL NOT be subject to website session auth. `/image/*` (image host) SHALL stay public. Identity SHALL be resolved once per request.

- **Anonymous allowlist:** as listed above.
- **Login required (any authenticated user):** everything else under `/api/*` that is not admin-only, including paper list/detail, Q&A, PDFs (`/api/files/*`), conferences, templates, notes, highlights, tags.
- **Admin only:** the global Services dashboard (`GET /api/services`, `GET /api/services/executions`); token management (`/api/settings/tokens*`); user management (`/api/users*`).

#### Scenario: Anonymous reads public paper data
- **WHEN** an anonymous client calls `GET /api/papers`, `GET /api/papers/:id`, `GET /api/templates`, or `GET /api/conferences`
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Anonymous allowlist reachable
- **WHEN** an anonymous client calls `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/register`, or `GET /api/notes/:noteId` for a published note
- **THEN** the request SHALL reach its handler and behave as specified for anonymous callers

#### Scenario: Anonymous write rejected
- **WHEN** an anonymous client calls a write endpoint such as `POST /api/papers` or `POST /api/papers/:id/qa/free`
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

#### Scenario: Image host stays public
- **WHEN** an anonymous client requests an existing `/image/<hash>` file
- **THEN** the image SHALL be served without login

### Requirement: PDF file serving confined to data directory
`GET /api/files/*` SHALL require login (through the website login wall) and SHALL serve a file only when its resolved path lies inside the project `data/` directory and has a `.pdf` extension. Any other path — outside `data/` (including `..` traversal or absolute paths), a non-PDF file such as the database, or a missing file — SHALL respond 404.

#### Scenario: Paper PDF served
- **WHEN** a logged-in user requests `/api/files/data%2Fpdfs%2F<file>.pdf` for an existing file
- **THEN** the PDF SHALL be served

#### Scenario: Traversal or non-PDF rejected
- **WHEN** a logged-in user requests `/api/files/..%2Fconfig.yml` or `/api/files/data%2Fpaperland.db`
- **THEN** the server SHALL respond 404

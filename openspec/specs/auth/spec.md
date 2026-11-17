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
All `/external-api/*` routes SHALL require a valid Bearer Token in the Authorization header, which SHALL be the key of a non-revoked Plugins service (see the mcp-services capability). The request SHALL act on behalf of the service owner, so data created via the External API is owned by that user. Methods other than GET and HEAD SHALL require the service's `write` permission (403 otherwise). Agent tokens SHALL receive 401. A key whose owning user is not `active` (e.g. a pending registration) SHALL receive 401.

#### Scenario: Valid token resolves owner
- **WHEN** a request to `/external-api/v1/papers` includes `Authorization: Bearer <key>` for an active service
- **THEN** the request SHALL be allowed and SHALL act as the service owner

#### Scenario: Revoked token
- **WHEN** a request includes the key of a revoked service
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Invalid token
- **WHEN** a request includes a Bearer Token that matches no service
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Agent token rejected
- **WHEN** a request to `/external-api/v1/papers` uses a user's Codex agent token
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Inactive owner rejected
- **WHEN** a request uses a service key whose owning user has status `pending`
- **THEN** the server SHALL respond with 401 Unauthorized

#### Scenario: Owner-less legacy token
- **WHEN** a request uses a non-revoked token row whose `user_id` is null
- **THEN** the server SHALL respond with 401 Unauthorized, because only owned services are accepted

#### Scenario: Read-only service cannot write
- **WHEN** a service with `write` disabled sends a POST to the External API
- **THEN** the server SHALL respond with 403 and change nothing

### Requirement: Token revocation API
The Internal API SHALL provide an admin-only endpoint to revoke a Plugins service of any user by setting its `revoked_at` timestamp. Agent tokens SHALL NOT be revocable this way (400); only their owner can reset them.

#### Scenario: Revoke token
- **WHEN** an authenticated admin calls `DELETE /api/settings/tokens/:id` for a service
- **THEN** the server SHALL set `revoked_at` to the current time and its key SHALL stop working

#### Scenario: Non-admin cannot revoke
- **WHEN** a non-admin or anonymous caller calls `DELETE /api/settings/tokens/:id`
- **THEN** the server SHALL respond with 403 or 401 respectively

#### Scenario: Agent token cannot be revoked by an admin
- **WHEN** an admin calls `DELETE /api/settings/tokens/:id` for an agent token
- **THEN** the server SHALL respond with 400 and the token SHALL stay valid

### Requirement: Token listing API
The Internal API SHALL provide an admin-only endpoint to list agent tokens and Plugins services with their id, kind (`agent` | `service`), service name, owning user, `created_at`, `rotated_at` and `revoked_at`. It SHALL NOT return any token or key value, masked or not.

#### Scenario: List tokens
- **WHEN** an authenticated admin calls `GET /api/settings/tokens`
- **THEN** the server SHALL return agent tokens and services with their owner and no values

#### Scenario: Agent token listed without value
- **WHEN** an admin lists tokens and a user has an agent token
- **THEN** that row SHALL have `kind: "agent"` and `token: null`

#### Scenario: Topic credential remains member-scoped
- **WHEN** an admin lists tokens after the legacy Topic tokens were converted
- **THEN** the converted rows SHALL appear as services named "Topic token <id>" with no value, and no `topic` kind SHALL be listed

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

### Requirement: Codex agent token
Every active user SHALL have exactly one API token of kind `agent` (enforced by a unique index on `user_id` for agent tokens). It SHALL be created automatically when a user becomes active (admin creation, registration approval, the initial admin seeding, and a startup backfill for any active user without one) and on demand when it is needed but missing; creation SHALL be idempotent. The agent token is used by the Codex agents Paperland runs on the user's behalf and SHALL only be accepted by `/mcp`. No API SHALL return its value. `POST /api/auth/me/agent-token/reset` SHALL replace its value in place (same row, `rotated_at` set) so that the previous value stops working immediately, returning only `created_at` and `rotated_at`; `GET /api/auth/me/agent-token` SHALL return those two times. The Settings page SHALL show "Codex agent token" with its creation or reset time and a Reset button that asks for confirmation, and SHALL point to the Plugins page for connecting external apps.

#### Scenario: Exactly one per user
- **WHEN** the agent token of a user is requested several times, concurrently or not
- **THEN** exactly one agent token row SHALL exist for that user

#### Scenario: Reset invalidates the old value
- **WHEN** a user resets their agent token
- **THEN** the old value SHALL be rejected and a new value SHALL be used for later Deep Research rounds, and the response SHALL NOT contain any token value

#### Scenario: Approved registration gets an agent token
- **WHEN** an admin approves a pending registration
- **THEN** the user SHALL have exactly one agent token

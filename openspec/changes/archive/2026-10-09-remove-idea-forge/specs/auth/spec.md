## MODIFIED Requirements

### Requirement: Authorization tiers for website API
The website Internal API SHALL enforce three access tiers. Public endpoints SHALL be reachable without authentication; login-required endpoints SHALL require an authenticated user; admin-only endpoints SHALL require the `admin` role. `/external-api/*` SHALL remain governed solely by Bearer Token auth and SHALL NOT be subject to website session auth. Identity SHALL be resolved once per request; authorization SHALL be enforced per route.

- **Public (no login):** `GET /api/health`; `GET /api/papers`; `GET /api/papers/:id`; `GET /api/templates`; `GET /api/files/*`; `POST /api/auth/login`; `GET /api/auth/me`. Owner-scoped reads (`GET /api/papers/:id/qa`, `GET /api/highlights`, `GET /api/papers/:id/tags`) are reachable anonymously but return only public/template data plus the current user's private rows (empty when anonymous).
- **Login required (any authenticated user):** creating/editing/deleting papers and `PUT /api/papers/:id/tags`; all QA generation/regeneration/result-deletion (`/api/papers/:id/qa/*`, `/api/qa/*`); highlight create/update/delete; tag management (`/api/tags*`); `GET /api/qa/free`; `GET /api/config/models`; per-paper service status/trigger (`/api/papers/:id/services*`); `POST /api/auth/logout`; `PATCH /api/auth/me`.
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


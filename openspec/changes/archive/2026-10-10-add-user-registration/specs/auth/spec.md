## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: PDF file serving confined to data directory
`GET /api/files/*` SHALL require login (through the website login wall) and SHALL serve a file only when its resolved path lies inside the project `data/` directory and has a `.pdf` extension. Any other path — outside `data/` (including `..` traversal or absolute paths), a non-PDF file such as the database, or a missing file — SHALL respond 404.

#### Scenario: Paper PDF served
- **WHEN** a logged-in user requests `/api/files/data%2Fpdfs%2F<file>.pdf` for an existing file
- **THEN** the PDF SHALL be served

#### Scenario: Traversal or non-PDF rejected
- **WHEN** a logged-in user requests `/api/files/..%2Fconfig.yml` or `/api/files/data%2Fpaperland.db`
- **THEN** the server SHALL respond 404

## REMOVED Requirements

### Requirement: Public read access without login
**Reason**: The site becomes members-only; anonymous visitors can no longer browse papers, template Q&A, or viewers.
**Migration**: Anonymous visitors log in or register (pending admin approval). Published note links remain readable anonymously (see `public-notes`).

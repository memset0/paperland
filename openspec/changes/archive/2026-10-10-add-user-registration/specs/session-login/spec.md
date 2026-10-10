## MODIFIED Requirements

### Requirement: Login endpoint
`POST /api/auth/login` SHALL accept `{ username, password }`, verify the credentials against the `users` table, and on success for an `active` account SHALL create a session row and set the `paperland_session` cookie. On failure it SHALL respond 401 without revealing whether the username or the password was incorrect. For a `pending` account with correct credentials it SHALL respond 403 `ACCOUNT_PENDING` without creating a session.

#### Scenario: Valid credentials
- **WHEN** `POST /api/auth/login` is called with a correct username and password of an active account
- **THEN** the system SHALL create a session, set the httpOnly cookie, and return the authenticated user (`id`, `username`, `role`)

#### Scenario: Invalid credentials
- **WHEN** `POST /api/auth/login` is called with a wrong username or password
- **THEN** the system SHALL respond with 401 and a generic message that does not distinguish the two cases

#### Scenario: Pending account
- **WHEN** `POST /api/auth/login` is called with the correct credentials of a pending account
- **THEN** the system SHALL respond 403 with code `ACCOUNT_PENDING` and SHALL NOT create a session

### Requirement: Current user endpoint
`GET /api/auth/me` SHALL return the current authenticated user (`id`, `username`, `role`) or a null user when not authenticated, together with `registration_enabled` (boolean, from `auth.registration_enabled`), and SHALL NOT respond 401 for anonymous callers.

#### Scenario: Authenticated caller
- **WHEN** an authenticated user calls `GET /api/auth/me`
- **THEN** the response SHALL include their `id`, `username`, and `role`

#### Scenario: Anonymous caller
- **WHEN** an anonymous client calls `GET /api/auth/me`
- **THEN** the response SHALL indicate no user (e.g., `{ "user": null, "registration_enabled": true }`) with HTTP 200

### Requirement: Route guards for restricted pages
Every frontend route SHALL require authentication, and `/services`, `/settings` and `/translation-test` SHALL additionally require the `admin` role. When the visitor is anonymous, the app SHALL render a full-page Login / Register screen instead of the app shell (no sidebar, no page content), for any route; after a successful login the originally requested route SHALL render. The only exception is a published-note link (`/papers/:id?note=:noteId`), which renders the standalone public note view (see `public-notes`). When a non-admin navigates to an admin-only route, the system SHALL indicate the page requires admin.

#### Scenario: Anonymous user opens a login-only route
- **WHEN** an anonymous visitor opens `/`, `/papers/1`, `/qa`, or any other route without a `?note=` link
- **THEN** the system SHALL show the full-page Login / Register screen and no app content

#### Scenario: Login continues to the requested route
- **WHEN** an anonymous visitor opened `/papers/5` and then logs in successfully on the login screen
- **THEN** the paper detail page for paper 5 SHALL render

#### Scenario: Non-admin opens an admin-only route
- **WHEN** an authenticated `user`-role account navigates to `/services` or `/settings`
- **THEN** the system SHALL deny access and indicate the page requires admin privileges

#### Scenario: Admin opens an admin-only route
- **WHEN** an authenticated `admin` navigates to `/services` or `/settings`
- **THEN** the page SHALL load normally

### Requirement: Client sends session and handles 401
The frontend API client SHALL send the same-origin session cookie with every request, and when a request returns 401 it SHALL clear the local user so the full-page login screen appears, instead of a raw error toast.

#### Scenario: 401 surfaces login prompt
- **WHEN** an API request returns 401 (e.g., the session expired)
- **THEN** the client SHALL clear the current user and the login screen SHALL be shown rather than only a generic error

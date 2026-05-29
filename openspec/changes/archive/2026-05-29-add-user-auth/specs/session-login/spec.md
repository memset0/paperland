## ADDED Requirements

### Requirement: Session-based website authentication
The website `/api/*` routes SHALL authenticate via an opaque session stored in a `sessions` table (`id` text primary key holding a random token, `user_id` referencing `users.id`, `created_at`, `expires_at`) together with an httpOnly cookie named `paperland_session` carrying the session id. The cookie SHALL be set with `HttpOnly`, `SameSite=Lax`, and `Path=/`.

#### Scenario: Identity resolved from session cookie
- **WHEN** a request carries a valid, non-expired `paperland_session` cookie
- **THEN** the system SHALL resolve the associated user and treat the request as authenticated as that user

#### Scenario: Missing or invalid cookie is anonymous
- **WHEN** a request has no `paperland_session` cookie, or one that does not match any session
- **THEN** the system SHALL treat the request as anonymous (not authenticated)

### Requirement: Login endpoint
`POST /api/auth/login` SHALL accept `{ username, password }`, verify the credentials against the `users` table, and on success SHALL create a session row and set the `paperland_session` cookie. On failure it SHALL respond 401 without revealing whether the username or the password was incorrect.

#### Scenario: Valid credentials
- **WHEN** `POST /api/auth/login` is called with a correct username and password
- **THEN** the system SHALL create a session, set the httpOnly cookie, and return the authenticated user (`id`, `username`, `role`)

#### Scenario: Invalid credentials
- **WHEN** `POST /api/auth/login` is called with a wrong username or password
- **THEN** the system SHALL respond with 401 and a generic message that does not distinguish the two cases

### Requirement: Logout endpoint
`POST /api/auth/logout` SHALL delete the current session row and clear the `paperland_session` cookie.

#### Scenario: Logout clears session
- **WHEN** an authenticated user calls `POST /api/auth/logout`
- **THEN** the session SHALL be deleted, the cookie cleared, and subsequent requests SHALL be anonymous

### Requirement: Current user endpoint
`GET /api/auth/me` SHALL return the current authenticated user (`id`, `username`, `role`) or a null user when not authenticated, and SHALL NOT respond 401 for anonymous callers.

#### Scenario: Authenticated caller
- **WHEN** an authenticated user calls `GET /api/auth/me`
- **THEN** the response SHALL include their `id`, `username`, and `role`

#### Scenario: Anonymous caller
- **WHEN** an anonymous client calls `GET /api/auth/me`
- **THEN** the response SHALL indicate no user (e.g., `{ "user": null }`) with HTTP 200

### Requirement: Session expiry
Sessions SHALL have an expiry (default 30 days from creation). A request presenting an expired or unknown session SHALL be treated as anonymous.

#### Scenario: Expired session treated as anonymous
- **WHEN** a request carries a `paperland_session` cookie whose session `expires_at` is in the past
- **THEN** the system SHALL treat the request as anonymous and MAY remove the stale session row

### Requirement: Development bypass when auth disabled
When `config.yml` `auth.enabled` is `false`, the system SHALL bypass session login and treat every `/api/*` request as an authenticated admin (development convenience), and SHALL log a startup warning that authentication is bypassed.

#### Scenario: Auth disabled bypasses login
- **WHEN** `auth.enabled` is `false`
- **THEN** all `/api/*` requests SHALL be permitted as an admin without any cookie, and a warning SHALL be logged at startup

#### Scenario: Auth enabled requires login
- **WHEN** `auth.enabled` is `true` (or omitted)
- **THEN** session-based authentication and the authorization tiers SHALL apply

### Requirement: Frontend authentication state
The frontend SHALL maintain authentication state in a Pinia store that loads `GET /api/auth/me` on application startup and exposes at least `isAuthenticated`, `isAdmin`, and the current user, plus actions for login, logout, and account update.

#### Scenario: State loaded on startup
- **WHEN** the app loads
- **THEN** the auth store SHALL call `GET /api/auth/me` and populate the current user (or null)

#### Scenario: State updates after login and logout
- **WHEN** the user logs in or out
- **THEN** the store SHALL update `isAuthenticated`/`isAdmin` and the UI SHALL reflect the new state without a full reload

### Requirement: Route guards for restricted pages
Restricted routes SHALL require authentication, and `/services` and `/settings` SHALL additionally require the `admin` role. The restricted routes are `/tags`, `/qa`, `/idea-forge`, `/idea-forge/:projectName`, `/services`, and `/settings`. When an unauthenticated user navigates to a restricted route, the system SHALL prompt for login rather than silently failing; when a non-admin navigates to an admin-only route, the system SHALL indicate the page requires admin.

#### Scenario: Anonymous user opens a login-only route
- **WHEN** an anonymous user navigates to `/tags`, `/qa`, or `/idea-forge`
- **THEN** the system SHALL show a login prompt instead of the page content

#### Scenario: Non-admin opens an admin-only route
- **WHEN** an authenticated `user`-role account navigates to `/services` or `/settings`
- **THEN** the system SHALL deny access and indicate the page requires admin privileges

#### Scenario: Admin opens an admin-only route
- **WHEN** an authenticated `admin` navigates to `/services` or `/settings`
- **THEN** the page SHALL load normally

### Requirement: Client sends session and handles 401
The frontend API client SHALL send the same-origin session cookie with every request, and when a request returns 401 it SHALL surface a login prompt instead of a raw error toast.

#### Scenario: 401 surfaces login prompt
- **WHEN** an API request returns 401 (e.g., the session expired)
- **THEN** the client SHALL trigger the login prompt rather than only showing a generic error

## MODIFIED Requirements

### Requirement: User account data model
The system SHALL store user accounts in a `users` table with fields: `id` (autoincrement primary key), `username` (text, unique), `nickname` (nullable text, NOT unique), `password_hash` (text), `role` (text, one of `admin` or `user`), and `created_at` (ISO 8601 text). Ownership of user-private data SHALL reference `users.id` (immutable) rather than `username` (mutable), so renaming a user does not affect data ownership. A user's display name SHALL be their `nickname` when set, otherwise their `username`.

#### Scenario: User record structure
- **WHEN** a user account is created
- **THEN** the record SHALL contain a unique `username`, a hashed `password_hash`, a `role` of `admin` or `user`, a `created_at` timestamp, and a `nickname` of `null`

#### Scenario: Username uniqueness enforced
- **WHEN** an attempt is made to create a user with a `username` that already exists
- **THEN** the system SHALL reject the request and SHALL NOT create a duplicate user

#### Scenario: Nicknames may repeat
- **WHEN** two users set the same `nickname`
- **THEN** the system SHALL accept both

### Requirement: Admin user management API
The system SHALL provide admin-only Internal API endpoints to list users, create a user (with an initial password and role), update a user's role or nickname, and reset a user's password. The system SHALL NOT provide a user-deletion endpoint.

#### Scenario: List users
- **WHEN** an admin calls `GET /api/users`
- **THEN** the system SHALL return all users with `id`, `username`, `nickname`, `role`, and `created_at` (no password material)

#### Scenario: Create user
- **WHEN** an admin calls `POST /api/users` with `{ username, password, role }`
- **THEN** the system SHALL create the user with a hashed password and return the created user

#### Scenario: Change role
- **WHEN** an admin calls `PATCH /api/users/:id` with `{ role }`
- **THEN** the system SHALL update that user's role

#### Scenario: Change another user's nickname
- **WHEN** an admin calls `PATCH /api/users/:id` with `{ nickname }`
- **THEN** the system SHALL apply the same nickname normalization as self-service update and store the result

#### Scenario: Reset password
- **WHEN** an admin calls `PATCH /api/users/:id` with `{ password }`
- **THEN** the system SHALL set that user's password to the new hashed value

#### Scenario: Non-admin forbidden
- **WHEN** a `user`-role account or an anonymous caller accesses any `/api/users` endpoint
- **THEN** the system SHALL respond with 403 (authenticated non-admin) or 401 (anonymous)

### Requirement: Self-service account update
The system SHALL allow any authenticated user to change their own `username`, `nickname`, and `password` via `PATCH /api/auth/me`. Changing the password SHALL require providing the correct current password. A `nickname` SHALL be trimmed; an empty result or `null` SHALL clear it; a string longer than 32 characters after trimming or a non-string value SHALL be rejected with 400 without changing anything. The returned and session user (`/api/auth/me`, login) SHALL include `nickname`.

#### Scenario: Change own username
- **WHEN** an authenticated user calls `PATCH /api/auth/me` with a new unique `username`
- **THEN** the system SHALL update their username; data ownership SHALL be unaffected because it references `users.id`

#### Scenario: Set own nickname
- **WHEN** an authenticated user calls `PATCH /api/auth/me` with `{ nickname: "  Alice W  " }`
- **THEN** the system SHALL store `Alice W` and return it in the user object

#### Scenario: Clear own nickname
- **WHEN** an authenticated user calls `PATCH /api/auth/me` with `{ nickname: "" }`
- **THEN** the system SHALL store `null` and their display name SHALL fall back to their username

#### Scenario: Nickname too long
- **WHEN** an authenticated user sends a nickname longer than 32 characters
- **THEN** the system SHALL respond 400 and SHALL NOT change the account

#### Scenario: Change own password with correct current password
- **WHEN** an authenticated user calls `PATCH /api/auth/me` with `{ current_password, password }` and `current_password` is correct
- **THEN** the system SHALL update the password to the new hashed value

#### Scenario: Change own password with wrong current password
- **WHEN** the provided `current_password` does not match
- **THEN** the system SHALL reject the change with an error and SHALL NOT change the password

#### Scenario: Username conflict on self-update
- **WHEN** an authenticated user tries to change their `username` to one already taken by another user
- **THEN** the system SHALL reject the change with a conflict error

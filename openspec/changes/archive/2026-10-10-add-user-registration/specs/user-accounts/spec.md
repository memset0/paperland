## MODIFIED Requirements

### Requirement: User account data model
The system SHALL store user accounts in a `users` table with fields: `id` (autoincrement primary key), `username` (text, unique), `nickname` (nullable text, NOT unique), `password_hash` (text), `role` (text, one of `admin` or `user`), `status` (text, one of `active` or `pending`, default `active`), and `created_at` (ISO 8601 text). Ownership of user-private data SHALL reference `users.id` (immutable) rather than `username` (mutable), so renaming a user does not affect data ownership. A user's display name SHALL be their `nickname` when set, otherwise their `username`. Accounts created by an admin or at first startup SHALL be `active`; self-registered accounts SHALL start `pending`.

#### Scenario: User record structure
- **WHEN** a user account is created by an admin
- **THEN** the record SHALL contain a unique `username`, a hashed `password_hash`, a `role` of `admin` or `user`, `status` `active`, a `created_at` timestamp, and a `nickname` of `null`

#### Scenario: Username uniqueness enforced
- **WHEN** an attempt is made to create a user with a `username` that already exists
- **THEN** the system SHALL reject the request and SHALL NOT create a duplicate user

#### Scenario: Nicknames may repeat
- **WHEN** two users set the same `nickname`
- **THEN** the system SHALL accept both

### Requirement: Admin user management API
The system SHALL provide admin-only Internal API endpoints to list users, create a user (with an initial password and role), update a user's role or nickname, reset a user's password, approve a pending user, and delete (reject) a pending user. The system SHALL NOT allow deleting an active user.

#### Scenario: List users
- **WHEN** an admin calls `GET /api/users`
- **THEN** the system SHALL return all users with `id`, `username`, `nickname`, `role`, `status`, and `created_at` (no password material)

#### Scenario: Create user
- **WHEN** an admin calls `POST /api/users` with `{ username, password, role }`
- **THEN** the system SHALL create an active user with a hashed password and return the created user

#### Scenario: Change role
- **WHEN** an admin calls `PATCH /api/users/:id` with `{ role }`
- **THEN** the system SHALL update that user's role

#### Scenario: Change another user's nickname
- **WHEN** an admin calls `PATCH /api/users/:id` with `{ nickname }`
- **THEN** the system SHALL apply the same nickname normalization as self-service update and store the result

#### Scenario: Reset password
- **WHEN** an admin calls `PATCH /api/users/:id` with `{ password }`
- **THEN** the system SHALL set that user's password to the new hashed value

#### Scenario: Approve and reject pending users
- **WHEN** an admin calls `POST /api/users/:id/approve` or `DELETE /api/users/:id` on a pending user
- **THEN** the user SHALL become active, or be deleted, respectively

#### Scenario: Non-admin forbidden
- **WHEN** a `user`-role account or an anonymous caller accesses any `/api/users` endpoint
- **THEN** the system SHALL respond with 403 (authenticated non-admin) or 401 (anonymous)

# user-accounts Specification

## Purpose
TBD - created by archiving change add-user-auth. Update Purpose after archive.

## Requirements

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

### Requirement: Passwords stored hashed
The system SHALL hash passwords using `Bun.password` (argon2id) before storing them, SHALL verify passwords using `Bun.password.verify`, and SHALL never store or return plaintext passwords or hashes to clients.

#### Scenario: Password hashed on write
- **WHEN** a user is created or a password is set or reset
- **THEN** only the hash SHALL be persisted in `password_hash` and the plaintext SHALL NOT be stored

#### Scenario: Password material never returned
- **WHEN** any API returns user information
- **THEN** the response SHALL NOT include `password_hash` or any plaintext password

### Requirement: Two user roles
The system SHALL support exactly two roles: `admin` and `user`. Only `admin` users SHALL be able to manage other users and access admin-only pages; `user` accounts SHALL have full access to non-admin authenticated features.

#### Scenario: Admin capabilities
- **WHEN** an authenticated user has role `admin`
- **THEN** they SHALL be able to manage users, and access the Services dashboard and Settings page

#### Scenario: Regular user capabilities
- **WHEN** an authenticated user has role `user`
- **THEN** they SHALL be able to use all authenticated features except user management, the Services dashboard, and the Settings page

### Requirement: Seed admin on first startup
On startup, after migrations, if the `users` table contains no rows, the system SHALL create one `admin` user (role `admin`) with a randomly generated strong password, and SHALL print that plaintext password to the server log exactly once.

#### Scenario: Empty users table seeds admin
- **WHEN** the server starts and no users exist
- **THEN** the system SHALL create an `admin` user with a random password and log the plaintext password once in a clearly marked banner

#### Scenario: Existing users not reseeded
- **WHEN** the server starts and at least one user already exists
- **THEN** the system SHALL NOT create another admin and SHALL NOT print any password

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

### Requirement: Protect the last admin
The system SHALL prevent demoting the last remaining `admin` user (user deletion is not supported, so demotion is the only way an admin role can be lost).

#### Scenario: Cannot demote the last admin
- **WHEN** an admin attempts to change the only remaining `admin` user's role to `user`
- **THEN** the system SHALL reject the request

#### Scenario: Can demote an admin when another admin exists
- **WHEN** an admin changes an `admin` user's role to `user` while at least one other `admin` remains
- **THEN** the system SHALL allow the change

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

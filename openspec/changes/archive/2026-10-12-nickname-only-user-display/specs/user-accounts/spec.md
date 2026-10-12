## MODIFIED Requirements

### Requirement: User account data model
The system SHALL store user accounts in a `users` table with fields: `id` (autoincrement primary key), `username` (text, unique), `nickname` (nullable text, NOT unique), `password_hash` (text), `role` (text, one of `admin` or `user`), `status` (text, one of `active` or `pending`, default `active`), and `created_at` (ISO 8601 text). Ownership of user-private data SHALL reference `users.id` (immutable) rather than `username` (mutable), so renaming a user does not affect data ownership. A user's display name SHALL be their `nickname` when set, otherwise their `username`. Wherever a regular user can see another user's name, including shared lists, attribution labels and tooltips, the UI SHALL show only this display name without appending the username when a nickname is set. Login, self-service account fields and admin-only user management SHALL retain their account identifiers. Accounts created by an admin or at first startup SHALL be `active`; self-registered accounts SHALL start `pending`.

#### Scenario: User record structure
- **WHEN** a user account is created by an admin
- **THEN** the record SHALL contain a unique `username`, a hashed `password_hash`, a `role` of `admin` or `user`, `status` `active`, a `created_at` timestamp, and a `nickname` of `null`

#### Scenario: Username uniqueness enforced
- **WHEN** an attempt is made to create a user with a `username` that already exists
- **THEN** the system SHALL reject the request and SHALL NOT create a duplicate user

#### Scenario: Nicknames may repeat
- **WHEN** two users set the same `nickname`
- **THEN** the system SHALL accept both

#### Scenario: Shared attribution uses nickname only
- **WHEN** a regular user views another user with a nickname in shared Q&A, notes, reference links or highlights
- **THEN** the author label and name tooltip SHALL show only the nickname

#### Scenario: Display falls back to username
- **WHEN** the displayed user has no nickname
- **THEN** their display name SHALL be their username

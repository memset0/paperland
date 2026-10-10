# user-registration Specification

## Purpose
TBD - created by archiving change add-user-registration. Update Purpose after archive.

## Requirements

### Requirement: Self-registration creates a pending account
`POST /api/auth/register` SHALL be reachable anonymously and accept `{ username, password, nickname? }`. It SHALL validate that `username` and `password` are non-empty (username trimmed, at most 64 characters; nickname normalized like self-service update), reject a taken username with 409, and otherwise create a `user`-role account with `status` `pending`. It SHALL NOT create a session or log the caller in. When `auth.registration_enabled` in `config.yml` is `false` (default `true`), the endpoint SHALL respond 403 and create nothing.

#### Scenario: Successful registration
- **WHEN** an anonymous client registers with an unused username and a password
- **THEN** a `user`-role account with status `pending` SHALL be created, the response SHALL be 201 with the account's public fields, and no session cookie SHALL be set

#### Scenario: Username taken
- **WHEN** the requested username already exists (active or pending)
- **THEN** the endpoint SHALL respond 409 and create nothing

#### Scenario: Registration disabled
- **WHEN** `auth.registration_enabled` is `false` and a client calls `POST /api/auth/register`
- **THEN** the endpoint SHALL respond 403 and create nothing

### Requirement: Pending accounts cannot log in
A `pending` account SHALL NOT be able to log in. When its correct credentials are submitted to `POST /api/auth/login`, the system SHALL respond 403 with error code `ACCOUNT_PENDING` and a message saying the account awaits admin approval, and SHALL NOT create a session. Wrong credentials SHALL still produce the generic 401. A session SHALL only resolve to an `active` account.

#### Scenario: Pending login
- **WHEN** a pending account logs in with the correct password
- **THEN** the response SHALL be 403 `ACCOUNT_PENDING` and no session SHALL be created

#### Scenario: Pending login with wrong password
- **WHEN** a pending account's username is submitted with a wrong password
- **THEN** the response SHALL be the generic 401

### Requirement: Admin approves or rejects registrations
Admins SHALL be able to approve a pending account with `POST /api/users/:id/approve`, which sets its `status` to `active` and gives it the starter paper. Admins SHALL be able to reject a pending account with `DELETE /api/users/:id`, which deletes the account; deleting an `active` account SHALL be refused with 400. Both endpoints SHALL be admin-only and respond 404 for unknown users. Approving an already active account SHALL be a no-op success.

#### Scenario: Approve
- **WHEN** an admin approves a pending account
- **THEN** its status SHALL become `active`, it SHALL be able to log in, and its Mine paper list SHALL contain the starter paper

#### Scenario: Reject
- **WHEN** an admin rejects (deletes) a pending account
- **THEN** the account SHALL be removed and its username SHALL become available for a new registration

#### Scenario: Active accounts cannot be deleted
- **WHEN** an admin calls `DELETE /api/users/:id` for an active account
- **THEN** the system SHALL respond 400 and keep the account

### Requirement: Registration and review UI
The anonymous login screen SHALL offer a Register form (username, password, password confirmation, optional nickname) when registration is enabled; after a successful submission it SHALL tell the user the request awaits admin approval. A login attempt by a pending account SHALL show that the account awaits approval. The admin Settings page SHALL list pending registrations first, marked "Pending", each with Approve and Reject actions (Reject asks for confirmation). For admins, the Settings sidebar item SHALL show the number of pending registrations when it is greater than zero. UI labels SHALL be in English.

#### Scenario: Register then wait
- **WHEN** a visitor submits the Register form successfully
- **THEN** the screen SHALL say the request was submitted and awaits admin approval, and SHALL return to the Login form

#### Scenario: Admin sees pending badge
- **WHEN** an admin is logged in and two registrations are pending
- **THEN** the Settings sidebar item SHALL show `2`, and the Settings users table SHALL list those two first with Approve / Reject

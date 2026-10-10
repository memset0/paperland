## MODIFIED Requirements

### Requirement: Settings sections and order
The Settings page SHALL show, from top to bottom: an "Install app" section; an "Account" area containing the profile form (username, nickname, current password, new password, Save), the "Sharing" section, the "API Tokens" section and the "Browser Extension" section; and, for admins only, the administration area containing user management, the site-wide API token list and the admin "Recalculate costs" card. Model usage (the user's own usage and the usage leaderboard) SHALL NOT be shown on Settings; it lives on the Home page. Non-admin users SHALL NOT see the administration area, and the page SHALL NOT call admin-only endpoints for them.

#### Scenario: Regular user sees install and account sections only
- **WHEN** a `user`-role account opens Settings
- **THEN** the page SHALL show Install app first, then the Account sections, and SHALL NOT show user management or the site-wide token list

#### Scenario: Admin sees everything
- **WHEN** an admin opens Settings
- **THEN** the page SHALL show Install app, then the Account sections, then user management, the site-wide API token list and the Recalculate costs card

#### Scenario: Saving the profile keeps the user on the page
- **WHEN** a user changes their nickname and clicks Save
- **THEN** the change SHALL be saved via `PATCH /api/auth/me`, a success toast SHALL appear, and the password fields SHALL be cleared while the user stays on Settings

#### Scenario: User sees own usage
- **WHEN** any user wants to see their own usage
- **THEN** it SHALL be shown on the Home page, not on Settings
- **AND** the Settings page SHALL show neither a Usage section nor a Usage leaderboard, and SHALL NOT call `GET /api/usage/me` or `GET /api/usage/leaderboard`

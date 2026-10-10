## MODIFIED Requirements

### Requirement: Settings sections and order
The Settings page SHALL show, from top to bottom: an "Install app" section; an "Account" area containing the profile form (username, nickname, current password, new password, Save), the "Sharing" section, the "API Tokens" section, the "Browser Extension" section, and a "Usage" section showing the user's own token usage and estimated cost (all time and last 30 days, overall and per category); and, for admins only, the administration area containing user management, the site-wide API token list, and a "Usage leaderboard" ranking users by estimated cost and tokens (all time or last 30 days). Non-admin users SHALL NOT see the administration area, and the page SHALL NOT call admin-only endpoints for them.

#### Scenario: Regular user sees install and account sections only
- **WHEN** a `user`-role account opens Settings
- **THEN** the page SHALL show Install app first, then the Account sections, and SHALL NOT show user management or the site-wide token list

#### Scenario: Admin sees everything
- **WHEN** an admin opens Settings
- **THEN** the page SHALL show Install app, then the Account sections, then user management, the site-wide API token list and the Usage leaderboard

#### Scenario: Saving the profile keeps the user on the page
- **WHEN** a user changes their nickname and clicks Save
- **THEN** the change SHALL be saved via `PATCH /api/auth/me`, a success toast SHALL appear, and the password fields SHALL be cleared while the user stays on Settings

#### Scenario: User sees own usage
- **WHEN** a `user`-role account opens Settings
- **THEN** the Account area SHALL show a Usage section loaded from `GET /api/usage/me`, and the page SHALL NOT call `GET /api/usage/leaderboard`

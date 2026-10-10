## Purpose

One Settings page for every signed-in user that gathers app installation, personal account settings, and (for admins) site administration in a fixed order.

## ADDED Requirements

### Requirement: Settings page is available to every signed-in user
The `/settings` page SHALL be accessible to every authenticated user, not only admins. Anonymous visitors SHALL get the login screen as for any other login-required page. The page SHALL use the unified page layout with the title "Settings".

#### Scenario: Regular user opens Settings
- **WHEN** an authenticated `user`-role account navigates to `/settings`
- **THEN** the Settings page SHALL load without an "Admin access required" toast or redirect

#### Scenario: Anonymous visitor opens Settings
- **WHEN** an anonymous visitor opens `/settings`
- **THEN** the login screen SHALL be shown and the Settings page SHALL appear after logging in

### Requirement: Settings sections and order
The Settings page SHALL show, from top to bottom: an "Install app" section; an "Account" area containing the profile form (username, nickname, current password, new password, Save), the "Sharing" section, the "API Tokens" section, and the "Browser Extension" section; and, for admins only, the administration area containing user management and the site-wide API token list with the same behavior as before this change. Non-admin users SHALL NOT see the administration area, and the page SHALL NOT call admin-only endpoints for them.

#### Scenario: Regular user sees install and account sections only
- **WHEN** a `user`-role account opens Settings
- **THEN** the page SHALL show Install app first, then the Account sections, and SHALL NOT show user management or the site-wide token list

#### Scenario: Admin sees everything
- **WHEN** an admin opens Settings
- **THEN** the page SHALL show Install app, then the Account sections, then user management and the site-wide API token list

#### Scenario: Saving the profile keeps the user on the page
- **WHEN** a user changes their nickname and clicks Save
- **THEN** the change SHALL be saved via `PATCH /api/auth/me`, a success toast SHALL appear, and the password fields SHALL be cleared while the user stays on Settings

### Requirement: No account settings dialog
There SHALL be no separate account settings dialog; every entry point that previously opened it SHALL navigate to the Settings page instead.

#### Scenario: Account menu entry
- **WHEN** an authenticated user selects "Account settings" in the sidebar account menu
- **THEN** the app SHALL navigate to `/settings` and no dialog SHALL open

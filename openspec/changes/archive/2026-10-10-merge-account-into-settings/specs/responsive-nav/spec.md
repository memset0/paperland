## MODIFIED Requirements

### Requirement: Sidebar shows all items with login gating
The sidebar (and mobile drawer) SHALL display all navigation items regardless of authentication state, for visual consistency. Items that require authentication or admin SHALL be gated: when an anonymous user selects a login-required item, the system SHALL prompt for login; when a non-admin selects an admin-only item, the system SHALL indicate it requires admin. Public items (paper list) SHALL navigate normally for everyone. All navigation labels SHALL be in English. The navigation items SHALL include a Notes entry, which is login-required, and a login-required Research entry placed second, directly after Papers. There SHALL be no Conferences entry. Settings SHALL be login-required (not admin-only); Services SHALL remain admin-only.

#### Scenario: Anonymous user sees all sidebar buttons
- **WHEN** an anonymous user views the sidebar
- **THEN** all navigation buttons (Papers, Research, Tags, Q&A, Notes, Images, Extension, Services, Settings) SHALL be visible

#### Scenario: Anonymous user clicks a login-required item
- **WHEN** an anonymous user clicks Research, Tags, Q&A, Notes, or Settings
- **THEN** the system SHALL prompt for login instead of navigating to the page

#### Scenario: Non-admin clicks an admin-only item
- **WHEN** an authenticated `user`-role account clicks Services
- **THEN** the system SHALL indicate the page requires admin and SHALL NOT show its content

#### Scenario: Non-admin opens Settings
- **WHEN** an authenticated `user`-role account clicks Settings
- **THEN** the system SHALL navigate to the Settings page

#### Scenario: Public item navigates for everyone
- **WHEN** any visitor clicks Papers
- **THEN** the system SHALL navigate to the paper list

#### Scenario: Research is the second item
- **WHEN** any visitor views the sidebar or mobile drawer
- **THEN** the first item SHALL be Papers and the second item SHALL be Research, and no Conferences item SHALL be present

### Requirement: Account menu and login entry in sidebar
The sidebar SHALL present a login entry when no user is authenticated and an account menu when a user is authenticated. The account menu SHALL offer an "Account settings" entry that navigates to the Settings page (where the user changes their own username, nickname, and password) and a logout entry. In the mobile drawer, the button showing the user's name SHALL navigate to the Settings page.

#### Scenario: Login entry when logged out
- **WHEN** no user is authenticated
- **THEN** the sidebar SHALL show a login entry that opens the login prompt

#### Scenario: Account menu when logged in
- **WHEN** a user is authenticated
- **THEN** the sidebar SHALL show an account menu exposing the display name, "Account settings", and "Logout"

#### Scenario: Account settings navigates to Settings
- **WHEN** an authenticated user selects "Account settings" from the account menu or taps their name in the mobile drawer
- **THEN** the app SHALL navigate to `/settings`

#### Scenario: Logout from account menu
- **WHEN** an authenticated user selects logout from the account menu
- **THEN** the session SHALL end and the UI SHALL return to the anonymous state

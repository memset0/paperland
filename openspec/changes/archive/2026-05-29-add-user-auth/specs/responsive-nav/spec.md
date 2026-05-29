## ADDED Requirements

### Requirement: Sidebar shows all items with login gating
The sidebar (and mobile drawer) SHALL display all navigation items regardless of authentication state, for visual consistency. Items that require authentication or admin SHALL be gated: when an anonymous user selects a login-required item, the system SHALL prompt for login; when a non-admin selects an admin-only item, the system SHALL indicate it requires admin. Public items (paper list) SHALL navigate normally for everyone.

#### Scenario: Anonymous user sees all sidebar buttons
- **WHEN** an anonymous user views the sidebar
- **THEN** all navigation buttons (论文管理, 标签管理, Q&A, Idea Forge, 服务管理, 设置) SHALL be visible

#### Scenario: Anonymous user clicks a login-required item
- **WHEN** an anonymous user clicks 标签管理, Q&A, or Idea Forge
- **THEN** the system SHALL prompt for login instead of navigating to the page

#### Scenario: Non-admin clicks an admin-only item
- **WHEN** an authenticated `user`-role account clicks 服务管理 or 设置
- **THEN** the system SHALL indicate the page requires admin and SHALL NOT show its content

#### Scenario: Public item navigates for everyone
- **WHEN** any visitor clicks 论文管理
- **THEN** the system SHALL navigate to the paper list

### Requirement: Account menu and login entry in sidebar
The sidebar SHALL present a login entry when no user is authenticated and an account menu when a user is authenticated. The account menu SHALL allow the user to change their own username and password and to log out.

#### Scenario: Login entry when logged out
- **WHEN** no user is authenticated
- **THEN** the sidebar SHALL show a login entry that opens the login prompt

#### Scenario: Account menu when logged in
- **WHEN** a user is authenticated
- **THEN** the sidebar SHALL show an account menu exposing the username, "change username/password", and "logout"

#### Scenario: Logout from account menu
- **WHEN** an authenticated user selects logout from the account menu
- **THEN** the session SHALL end and the UI SHALL return to the anonymous state

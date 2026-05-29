# responsive-nav Specification

## Purpose
TBD - created by archiving change responsive-layout. Update Purpose after archive.
## Requirements
### Requirement: Desktop sidebar preserved
On screens >= 768px, the collapsible sidebar navigation SHALL remain as-is.

#### Scenario: Wide screen
- **WHEN** the viewport width is >= 768px
- **THEN** the sidebar SHALL be visible and the top navbar SHALL be hidden

### Requirement: Mobile top navbar with hamburger
On screens < 768px, a top navbar SHALL replace the sidebar, with a hamburger menu button.

#### Scenario: Narrow screen
- **WHEN** the viewport width is < 768px
- **THEN** the sidebar SHALL be hidden and a top navbar with a hamburger icon SHALL appear

### Requirement: Drawer overlay
Clicking the hamburger button SHALL open a slide-out drawer from the left with navigation links.

#### Scenario: Open drawer
- **WHEN** the user taps the hamburger icon
- **THEN** a drawer SHALL slide in from the left with a semi-transparent backdrop

#### Scenario: Close drawer on navigation
- **WHEN** the user taps a navigation link in the drawer
- **THEN** the drawer SHALL close and the selected page SHALL load

#### Scenario: Close drawer on backdrop
- **WHEN** the user taps the backdrop
- **THEN** the drawer SHALL close

### Requirement: Sidebar shows all items with login gating
The sidebar (and mobile drawer) SHALL display all navigation items regardless of authentication state, for visual consistency. Items that require authentication or admin SHALL be gated: when an anonymous user selects a login-required item, the system SHALL prompt for login; when a non-admin selects an admin-only item, the system SHALL indicate it requires admin. Public items (paper list) SHALL navigate normally for everyone. The navigation items SHALL include a 笔记 (Notes) entry, which is login-required.

#### Scenario: Anonymous user sees all sidebar buttons
- **WHEN** an anonymous user views the sidebar
- **THEN** all navigation buttons (论文管理, 标签管理, Q&A, 笔记, Idea Forge, 服务管理, 设置) SHALL be visible

#### Scenario: Anonymous user clicks a login-required item
- **WHEN** an anonymous user clicks 标签管理, Q&A, 笔记, or Idea Forge
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

### Requirement: Sidebar navigation supports open-in-new-tab
Sidebar and mobile-drawer navigation items SHALL be rendered as real links so that the browser's native open-in-new-tab behavior works. When the current user can access an item, a modifier-click (ctrl/cmd, or shift) or a middle-click SHALL open that item's page in a new browser tab/window without changing the current tab. A plain left-click SHALL continue to perform in-app (SPA) navigation, and on mobile SHALL close the drawer. Items that the current user cannot access (login-required while anonymous, or admin-only for a non-admin) SHALL NOT expose a working link, so a modifier/middle-click does nothing and a plain click still triggers the existing gating.

#### Scenario: Ctrl/Cmd-click opens an accessible item in a new tab
- **WHEN** the user holds ctrl (or cmd) and clicks an accessible navigation item (e.g. 论文管理, or a login-required item while authenticated)
- **THEN** the target page SHALL open in a new browser tab and the current tab SHALL remain on the current page

#### Scenario: Middle-click opens an accessible item in a new tab
- **WHEN** the user middle-clicks an accessible navigation item
- **THEN** the target page SHALL open in a new browser tab and the current tab SHALL remain on the current page

#### Scenario: Plain click navigates in the current tab
- **WHEN** the user left-clicks an accessible navigation item without any modifier key
- **THEN** the system SHALL navigate to that page within the current tab (SPA navigation), and if the click was in the mobile drawer the drawer SHALL close

#### Scenario: Modifier/middle-click on a gated item does not open a new tab
- **WHEN** an anonymous user (or a non-admin for an admin-only item) ctrl/cmd-clicks or middle-clicks a navigation item they cannot access
- **THEN** no new tab SHALL open; the gated page SHALL NOT load, and a plain click on the same item SHALL still prompt for login / indicate it requires admin

### Requirement: Sidebar navigation buttons have no press displacement
Navigation buttons in the sidebar and mobile drawer SHALL NOT visually shift or translate when pressed (no press-displacement effect). Buttons elsewhere in the application SHALL retain their existing press behavior.

#### Scenario: Pressing a sidebar nav button does not move it
- **WHEN** the user presses and holds a sidebar (or mobile drawer) navigation button
- **THEN** the button SHALL NOT shift downward or otherwise translate while active

#### Scenario: Non-sidebar buttons keep their press effect
- **WHEN** the user presses a button outside the sidebar (e.g. an action button on a page)
- **THEN** that button SHALL keep its existing press-displacement behavior


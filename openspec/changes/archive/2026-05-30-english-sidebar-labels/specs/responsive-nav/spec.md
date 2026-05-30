## MODIFIED Requirements

### Requirement: Sidebar shows all items with login gating
The sidebar (and mobile drawer) SHALL display all navigation items regardless of authentication state, for visual consistency. Items that require authentication or admin SHALL be gated: when an anonymous user selects a login-required item, the system SHALL prompt for login; when a non-admin selects an admin-only item, the system SHALL indicate it requires admin. Public items (paper list) SHALL navigate normally for everyone. All navigation labels SHALL be in English. The navigation items SHALL include a Notes entry, which is login-required.

#### Scenario: Anonymous user sees all sidebar buttons
- **WHEN** an anonymous user views the sidebar
- **THEN** all navigation buttons (Papers, Conferences, Tags, Q&A, Notes, Idea Forge, Services, Settings) SHALL be visible

#### Scenario: Anonymous user clicks a login-required item
- **WHEN** an anonymous user clicks Tags, Q&A, Notes, or Idea Forge
- **THEN** the system SHALL prompt for login instead of navigating to the page

#### Scenario: Non-admin clicks an admin-only item
- **WHEN** an authenticated `user`-role account clicks Services or Settings
- **THEN** the system SHALL indicate the page requires admin and SHALL NOT show its content

#### Scenario: Public item navigates for everyone
- **WHEN** any visitor clicks Papers
- **THEN** the system SHALL navigate to the paper list

### Requirement: Sidebar navigation supports open-in-new-tab
Sidebar and mobile-drawer navigation items SHALL be rendered as real links so that the browser's native open-in-new-tab behavior works. When the current user can access an item, a modifier-click (ctrl/cmd, or shift) or a middle-click SHALL open that item's page in a new browser tab/window without changing the current tab. A plain left-click SHALL continue to perform in-app (SPA) navigation, and on mobile SHALL close the drawer. Items that the current user cannot access (login-required while anonymous, or admin-only for a non-admin) SHALL NOT expose a working link, so a modifier/middle-click does nothing and a plain click still triggers the existing gating.

#### Scenario: Ctrl/Cmd-click opens an accessible item in a new tab
- **WHEN** the user holds ctrl (or cmd) and clicks an accessible navigation item (e.g. Papers, or a login-required item while authenticated)
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

## ADDED Requirements

### Requirement: Sidebar auxiliary text is in English
All non-navigation text rendered inside the desktop sidebar and mobile drawer SHALL be in English, so the entire sidebar reads as English. This covers the gating indicators, the account/login area, and the toasts triggered directly by sidebar controls, using these strings:

- Admin-only gating indicator (desktop tooltip suffix and mobile drawer suffix): **Admin only**
- Login-required gating indicator (desktop tooltip suffix and mobile drawer suffix): **Login required**
- Login entry (tooltip and mobile button): **Login**
- Logout entry (account menu item and mobile button): **Logout**
- Account settings entry (account menu item): **Account settings**
- Admin role badge in the account menu: **Admin**
- Toast shown when a non-admin selects an admin-only item: **Admin access required**
- Toast shown after logging out: **Logged out**

#### Scenario: Admin-only item shows an English gating indicator
- **WHEN** a non-admin user hovers the tooltip of (or views in the mobile drawer) an admin-only item such as Services or Settings
- **THEN** the gating indicator SHALL read "Admin only"

#### Scenario: Login-required item shows an English gating indicator
- **WHEN** an anonymous user hovers the tooltip of (or views in the mobile drawer) a login-required item such as Tags or Q&A
- **THEN** the gating indicator SHALL read "Login required"

#### Scenario: Account and login entries are in English
- **WHEN** an anonymous user views the account/login area, or an authenticated user opens the account menu
- **THEN** the anonymous entry SHALL read "Login", and the authenticated menu SHALL expose "Account settings" and "Logout", with an "Admin" badge for admin accounts

#### Scenario: Sidebar-triggered toasts are in English
- **WHEN** a non-admin selects an admin-only item, or any user logs out from the sidebar
- **THEN** the toast SHALL read "Admin access required" or "Logged out" respectively

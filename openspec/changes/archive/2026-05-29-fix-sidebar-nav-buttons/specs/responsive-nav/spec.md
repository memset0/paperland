## ADDED Requirements

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

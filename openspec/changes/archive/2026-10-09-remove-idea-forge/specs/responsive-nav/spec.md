## MODIFIED Requirements

### Requirement: Sidebar shows all items with login gating
The sidebar (and mobile drawer) SHALL display all navigation items regardless of authentication state, for visual consistency. Items that require authentication or admin SHALL be gated: when an anonymous user selects a login-required item, the system SHALL prompt for login; when a non-admin selects an admin-only item, the system SHALL indicate it requires admin. Public items (paper list) SHALL navigate normally for everyone. All navigation labels SHALL be in English. The navigation items SHALL include a Notes entry, which is login-required.

#### Scenario: Anonymous user sees all sidebar buttons
- **WHEN** an anonymous user views the sidebar
- **THEN** all navigation buttons (Papers, Conferences, Tags, Q&A, Notes, Services, Settings) SHALL be visible

#### Scenario: Anonymous user clicks a login-required item
- **WHEN** an anonymous user clicks Tags, Q&A, or Notes
- **THEN** the system SHALL prompt for login instead of navigating to the page

#### Scenario: Non-admin clicks an admin-only item
- **WHEN** an authenticated `user`-role account clicks Services or Settings
- **THEN** the system SHALL indicate the page requires admin and SHALL NOT show its content

#### Scenario: Public item navigates for everyone
- **WHEN** any visitor clicks Papers
- **THEN** the system SHALL navigate to the paper list


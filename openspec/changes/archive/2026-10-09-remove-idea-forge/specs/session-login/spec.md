## MODIFIED Requirements

### Requirement: Route guards for restricted pages
Restricted routes SHALL require authentication, and `/services` and `/settings` SHALL additionally require the `admin` role. The restricted routes are `/tags`, `/qa`, `/services`, and `/settings`. When an unauthenticated user navigates to a restricted route, the system SHALL prompt for login rather than silently failing; when a non-admin navigates to an admin-only route, the system SHALL indicate the page requires admin.

#### Scenario: Anonymous user opens a login-only route
- **WHEN** an anonymous user navigates to `/tags` or `/qa`
- **THEN** the system SHALL show a login prompt instead of the page content

#### Scenario: Non-admin opens an admin-only route
- **WHEN** an authenticated `user`-role account navigates to `/services` or `/settings`
- **THEN** the system SHALL deny access and indicate the page requires admin privileges

#### Scenario: Admin opens an admin-only route
- **WHEN** an authenticated `admin` navigates to `/services` or `/settings`
- **THEN** the page SHALL load normally


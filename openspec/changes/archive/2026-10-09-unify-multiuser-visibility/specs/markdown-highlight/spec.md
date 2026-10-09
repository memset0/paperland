## MODIFIED Requirements

### Requirement: Batch query highlights by pathname
The system SHALL provide `GET /api/highlights?pathname=<path>&scope=mine|all` that returns highlights for the given page path in a single request. `scope` SHALL default to `mine`, returning only the current user's highlights. With `scope=all` the response SHALL follow the uniform all-scope rules of the `data-sharing-preferences` capability (own + shared highlights of others; every user's for an admin). Each returned highlight SHALL carry `user_id`, `username`, and `shared`. Anonymous requests SHALL return an empty list with HTTP 200.

#### Scenario: Load all highlights for a page
- **WHEN** an authenticated user loads a page at pathname `/papers/42`
- **THEN** a single `GET /api/highlights?pathname=/papers/42` request SHALL return all of that user's highlights for that page, across all content_hash values

#### Scenario: All scope includes shared highlights
- **WHEN** user B calls `GET /api/highlights?pathname=/papers/42&scope=all` and user A, who shares highlights, has highlights there
- **THEN** the response SHALL include B's own highlights and A's highlights, each with `user_id` and `username`

#### Scenario: No highlights for page
- **WHEN** `GET /api/highlights?pathname=/papers/42` is called and the current user has no highlights there
- **THEN** the response SHALL return `{ "data": [] }`

#### Scenario: Anonymous user sees no highlights
- **WHEN** an anonymous client calls `GET /api/highlights?pathname=/papers/42`
- **THEN** the response SHALL return `{ "data": [] }` with HTTP 200

## REMOVED Requirements

### Requirement: Highlights are owner-scoped
**Reason**: Highlights become optionally shared under the owner's `highlights` sharing switch.
**Migration**: See "Highlight visibility and read-only rendering of others' highlights"; the default `mine` scope preserves the previous view.

## ADDED Requirements

### Requirement: Highlight visibility and read-only rendering of others' highlights
Pages that render highlights (paper detail and the `/qa` feed) SHALL offer authenticated users a Mine / All highlight selector, defaulting to Mine, and SHALL reload highlights with the chosen scope. Other users' highlights SHALL be rendered with a visually distinct style (e.g. underline instead of a filled background) so they never look like the viewer's own, and SHALL show the owner's username on hover or click. Clicking another user's highlight SHALL NOT offer recolor or delete actions to a non-owner. Only the owner SHALL create, update, or delete a highlight; the backend SHALL reject other users' mutations. Anonymous users SHALL neither see nor create highlights.

#### Scenario: Others' highlights shown distinctly
- **WHEN** user B selects All on a paper where shared user A has highlights
- **THEN** A's highlights SHALL render with the distinct style and show "A" as owner, and B SHALL have no edit actions on them

#### Scenario: Unshared highlights hidden
- **WHEN** user A turns off highlight sharing and non-admin user B selects All
- **THEN** A's highlights SHALL NOT be rendered for B

#### Scenario: Anonymous viewer sees no highlights and cannot create
- **WHEN** an anonymous visitor opens a paper or QA page
- **THEN** no highlights SHALL be rendered, and attempting to create a highlight SHALL prompt for login

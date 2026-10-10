## MODIFIED Requirements

### Requirement: Image management page

The system SHALL provide an authenticated management page, reachable from the main
navigation, that lists uploaded images and supports uploading images. A non-admin user SHALL see only the images they uploaded (`uploaded_by` = themselves), both on the page and from `GET /api/images`; admins SHALL see every image, each labelled with its uploader's display name (none for legacy images without an uploader). Image URLs remain public; only the listing is scoped. Images SHALL NOT be deletable: the page SHALL offer no delete control and the API SHALL provide no delete endpoint, so images referenced by notes or Q&A inputs remain available. The
page SHALL use the shared management-page layout component (`AppPage`) for its title, icon,
and content width — it MUST NOT hand-write its own page header.

#### Scenario: Page uses the unified layout
- **WHEN** the image host management page renders
- **THEN** its title and icon come from the route's `meta.title`/`meta.icon` via `AppPage`
- **AND** the page does not render its own separate `<h1>` header

#### Scenario: Browsing uploaded images
- **WHEN** a logged-in user opens the image host management page
- **THEN** the system displays every image visible to them as a grid item showing a thumbnail, file size,
  dimensions (when available), creation date, its note reference count, and its Q&A reference count
- **AND** provides a control to copy each image's link

#### Scenario: Upload a single image from the management page
- **WHEN** the user selects a file via the file picker, or pastes an image with Ctrl+V
  while the management page is focused
- **THEN** the system uploads it through `POST /api/images` and the new image appears in
  the grid

#### Scenario: Delete an image
- **WHEN** a user looks for a way to delete an image, or a client sends `DELETE /api/images/<hash>`
- **THEN** the page SHALL offer no delete control and the request SHALL NOT remove the image (the route does not exist)

#### Scenario: Regular user sees only their own uploads
- **WHEN** user A uploaded image X, user B uploaded image Y, and B (not an admin) loads `GET /api/images`
- **THEN** the response SHALL contain Y and SHALL NOT contain X or legacy images without an uploader

#### Scenario: Admin sees all uploads with their uploaders
- **WHEN** an admin loads `GET /api/images`
- **THEN** the response SHALL contain every image, each with `uploaded_by_name` (null when there is no uploader), and the page SHALL show the uploader on each card

#### Scenario: Agent uploads belong to the caller
- **WHEN** a Codex run for user B uploads a figure through the MCP `upload_image` tool
- **THEN** the image's `uploaded_by` SHALL be B and it SHALL appear in B's image list


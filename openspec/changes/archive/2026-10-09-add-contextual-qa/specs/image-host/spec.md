## MODIFIED Requirements

### Requirement: Image management page

The system SHALL provide an authenticated management page, reachable from the main
navigation, that lists all uploaded images and supports uploading images. Images SHALL NOT be deletable: the page SHALL offer no delete control and the API SHALL provide no delete endpoint, so images referenced by notes or Q&A inputs remain available. The
page SHALL use the shared management-page layout component (`AppPage`) for its title, icon,
and content width — it MUST NOT hand-write its own page header.

#### Scenario: Page uses the unified layout
- **WHEN** the image host management page renders
- **THEN** its title and icon come from the route's `meta.title`/`meta.icon` via `AppPage`
- **AND** the page does not render its own separate `<h1>` header

#### Scenario: Browsing uploaded images
- **WHEN** a logged-in user opens the image host management page
- **THEN** the system displays every image as a grid item showing a thumbnail, file size,
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

### Requirement: Reference counting across notes

The system SHALL compute, for each image, how many times it is referenced by note content,
by counting occurrences of the image's hash across all note body content. It SHALL separately
compute how many Q&A image inputs reference it, by counting image inputs in all `qa_entries.inputs`
whose image hash equals the image's hash.

#### Scenario: Reference count reflects note usage
- **WHEN** the management page (or `GET /api/images`) is loaded
- **THEN** each image's reported note reference count equals the total number of occurrences of
  that image's hash found across all notes' Markdown content

#### Scenario: Unreferenced image
- **WHEN** an image's hash appears in no note content
- **THEN** its reference count is reported as `0`

#### Scenario: Q&A reference count
- **WHEN** a screenshot is used as an image input by two Q&A entries
- **THEN** its reported Q&A reference count is `2`, independent of its note reference count

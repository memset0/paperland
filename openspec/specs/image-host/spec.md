# image-host Specification

## Purpose
TBD - created by archiving change add-image-host. Update Purpose after archive.
## Requirements
### Requirement: Authenticated image upload

The system SHALL accept image uploads only from authenticated users via
`POST /api/images`, persisting each image to disk and recording it in the database.

The upload endpoint SHALL accept the image bytes encoded as a base64 string or a
`data:` URL within a JSON body (so no multipart parsing or new dependency is required),
within the server's configured body-size limit.

#### Scenario: Logged-in user uploads a valid image
- **WHEN** an authenticated user sends `POST /api/images` with a base64-encoded PNG
- **THEN** the system stores the file under `data/images/YYYY/MM/DD/{hash}.png`
- **AND** inserts a row in the `images` table with the hash, MIME type, size, extension,
  stored path, and creation timestamp
- **AND** responds with the image's canonical URL `/image/YYYY/MM/DD/{hash}.png` and its
  metadata

#### Scenario: Unauthenticated upload is rejected
- **WHEN** a request to `POST /api/images` arrives without valid Basic Auth credentials
- **THEN** the system responds `401 Unauthorized` and stores nothing

#### Scenario: Non-image or oversized payload is rejected
- **WHEN** an upload's decoded MIME type is not in the configured allowed image types, or
  its size exceeds the configured maximum
- **THEN** the system responds with a `400`-class error and stores nothing

### Requirement: Content-addressed storage and deduplication

The system SHALL derive each image's filename from the first 6 hex characters of a SHA-256
hash of its bytes and SHALL treat identical content as a single image (one file, one
database row, one URL).

#### Scenario: Same image uploaded twice
- **WHEN** an authenticated user uploads bytes whose 6-char content hash matches an existing
  image
- **THEN** the system does not create a duplicate file or row
- **AND** returns the existing image's canonical URL (preserving its original date path)

### Requirement: Public image serving without authentication

The system SHALL serve stored images at `GET /image/<YYYY>/<MM>/<DD>/<hash>.<ext>` to any
requester without authentication, returning the file bytes with the correct
`Content-Type` and long-lived immutable cache headers.

#### Scenario: Anyone with the link views the image
- **WHEN** any client (no credentials) requests an existing image URL
- **THEN** the system responds `200` with the file bytes, the stored MIME type as
  `Content-Type`, and a `Cache-Control` header marking the content as immutable

#### Scenario: Missing image
- **WHEN** a request targets an image path that does not exist on disk
- **THEN** the system responds `404`

#### Scenario: Path traversal is prevented
- **WHEN** a request URL contains `..` or otherwise attempts to escape the image storage
  directory
- **THEN** the system refuses to serve any file outside `data/images/` and responds with
  a `400`/`404` error

### Requirement: Image management page

The system SHALL provide an authenticated management page, reachable from the main
navigation, that lists all uploaded images and supports uploading and deleting images. The
page SHALL use the shared management-page layout component (`AppPage`) for its title, icon,
and content width — it MUST NOT hand-write its own page header.

#### Scenario: Page uses the unified layout
- **WHEN** the image host management page renders
- **THEN** its title and icon come from the route's `meta.title`/`meta.icon` via `AppPage`
- **AND** the page does not render its own separate `<h1>` header

#### Scenario: Browsing uploaded images
- **WHEN** a logged-in user opens the image host management page
- **THEN** the system displays every image as a grid item showing a thumbnail, file size,
  dimensions (when available), creation date, and its reference count
- **AND** provides a control to copy each image's link

#### Scenario: Upload a single image from the management page
- **WHEN** the user selects a file via the file picker, or pastes an image with Ctrl+V
  while the management page is focused
- **THEN** the system uploads it through `POST /api/images` and the new image appears in
  the grid

#### Scenario: Delete an image
- **WHEN** the user deletes an image from the management page
- **THEN** the system removes the database row and the file from disk
- **AND** if the image is currently referenced by one or more notes, the system warns the
  user before deleting

### Requirement: Reference counting across notes

The system SHALL compute, for each image, how many times it is referenced by note content,
by counting occurrences of the image's hash across all note body content.

#### Scenario: Reference count reflects note usage
- **WHEN** the management page (or `GET /api/images`) is loaded
- **THEN** each image's reported reference count equals the total number of occurrences of
  that image's hash found across all notes' Markdown content

#### Scenario: Unreferenced image
- **WHEN** an image's hash appears in no note content
- **THEN** its reference count is reported as `0`

### Requirement: Paste-to-upload in the note editor

The system SHALL, when a user pastes image data into the note Markdown editor, upload the
image to the image host and insert a Markdown image link at the cursor.

#### Scenario: Pasting a screenshot into a note
- **WHEN** the user pastes clipboard contents containing an image into the note editing
  textarea
- **THEN** the system uploads the image via `POST /api/images`
- **AND** inserts `![](/image/YYYY/MM/DD/{hash}.ext)` at the caret position in the note
  content
- **AND** the rendered note displays the image inline


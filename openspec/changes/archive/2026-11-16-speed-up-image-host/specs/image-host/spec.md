# Spec Delta

## ADDED Requirements

### Requirement: Paginated image listing
`GET /api/images` SHALL accept `limit` (1–200) and `offset` (≥0) and SHALL then return that page in the existing order (newest first), with `total` and `next_offset` (null on the last page). Without `limit` it SHALL return all visible items as before. Reference counts SHALL be the same as in the unpaginated listing. Visibility rules (own uploads, admins see all) SHALL apply before paging.

#### Scenario: First page
- **WHEN** a user with 94 visible items requests `limit=48&offset=0`
- **THEN** the response SHALL contain the 48 newest items, `total` 94 and `next_offset` 48

#### Scenario: Last page
- **WHEN** the same user requests `limit=48&offset=48`
- **THEN** the response SHALL contain 46 items and `next_offset` null

### Requirement: Image thumbnails
`GET /image-thumb/<hash>.webp` SHALL return, without authentication, a WebP image no larger than the configured thumbnail size (default 480 px on the longest side) for a stored image, or a poster frame for a stored video. Generated thumbnails SHALL be cached on disk and served with immutable caching. Generation SHALL be bounded in concurrency and time. If it fails, the route SHALL redirect to the original image URL. Unknown hashes SHALL get 404.

#### Scenario: Thumbnail is small
- **WHEN** a 1.5 MB 1536×1024 PNG's thumbnail is requested
- **THEN** the response SHALL be WebP at most 480 px wide and much smaller than the original

#### Scenario: Cached after first request
- **WHEN** the same thumbnail is requested twice
- **THEN** the second response SHALL be served from the disk cache without running ffmpeg

## MODIFIED Requirements

### Requirement: Videos on the management page
The image host page SHALL accept video files in its picker and show each video in the grid as its poster thumbnail with its size and date. The video SHALL load and play (muted) only when the user hovers over or clicks the card. The page's copy action for a video SHALL produce the same `![](url)` Markdown, which the renderer shows as a video.

#### Scenario: Video card
- **WHEN** the list contains an MP4
- **THEN** its card SHALL show a video preview instead of a broken image, and the video file SHALL NOT be requested until the user hovers over or clicks it

### Requirement: Image management page

The system SHALL provide an authenticated management page, reachable from the main navigation, that lists uploaded images and supports uploading images. The page SHALL load items in pages (48 at a time), loading more when the user scrolls near the end or presses "Load more", and SHALL show thumbnails rather than original files in the grid. A non-admin user SHALL see only the images they uploaded (`uploaded_by` = themselves), both on the page and from `GET /api/images`; admins SHALL see every image, each labelled with its uploader's display name (none for legacy images without an uploader). Image URLs remain public; only the listing is scoped. Images SHALL NOT be deletable: the page SHALL offer no delete control and the API SHALL provide no delete endpoint, so images referenced by notes or Q&A inputs remain available. The page SHALL use the shared management-page layout component (`AppPage`) for its title, icon, and content width — it MUST NOT hand-write its own page header.

#### Scenario: Page uses the unified layout
- **WHEN** the image host management page renders
- **THEN** its title and icon come from the route's `meta.title`/`meta.icon` via `AppPage`
- **AND** the page does not render its own separate `<h1>` header

#### Scenario: Browsing uploaded images
- **WHEN** a logged-in user opens the image host management page
- **THEN** the system displays the first page of images visible to them as grid items showing a thumbnail, file size, dimensions (when available), creation date, its note reference count, and its Q&A reference count, and loads further pages on scroll
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

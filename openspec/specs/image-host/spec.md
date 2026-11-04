# image-host Specification

## Purpose
TBD - created by archiving change add-image-host. Update Purpose after archive.

## Requirements

### Requirement: Authenticated image upload

The system SHALL accept image and video uploads only from authenticated users via
`POST /api/images`, persisting each file to disk and recording it in the database.

The upload endpoint SHALL accept the bytes encoded as a base64 string or a `data:` URL
within a JSON body. Its body limit SHALL fit the larger of `image_host.max_size_mb` and
`image_host.max_video_size_mb` after base64 encoding. The allowed types SHALL default to
PNG, JPEG, GIF, WebP, MP4, and WebM, detected from the file's magic bytes. Videos SHALL be
limited by `image_host.max_video_size_mb` (default 200) and images by `image_host.max_size_mb`.

#### Scenario: Logged-in user uploads a valid image
- **WHEN** an authenticated user sends `POST /api/images` with a base64-encoded PNG
- **THEN** the system stores the file under `data/images/YYYY/MM/DD/{hash}.png`
- **AND** inserts a row in the `images` table with the hash, MIME type, size, extension,
  stored path, and creation timestamp
- **AND** responds with the image's canonical URL `/image/YYYY/MM/DD/{hash}.png` and its
  metadata

#### Scenario: Upload a video
- **WHEN** an authenticated user uploads a 30 MB MP4
- **THEN** it SHALL be stored as `{hash}.mp4` with MIME type `video/mp4` and a `/image/…mp4` URL

#### Scenario: Unauthenticated upload is rejected
- **WHEN** a request to `POST /api/images` arrives without valid Basic Auth credentials
- **THEN** the system responds `401 Unauthorized` and stores nothing

#### Scenario: Non-image or oversized payload is rejected
- **WHEN** an upload's detected MIME type is not in the configured allowed types, or
  its size exceeds the configured maximum for its kind
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

The system SHALL serve stored files at `GET /image/<YYYY>/<MM>/<DD>/<hash>.<ext>` to any
requester without authentication, streaming the file with the correct `Content-Type`,
`Accept-Ranges: bytes`, and long-lived immutable cache headers. A request with a valid
single `Range: bytes=…` header SHALL get `206 Partial Content` with `Content-Range`. An
unsatisfiable range SHALL get `416`.

#### Scenario: Anyone with the link views the image
- **WHEN** any client (no credentials) requests an existing image URL
- **THEN** the system responds `200` with the file bytes, the stored MIME type as
  `Content-Type`, and a `Cache-Control` header marking the content as immutable

#### Scenario: Video seeking
- **WHEN** a browser requests `Range: bytes=1000-1999` of a stored MP4
- **THEN** the response SHALL be 206 with exactly those 1000 bytes and `Content-Range: bytes 1000-1999/<size>`

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

### Requirement: Agent upload endpoint
The External API SHALL provide `POST /external-api/v1/images` (personal bearer token; agent tokens rejected like the rest of the External API). It takes either:
- the raw file as the request body, with any `Content-Type` such as `image/png`, `video/mp4`, or `application/octet-stream`, and an optional `?filename=`; or
- `?url=<http(s) URL>` with no body, in which case the server downloads the file.

The stored file SHALL go through the same validation, deduplication, and ownership as `POST /api/images`. The response SHALL contain `{ url, markdown, mime, size, width, height, deduped }`. Remote downloads SHALL:
- accept only http and https;
- refuse hosts that resolve to loopback, private, link-local, or unspecified addresses (422 `URL_NOT_ALLOWED`);
- follow at most 5 redirects, rechecking each hop;
- time out after `image_host.download_timeout` seconds (default 60);
- abort once the larger configured size limit is exceeded.

#### Scenario: Agent uploads a local screenshot
- **WHEN** an agent runs `curl -X POST -H "Authorization: Bearer <personal>" -H "Content-Type: image/png" --data-binary @fig2.png <base>/external-api/v1/images`
- **THEN** the response SHALL contain the image's `/image/…png` URL and a Markdown snippet

#### Scenario: Remote video by URL
- **WHEN** an agent posts `?url=https://concept.dev/dense-captioning-media/clip.mp4`
- **THEN** the server SHALL download and store it as a video

#### Scenario: Internal address
- **WHEN** the url is `http://127.0.0.1:3000/api/health`
- **THEN** the response SHALL be 422 `URL_NOT_ALLOWED` and nothing SHALL be fetched

### Requirement: Videos on the management page
The image host page SHALL accept video files in its picker and show videos in the grid as muted `<video>` previews with their size and date. The page's copy action for a video SHALL produce the same `![](url)` Markdown, which the renderer shows as a video.

#### Scenario: Video card
- **WHEN** the list contains an MP4
- **THEN** its card SHALL show a video preview instead of a broken image

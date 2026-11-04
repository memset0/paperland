## MODIFIED Requirements

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

## ADDED Requirements

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

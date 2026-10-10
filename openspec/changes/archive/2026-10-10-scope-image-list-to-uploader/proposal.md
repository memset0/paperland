## Why

The image host page lists every image on the site to every signed-in user, including screenshots and agent-drawn figures uploaded by others. Each user should see only what they uploaded; admins keep the full view.

## What Changes

- `GET /api/images`: a non-admin user receives only images whose `uploaded_by` is themselves; admins receive all images. Each item carries `uploaded_by_name` (the uploader's display name, null for legacy rows without an uploader) so admins can tell owners apart.
- The image host page shows the list it gets; for admins each card also shows the uploader.
- Image URLs stay public and unchanged; only the listing is scoped. Upload, dedup and serving do not change.
- Uploads through the MCP `upload_image` tool keep `uploaded_by` = the token's user (the user whose run drew it, or the personal-token owner), so they appear in that user's list. (Already implemented; now stated in the image-host spec.)

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `image-host`: the management page / list API is scoped to the caller's own uploads for non-admins; uploader attribution covers MCP uploads.

## Impact

- Backend: `api/images.ts` (filter + uploader name), test.
- Shared: `ImageWithUrl.uploaded_by_name`.
- Frontend: `views/ImageHostPage.vue` (uploader label for admins, empty-state text).
- Docs: `docs/frontend-architecture.md`, `docs/tech-stack.md`.
- Known limitation: uploads are content-deduplicated, so re-uploading bytes someone else already uploaded returns their image, which stays in their list (not the re-uploader's).

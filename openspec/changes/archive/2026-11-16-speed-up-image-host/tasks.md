# Tasks

## 1. Backend

- [x] 1.1 Add `limit`/`offset` pagination with `total`/`next_offset` to `GET /api/images` (unchanged without `limit`), computing reference counts for the page; verify offline route tests.
- [x] 1.2 Add `services/image_thumbs.ts` and the public `/image-thumb/:hash.webp` route (ffmpeg via `localProcess`, semaphore, disk cache, redirect fallback, config defaults); verify offline tests with a fake ffmpeg.

## 2. Frontend

- [x] 2.1 Page the Images grid (infinite scroll + Load more), use thumbnails, and load videos on hover/click; verify type checking and a scratch build (the screenshot and first-screen byte check need the deployed thumbnail route and are part of 3.1).

## 3. Docs and deployment

- [x] 3.1a Update `docs/external-api.md`, `docs/tech-stack.md`, `docs/frontend-architecture.md`.
- [x] 3.1 Deploy (backend restart, frontend build); verify `/images` loads quickly through the public URL (screenshot, and the first screen loads thumbnails rather than originals with small total bytes) and thumbnails are cached in `<image_host.dir>/.thumbs/`.

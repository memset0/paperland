# Proposal

## Why

The Images page (`/images`) can take a very long time to load from outside. `GET /api/images` itself is fast (about 10 ms and 34 KB for 94 items), but the grid loads every **original** file as its thumbnail. For mem that is 87 images totaling 95 MB plus 7 video previews, and there is no pagination. Over the public proxy and tunnel, the page appears not to open.

## What Changes

- **Thumbnails.** The grid shows a small WebP thumbnail (longest side 480 px) for each image and a poster frame for each video, instead of the original.
  - Thumbnails are generated on first request with ffmpeg (already installed) under a bounded concurrency, then cached on disk next to the image store.
  - They are served publicly and immutably like the originals, at `/image-thumb/<hash>.webp`.
  - If generation fails, the request falls back to the original file.
  - Videos play only after the user hovers over or clicks the card, instead of preloading.
- **Pagination.** `GET /api/images` accepts `limit` (default 48, max 200) and `offset`, and returns `total` and `next_offset`. The page loads the first page and fetches more automatically when the user scrolls near the end, with a "Load more" button as a fallback. Without `limit`, the API keeps returning all items for existing callers.
- **Cheaper reference counts.** Note and Q&A reference counts are computed only for the returned page's hashes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `image-host`: paginated listing, thumbnails on the management page, and videos that load on demand.

## Impact

- Backend: `api/images.ts` (pagination), new thumbnail route and `services/image_thumbs.ts` (ffmpeg, cache directory `<image_host.dir>/.thumbs/`, concurrency limit), config default for the thumbnail size and concurrency.
- Frontend: `views/ImageHostPage.vue`, `stores/images.ts` (page state), `api/client.ts` (`imagesApi.page`, `thumbUrl`), and the Vite dev proxy for `/image-thumb/`. The shared types need no change (the paged response type lives in the client).
- No DB change. Docs: `external-api.md`, `tech-stack.md`, `frontend-architecture.md`.

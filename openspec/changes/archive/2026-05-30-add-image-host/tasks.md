# Implementation Tasks

## 1. Foundation: schema, config, storage

- [x] 1.1 Added the `images` table to `packages/backend/src/db/schema.ts` (PK `hash`, plus
  `ext`, `mime`, `size`, `width`, `height`, `path`, `original_name`, `uploaded_by`,
  `created_at`, and an index on `created_at`), following existing snake_case/text-id
  conventions.
- [x] 1.2 Generated the migration with `bunx drizzle-kit generate` →
  `0015_pink_mandroid.sql` (+ `meta/0015_snapshot.json` and a `_journal.json` entry); it
  auto-applies on startup via the existing `migrate()` in `db/index.ts` (verified on a live
  boot: `.schema images` shows the new table).
- [x] 1.3 Added an `image_host` section to `config.yml` (`dir`, `max_size_mb`,
  `allowed_types`, `public_base_url`) and a validated `imageHostSchema` to
  `packages/backend/src/config.ts` (`.default({})` so existing configs still load), plus an
  `ImageHostConfig` type wired into `@paperland/shared` `AppConfig`. (No `config.example.yml`
  exists in this repo.)
- [x] 1.4 Added `data/images/` to `.gitignore` (verified a path under it is ignored).

## 2. Backend: storage helper + upload API

- [x] 2.1 Created `packages/backend/src/services/image_store.ts`: decodes base64/data-URL →
  `Buffer`, **sniffs the real MIME from magic bytes** (doesn't trust the client) and
  validates it against `allowed_types`, checks size against `max_size_mb`, computes the
  content hash (first 6 hex chars of the SHA-256), derives ext from MIME, sniffs width/height
  for png/jpeg/gif/webp (nullable), builds
  the `YYYY/MM/DD/{hash}.{ext}` path, writes the file only if absent (dedup), returns
  `{ row, deduped }`. Also exports `imageAbsPath` and `mimeForExt`.
- [x] 2.2 Created `packages/backend/src/api/images.ts` exporting async `imagesRoutes(app)`
  with authenticated `POST /api/images` (`preHandler: requireUser`) accepting
  `{ data, filename? }`, deduping on the content hash, returning the canonical URL +
  metadata (201 new / 200 deduped). Non-image/oversized/disallowed → 400 via
  `ImageValidationError`.
- [x] 2.3 Registered `imagesRoutes(app)` alongside the other route modules in
  `packages/backend/src/index.ts`.

## 3. Backend: public serving + management API

- [x] 3.1 Added a public `GET /image/*` route directly in `index.ts` (mirrors the existing
  `GET /api/files/*` PDF handler), under `/image/*` so the auth hook does NOT gate it. Maps
  the URL path under the storage dir, guards against path traversal (resolved path must stay
  inside the dir → 400), sets the MIME `Content-Type` and
  `Cache-Control: public, max-age=31536000, immutable`; 404 when missing.
- [x] 3.2 Added `GET /api/images` returning all images newest-first with a computed
  `reference_count` (scans all `notes.body` for each image's hash) plus `public_base_url`.
- [x] 3.3 Added `DELETE /api/images/:hash` that removes the row and the file from disk; the
  frontend reads the reference count from the list and warns before deleting.
- [x] 3.4 Added `/image/` (with a trailing slash) to `server.proxy` in
  `packages/frontend/vite.config.ts`. The trailing slash is required: Vite proxy keys are
  prefix-matched (`req.url.startsWith(key)`), so a bare `/image` would also capture the
  `/images` SPA page route and proxy it to the backend (→ 404). `/image/` matches only real
  image files (`/image/YYYY/MM/DD/{hash}.{ext}`).

## 4. Frontend: shared helper + management page

- [x] 4.1 Added `packages/frontend/src/utils/uploadImage.ts` (`fileToDataUrl`,
  `uploadImage`, `imageFromClipboard`) that converts a `File`/`Blob` to a base64 data URL,
  posts via `imagesApi.upload`, and returns `{ image, url, markdown }`. Added `imagesApi`
  (list/upload/remove) to `api/client.ts` and `Image`/`ImageWithUrl` to `@paperland/shared`.
  (Uses the shared `api` client wrapper — session-cookie auth + 401 handling — not bare
  fetch, since that's how this app actually authenticates.)
- [x] 4.2 Added Pinia store `packages/frontend/src/stores/images.ts` with `fetchImages`,
  `upload`, `deleteImage`, `publicBaseUrl`, and an `absoluteUrl()` helper.
- [x] 4.3 Created `packages/frontend/src/views/ImageHostPage.vue`: image grid (thumbnail,
  size, dimensions, date, reference-count badge, copy-link, copy-markdown, delete-with-
  warning) plus an upload area supporting file picker, drag-and-drop, and Ctrl+V paste (a
  window `paste` listener → shared helper). Copy-link uses `public_base_url` when set else
  `window.location.origin`. Wrapped in the shared `<AppPage>` layout (default centered
  `max-w-5xl`/1024px width; title + icon come from the route's `meta.title`/`meta.icon`; no
  hand-written page header) — matches the unified management-page layout convention.
- [x] 4.4 Registered the route in `router/index.ts` (`/images` → `ImageHostPage.vue`,
  `requiresAuth`, title `Images`) and added an "Images" sidebar nav entry (Lucide `Image`
  icon) in `App.vue`.

## 5. Editor integration

- [x] 5.1 Added a `@paste` handler to the note editing `<textarea>` in
  `packages/frontend/src/components/notes/NoteEditor.vue`: when clipboard items include an
  image it prevents default, uploads via the shared helper, inserts `![](/image/...)` at the
  caret (restoring the caret after), shows an "Uploading image…" indicator, and triggers the
  existing immediate-save path. **Note:** `NoteNode.vue` is title-only (no textarea — editing
  happens in the floating `NoteEditor.vue`), so it is intentionally NOT modified.
- [x] 5.2 Verified pasted-image Markdown renders inline via `components/MarkdownContent.vue`
  (`markdown-it` emits `<img>` for `![](url)` even with `html:false`). Added
  `img { max-width: 100%; height: auto; border-radius; margin }` to its scoped styles.

## 6. Verification & docs

- [x] 6.1 Verified via an automated test (`packages/backend/src/api/images.test.ts`,
  10 passing / 25 assertions, no external APIs) covering content-addressing, dedup,
  dimension sniffing, MIME/size/type validation, the 401 auth boundary, upload (201/200),
  reference counting across note bodies, and delete (row + file). Existing backend suites
  still pass (re-ran images + notes together = 23/23). Backend bundles cleanly; frontend
  `vue-tsc` type-check is clean. An earlier live boot confirmed the migration creates the
  `images` table. NOTE: full end-to-end curl checks against a running server were NOT
  performed because port 3000 was already occupied by a pre-existing dev server; route/auth
  behavior (public `/image/*`, traversal → 400, missing → 404, upload-auth → 401) is covered
  by the Fastify-inject tests instead.
- [x] 6.2 Updated `docs/frontend-architecture.md` (route, store, `imagesApi`, `uploadImage`
  helper, editor paste, new "Image Host Feature" section) and `docs/tech-stack.md` (`images`
  table + a backend "Image Host" section covering storage layout, APIs, the public
  `/image/*` route, config, and backups). `external-api.md` is intentionally untouched — it
  documents only the Bearer-token `/external-api/v1/` API, which the image host does not use.

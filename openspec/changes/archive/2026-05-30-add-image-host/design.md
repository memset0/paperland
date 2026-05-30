# Design: Add Image Host (图床)

## Context

Paperland is a Bun-workspace monorepo: a Fastify + Drizzle + `bun:sqlite` backend and a
Vue 3 + Vite + Pinia frontend, all traffic flowing through Vite (port 5173) which proxies
`/api` and `/external-api` to the backend on `127.0.0.1:3000`. Authentication is enforced
by a single Fastify `onRequest` hook (in `auth/guards.ts` / wired in `index.ts`) that
gates `/api/*` (Basic Auth) and `/external-api/*` (Bearer); **any other path is
unauthenticated**. Routes are registered in `packages/backend/src/index.ts` (there is no
`app.ts`). Notes are stored as Markdown in the `notes.body` column and edited in plain
`<textarea>` surfaces (`components/notes/NoteEditor.vue` and `NoteNode.vue`), rendered for
display by `components/MarkdownContent.vue`. The frontend talks to the backend with bare
`fetch('/api/...')` calls and relies on the browser's native Basic Auth credential caching
— no Authorization header is set in JS.

These existing facts shape the design: we get public, no-auth image viewing essentially
for free by serving images from a non-`/api` path; uploads protected by Basic Auth come
for free on `/api/*`; and we can avoid new dependencies by reusing the JSON body pipeline
(the body limit is already 25 MB for large base64 payloads).

## Goals / Non-Goals

**Goals**
- Stable, content-addressed image URLs of the form `/image/YYYY/MM/DD/{hash}.{ext}`.
- Upload restricted to logged-in users; viewing open to anyone with the link.
- A management page: single-image upload (file picker + Ctrl+V paste), grid browsing,
  copy-link, per-image reference counts, delete.
- Paste-to-upload in the note editor inserting a Markdown image link.
- No new backend npm dependencies; no breaking changes to existing tables or routes.

**Non-Goals**
- Server-side image processing (resize, thumbnails, re-encode, EXIF strip).
- Private/access-controlled images or signed URLs.
- Counting references outside note content (idea-forge, paper fields, etc.).
- Capturing PDF regions into the store (future; see Open Questions).
- Automatic orphan garbage collection.

## Decisions

### 1. Content-addressed storage with SHA-256 (6-char), date-partitioned path
Each image is hashed with Node's `crypto.createHash('sha256')` over its raw bytes; the
**first 6 hex chars** of that digest are the filename stem (and the DB primary key). The
extension is derived from the validated MIME type. Files live at
`data/images/YYYY/MM/DD/{hash}.{ext}` (date = first-upload date, server local time) and are
served at the matching URL `/image/YYYY/MM/DD/{hash}.{ext}`.

- **Why**: Content addressing gives automatic deduplication (identical bytes → identical
  filename → one file), natural cache-immutability (the URL never changes for given
  content), and a robust reference key. The date partition keeps directories small and
  matches the user's requested URL shape.
- **Hash length**: truncate to the first **6 hex chars** (24 bits ≈ 16.7M values) to keep
  URLs short and tidy — the user explicitly asked for ~6 chars. At personal-tool scale
  (hundreds of images) the collision probability is negligible, and an exact-content
  re-upload still dedupes to the existing row (same bytes → same 6-char prefix). Accepted
  trade-off: in the astronomically unlikely event two *different* images share a 6-char
  prefix, the later upload would map to the earlier file; documented in Risks. (Alternative:
  full 64-char hash — rejected as needlessly long for this internal tool.)
- **Alternative considered**: random UUID filenames — rejected because it loses dedup and
  makes the filename meaningless; the user explicitly asked for a hash-based name.

### 2. Storage location: `data/images/`, gitignored, separate from DB backups
Image files are written under `data/images/` alongside the existing `data/paperland.db`
and `data/backups/`. The directory is created on demand at upload time.

- **Why**: Keeps all mutable runtime data under `data/`. Backend runs from project root
  (per CLAUDE.md), so `data/images/` resolves consistently.
- **Backups**: the existing daily backup copies only the SQLite DB. Image files are *not*
  backed up by that job; this is documented as a known limitation (Risks).
- `data/images/` is added to `.gitignore`.

### 3. Upload transport: base64/data-URL in a JSON body (no multipart)
`POST /api/images` accepts `{ data: "<base64 | data:URL>", filename?, mime? }`. The
backend strips any `data:` prefix, base64-decodes to a `Buffer`, sniffs/validates the MIME
type, hashes, and writes.

- **Why**: The codebase has **no** `@fastify/multipart`. The JSON body path is already
  used for large payloads (25 MB limit). Browser paste/file blobs convert to base64
  trivially (`FileReader.readAsDataURL` / `arrayBuffer` + base64). This avoids any new
  dependency.
- **Trade-off**: base64 inflates payloads ~33% (effective max image ≈ 18 MB under the
  25 MB body limit) and costs a decode. Acceptable for a personal tool; configurable via
  `image_host.max_size_mb`.
- **Alternative**: add `@fastify/multipart` — rejected to keep dependencies minimal and
  consistent with the existing JSON/base64 convention.

### 4. Public serving via a manual `GET /image/*` route
A single Fastify route `app.get('/image/*', ...)` (registered directly in `index.ts`) maps
the URL path under `data/images/`, validates against path traversal (reject `..`, resolve
and confirm the real path stays inside the storage dir), reads the file, and replies with
the stored MIME type and `Cache-Control: public, max-age=31536000, immutable`. Because it
is **not** under `/api/` it bypasses the auth hook automatically.

- **Why**: This mirrors the existing `GET /api/files/*` PDF-serving route already in
  `index.ts` (which does `readFileSync` + `reply.header('Content-Type', …)` +
  `reply.send(buffer)`), so it follows an established in-repo precedent and keeps explicit
  control over headers and traversal safety. (`@fastify/static` is a dependency and could
  serve the directory, but the manual handler matches the precedent, keeps viewing
  unauthenticated by construction, and lets us set immutable caching per content.)
- **Vite proxy**: add an `/image/` entry (with a trailing slash) to `vite.config.ts`
  server.proxy so dev-mode image URLs reach the backend. The trailing slash matters: Vite
  proxy keys are prefix-matched, so a bare `/image` would also swallow the `/images` SPA
  page route and proxy it to the backend (404). `/image/` only matches real image files.

### 5. Reference counting by scanning note bodies for the hash
`GET /api/images` loads all images and all note bodies once, then for each image counts
substring occurrences of its hash across all `notes.body`. The count is returned as
`reference_count` (optionally with the list of referencing note IDs).

- **Why**: The hash appears in every reference regardless of whether the stored URL is
  relative or absolute, making the count robust. Scanning on read keeps the data model
  simple (no triggers, no denormalized counters to keep in sync) and is cheap at the scale
  of a personal tool (hundreds of images/notes).
- **Trade-off**: O(images × notes) string searches per list request. If this ever grows,
  a precomputed `image_references` table updated on note save is the documented upgrade
  path (Open Questions).
- Standalone notes and paper-bound notes share the `notes` table, so both are covered.

### 6. URLs in note Markdown are relative; copy-link offers absolute
Paste-to-upload inserts a **relative** URL `![](/image/YYYY/MM/DD/{hash}.ext)` into note
content (host-agnostic, survives hostname changes). The management page "copy link"
control yields an **absolute** URL built from `image_host.public_base_url` when configured,
otherwise `window.location.origin + path`.

- **Why**: Relative URLs make stored notes portable across environments; absolute URLs are
  what users want when sharing a link externally. Reference counting works for both since
  it matches on the hash.

### 7. New `images` table mirroring existing schema conventions
```ts
export const images = sqliteTable('images', {
  hash: text('hash').primaryKey(),        // first 6 hex chars of the SHA-256 of the bytes
  ext: text('ext'),                       // png | jpg | gif | webp
  mime: text('mime'),
  size: integer('size'),                  // bytes
  width: integer('width'),                // nullable
  height: integer('height'),              // nullable
  path: text('path'),                     // YYYY/MM/DD/{hash}.{ext}
  original_name: text('original_name'),   // nullable
  uploaded_by: integer('uploaded_by').references(() => users.id), // nullable
  created_at: text('created_at').notNull(),
}, (table) => [
  index('idx_images_created').on(table.created_at),
])
```
Snake_case columns, text PK, `created_at` set to `new Date().toISOString()` at insert
(matching how other tables populate `created_at`). Migration is generated with
`bunx drizzle-kit generate` and auto-applied on startup by the existing `migrate()` call in
`db/index.ts`.

### 8. New `image_host` config section
Add to `config.yml` and validate with a zod schema in `config.ts`:
```yaml
image_host:
  dir: ./data/images
  max_size_mb: 18
  allowed_types: [image/png, image/jpeg, image/gif, image/webp]
  public_base_url: ""   # optional; blank => derive from request/origin
```
Defaulted and optional so existing configs keep working. Mirror the shape in
`@paperland/shared` `AppConfig` so `getConfig()` is typed.

### 9. Shared frontend upload helper
A small util (e.g. `utils/uploadImage.ts`) converts a `File`/`Blob` to base64, POSTs to
`/api/images`, and returns `{ url, markdown }`. Reused by both the management page and the
editor paste handler so upload logic exists once.

## Risks / Trade-offs

- **SVG / active content**: SVGs can embed scripts; served same-origin, an opened SVG could
  execute JS (XSS). Mitigation: `allowed_types` excludes `image/svg+xml` by default; only
  raster formats are allowed. Documented so an operator opting into SVG accepts the risk.
- **Public access**: anyone with a URL can view the image — this is an explicit product
  requirement (lower auth cost), accepted. With a 6-char (24-bit) hash the URL space is
  ~16.7M and includes a date path, so URLs are not trivially enumerable, but they are NOT a
  security boundary — anyone with the link is meant to view, by design.
- **6-char hash collisions**: the 24-bit prefix means two *different* images could in
  principle share a hash; at this tool's scale the probability is negligible, and identical
  re-uploads dedupe correctly. Accepted for shorter URLs (user request).
- **Image files not in DB backups**: the daily backup is DB-only; image files rely on
  filesystem-level backup. Documented.
- **Reference-count cost**: full scan per list call; acceptable now, upgrade path noted.
- **Orphans**: deleting a note does not delete now-unreferenced images; cleanup is manual
  via the management page. Accepted for v1.
- **Base64 overhead**: ~33% payload inflation and a decode per upload; bounded by config.

## Migration Plan

1. Add the `images` table to `schema.ts`; run `bunx drizzle-kit generate`; the new
   migration auto-applies on next backend start (no manual data migration needed).
2. Add `image_host` to `config.yml` (+ `config.example.yml` if present); `config.ts`
   provides defaults so the change is backward compatible.
3. Add `data/images/` to `.gitignore`.
4. No changes to existing tables, routes, or note data. Purely additive; safe to ship and
   trivially reversible (drop table + remove files).

## Open Questions

- Should reference counting eventually move to a maintained `image_references` table
  (updated on note save) for O(1) reads? Deferred until scale warrants it.
- Should the PDF viewer's region-capture flow (`embed-pdfjs-viewer`, which already crops a
  page rect to an image) feed captured regions directly into this store? It is the natural
  next producer; the upload helper/API are designed to accept any image blob so this can be
  added later without server changes.
- Should reference scanning extend to other Markdown surfaces (idea-forge items, paper
  fields)? Out of scope for v1; revisit if images get pasted there.
- Should we auto-GC zero-reference images on a schedule, or keep deletion manual? Manual
  for v1.

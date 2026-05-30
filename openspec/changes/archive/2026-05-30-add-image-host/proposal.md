# Add Image Host (图床)

## Why

Notes are authored in Markdown but there is currently no way to embed images — users
cannot paste a screenshot into a note, and there is no place to store image files. We
need a lightweight, self-hosted image host so that images can be uploaded once and
referenced by stable URLs from any note, with viewing requiring no authentication (to
keep embedded `<img>` links cheap to load) while uploads stay restricted to logged-in
users.

## What Changes

- Add an `images` table and on-disk storage under `data/images/`. Each upload is
  content-addressed: the file is hashed (SHA-256) and stored at
  `data/images/YYYY/MM/DD/{hash}.{ext}`, served publicly at the matching URL
  `/<host>/image/YYYY/MM/DD/{hash}.{ext}`. Identical bytes deduplicate to one file/URL.
- Add an authenticated upload API (`POST /api/images`) accepting a base64/data-URL image
  payload (reusing the existing 25 MB JSON body limit — no new multipart/static deps),
  and management APIs to list, inspect reference counts, and delete images.
- Add a **public, unauthenticated** image-serving route `GET /image/*` that streams the
  stored file from disk with the correct `Content-Type` and immutable cache headers.
  This route lives outside `/api/*`, so the existing auth hook leaves it open by design.
- Add a dedicated **Image Host management page** (new route + sidebar nav entry) where a
  logged-in user can upload a single image via file picker **or** Ctrl+V paste, browse all
  images in a grid (thumbnail, size, dimensions), copy each image's link, see how many
  times each image is referenced across notes, and delete images.
- Wire the **note Markdown editor** so that pasting an image into the editing
  `<textarea>` auto-uploads it to the image host and inserts a Markdown image link
  (`![](/image/YYYY/MM/DD/{hash}.ext)`) at the cursor.
- Add an `image_host` config section (storage dir, allowed MIME types, max size, optional
  `public_base_url`) validated in `config.ts`, and forward `/image` in the Vite dev proxy.

## Impact

- **Users**: gain the ability to embed images in notes and a management page to oversee
  all uploaded images and their usage.
- **Backend**: new `images` table + migration, new API module wired in `index.ts`, a new
  public static-serving route, new config section. No new npm dependencies.
- **Frontend**: new Pinia store, new management view, new router/nav entry, a paste hook
  in the note editor, and a shared image-upload helper.
- **Storage / ops**: a new `data/images/` directory (gitignored) holds image files;
  these are on the filesystem and are **not** included in the existing DB-only daily
  backup.

## Out of Scope

- Image transforms (resize/thumbnail generation/compression) — thumbnails use the
  original file via browser-side scaling.
- A general-purpose CDN, access-controlled/private images, or per-image ACLs — any holder
  of a link can view, by design.
- Capturing image regions from the PDF viewer into the image host — the existing pdf.js
  region-capture flow (`embed-pdfjs-viewer`) is a natural future producer for this store
  but is out of scope here; this change only covers paste/file uploads.
- Referencing images from non-note Markdown surfaces (e.g. idea-forge items); reference
  counting scans note content only in this change.
- Garbage-collection of orphaned (zero-reference) images beyond a manual delete action.

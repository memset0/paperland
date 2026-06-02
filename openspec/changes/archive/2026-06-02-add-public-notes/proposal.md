## Why

Today every note is strictly private to its owner — there is no way to share a note, and no user (let alone an anonymous visitor) can read anyone else's notes or mind-map. Users want to publish a paper's note so others can learn from it, browse everyone's notes, and share a direct link to a specific note.

## What Changes

- **Note visibility flag.** Each note gains an `is_public` flag (default private). The owner can publish / unpublish their note for a paper from the note UI.
- **Public read access for everyone, including anonymous.** A published note's full content and heading-derived mind-map become readable by any user — logged in or not.
- **Public-note rendering.** A public note is shown **mind-map first, then the full note body**. PDF-locating anchors (`paperland://…?pdf=…`) stay clickable; Q&A/block-locating anchors (`paperland://…?h=…`) are rendered inert (not actionable) — a viewer can't resolve another user's Q&A.
- **Right-panel "others' public notes".** On the paper detail page, the right panel lists other users' public notes for that paper (never your own). Each entry is **collapsed and unrendered by default**; expanding one **lazily fetches** its body and renders it.
- **Notes list across users.** The `/notes` page gains a scope toggle to view **everyone's notes** (public). An **admin** can additionally toggle viewing **others' unpublished** notes. Selecting any note deep-links to its paper and **locates + expands** that note in the right panel.
- **Shareable note links.** Once public, a note exposes a **copy-link** action. Opening the link navigates to the paper and **auto-opens** that note in the right panel. If the link points to the **viewer's own** note, the app shows a "this is your own note" hint and skips the auto-open (the owner's note already lives in their own Note tab).

## Capabilities

### New Capabilities
- `public-notes`: note visibility flag + owner publish toggle; public (incl. anonymous) read access to a single note; the right-panel list of other users' public notes (lazy, collapsed-by-default, mind-map-then-body rendering, inert Q&A anchors); shareable note links and their deep-link open behavior (incl. own-note hint).

### Modified Capabilities
- `paper-notes`: the note data model gains an `is_public` column (default private); the owner-scoped read surfaces `is_public`; a new owner-only endpoint sets a note's visibility.
- `notes-page`: the aggregate API and `/notes` page gain a cross-user scope (everyone's public notes) plus an admin-only "include others' private" option; selecting a note deep-links to its paper and opens it in the right panel rather than only navigating.
- `markdown-anchors`: a public-note rendering mode SHALL render Q&A/block (`?h=`) anchors inert (plain, non-actionable) while keeping PDF (`?pdf=`) anchors actionable.

## Impact

- **DB schema**: `notes` table gains `is_public` (integer boolean, default 0); a new Drizzle migration.
- **Backend** (`packages/backend/src/api/notes.ts`): new visibility endpoint, new per-paper public-notes list endpoint, new single-note fetch endpoint with public/own/admin authorization, and `scope`/`include_private` query support on `GET /api/notes`.
- **Shared types** (`packages/shared/src/types.ts`): `Note.is_public`; new summary/author-annotated note types.
- **Frontend**: notes store (publish toggle, share link, public-note fetch); a read-only public-note view (mind-map + body) reusing the mind-map and `MarkdownContent`; a right-panel public-notes section on paper detail; `?note=` deep-link handling in `PaperDetail.vue`; scope/admin toggles and author/visibility badges on `NotesPage.vue`; a `public-note` (inert-block-anchor) mode in `MarkdownContent.vue`.
- **Docs**: `docs/frontend-architecture.md`, `docs/external-api.md` updated.
- No breaking changes — existing private notes stay private by default.

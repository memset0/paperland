## Context

Notes are one Markdown document per `(user_id, paper_id)` (`notes` table, `body` text; the mind-map and walkthrough are derived on the frontend from ATX headings via `parseNoteDoc`). All note reads are owner-scoped today: `GET /api/papers/:id/note` returns only the caller's note (anonymous → `{ note: null }`, HTTP 200), `PUT` upserts the caller's body with optimistic `updated_at`, and `GET /api/notes` lists only the caller's non-empty notes. There is **no** visibility column and no cross-user read path.

Key existing facts this design builds on:
- The backend `onRequest` hook (`index.ts`) only *attaches* `request.user` (or the dev-admin when auth is disabled); it does **not** gate `/api/*`. Routes opt into auth via `requireUser` / `requireAdmin` preHandlers or inline checks. So anonymous read endpoints are simply routes that don't require a user — exactly what public notes need.
- Users have a `role` of `'admin' | 'user'`; the frontend exposes `useAuthStore().isAdmin` and `SessionUser` via `GET /api/auth/me`.
- The right panel is `PaperViewerPanel.vue` with tabs PDF / 翻译 / **Note**; the Note tab renders `NoteWalkthrough.vue`. The mind-map (`NoteMindmap.vue`) and walkthrough read from the `notes` Pinia store (the *current user's* editing doc).
- `MarkdownContent.vue` parses & intercepts `paperland://` links: a PDF target (`?pdf=`, with optional `ts/te` or `rx/ry/rw/rh`) routes to the embedded viewer; a block target (`?h=&s=&e=`) calls `locateBlock`, which resolves a Q&A answer by hashing the *current user's* Q&A store. A block anchor is therefore meaningless when rendering someone else's note.
- Deep-links already flow through `PaperDetail.handleAnchorFromRoute()` reading `route.query` (`pdf`, `h`, `s`, `e`, …) on mount and on id/query change.

## Goals / Non-Goals

**Goals:**
- Let a note owner publish/unpublish a note; published notes are readable by anyone, including anonymous visitors.
- Render a public note read-only as **mind-map first, then full body**, with PDF anchors actionable and Q&A/block anchors inert.
- Right panel on paper detail lists *other* users' public notes, collapsed + unrendered until expanded (lazy body fetch).
- `/notes` page can list everyone's public notes; admins can additionally include others' private notes; selecting any note deep-links to the paper and opens it in the right panel.
- A copy-able note link that, when opened, auto-opens that note in the right panel — except when it is the viewer's own note (show a hint, skip auto-open).

**Non-Goals:**
- No editing of others' notes, no comments/reactions, no per-user/group ACLs (visibility is a single public/private flag).
- No server-side mind-map computation (it stays derived on the frontend from `body`).
- No change to how the *owner* edits their own note (walkthrough/floating-editor/mind-map editing is unchanged).
- The right-panel "others' notes" list shows **public** notes only; the admin "see others' private" capability applies to the `/notes` list and to direct single-note fetches (e.g. an admin opening a shared/listed private note), not to the per-paper public list.

## Decisions

### 1. Visibility as a single `is_public` boolean column on `notes`
Add `is_public: integer('is_public', { mode: 'boolean' }).notNull().default(false)` to the `notes` table; generate a Drizzle migration. Existing rows default to private (`0`). `Note` (shared type) gains `is_public: boolean`.
- *Why:* The whole note is one row/one document; visibility is naturally a per-row flag. No backfill, no breaking change.
- *Alternatives:* a separate `note_visibility` table (overkill for one boolean); per-section visibility (out of scope — a note is published as a whole).

### 2. Visibility toggle is a dedicated owner-only endpoint, separate from body save
`PUT /api/papers/:id/note/visibility` body `{ is_public: boolean }`, `preHandler: requireUser`, operating only on the caller's `(user, paper)` note. It requires an existing, non-empty note row (publishing nothing is meaningless → 404/400). Returns `{ data: Note }`.
- *Why:* Body autosave is debounced and guarded by optimistic `updated_at`; folding the flag into `PUT /api/papers/:id/note` would couple a visibility toggle to a possibly-stale body timestamp and to a different editing surface. A small dedicated endpoint keeps the toggle atomic and conflict-free.
- *Alternatives:* extend the upsert body with `is_public` (rejected — concurrency coupling); a generic `PATCH` (same idea, but an explicit `/visibility` path reads clearer).

### 3. Cross-user reads are new, explicitly-authorized routes (anonymous-friendly)
- `GET /api/papers/:id/public-notes` → lightweight list `[{ id, user_id, username, updated_at }]` of **public, non-empty** notes for the paper authored by users **other than the caller** (anonymous caller excludes nobody). No body returned (lazy). No auth required.
- `GET /api/notes/:noteId` → a single note with `body`, `paper_id`, `paper_title`, `user_id`, `username`, `is_public`. Authorized iff the note is **public**, OR owned by the caller, OR the caller is an **admin** (admins may read private notes). Otherwise 404 (not 403, to avoid confirming existence). No auth required for the public case.
- *Why:* Splitting "list metadata" from "fetch one body" is what makes the right-panel default *collapsed + unrendered + lazy* cheap, and gives the deep-link a stable by-id fetch that works even for a note not in the per-paper public list (e.g. an admin opening a private note by link). Routes stay open because the hook never gates them; each route does its own authorization.
- *Alternatives:* returning bodies in the list (rejected — defeats lazy loading and leaks large payloads); reusing `GET /api/papers/:id/note` with a `user_id` query (rejected — that endpoint is owner-scoped by contract; a by-id route is cleaner for sharing).

### 4. `GET /api/notes` gains `scope` and `include_private`
`?scope=mine|all` (default `mine`) and `?include_private=true` (admin-only, honored only when `scope=all`).
- `scope=mine`: unchanged — caller's own non-empty notes (anonymous → 401, preserving today's behavior).
- `scope=all`: non-empty notes that are **public (any author)** OR **owned by the caller**; anonymous is allowed and gets public-only (HTTP 200).
- `scope=all&include_private=true`: admins only also get **others' private** non-empty notes; for non-admins the flag has no effect.
- Each row annotated with `paper_id`, `paper_title`, `user_id`, `username`, `is_public` (new `NoteWithAuthor` shared type). `GET /api/notes` (mine) keeps returning `NoteWithPaper`-shaped rows; the richer shape is additive.
- *Why:* One endpoint, additive query params, keeps the `/notes` page simple and reuses existing list plumbing.

### 5. Note link format reuses the paper route with a `?note=<id>` query
`<origin>/papers/:paperId?note=:noteId`. `PaperDetail.handleAnchorFromRoute()` is extended: when `route.query.note` is present, fetch it via `GET /api/notes/:noteId`; if it belongs to the current user → toast "this is your own note" and do **not** auto-open the public panel; otherwise switch the right panel to the Note tab, expand the public-notes section, ensure that note is present/expanded, render it, and scroll to it. `note` coexists with `pdf`/`h` (independent params).
- *Why:* No new route, consistent with the existing `?pdf=`/`?h=` deep-link mechanism; by-id is stable across edits.
- *Ownership check:* compare the fetched note's `user_id` to `useAuthStore().user?.id`.

### 6. Read-only public-note view reuses the mind-map + `MarkdownContent`
A note's `body` is parsed with the existing `parseNoteDoc` to render: (a) a **read-only mind-map** and (b) the document body (preamble + auto-numbered sections, like the walkthrough render mode but non-interactive). To render an *arbitrary* body (not the store's editing doc), `NoteMindmap` (and the nodes it uses) gain a **read-only mode** that accepts an external parsed doc and disables all editing affordances (no drag, no undo, no node-action menus, no open-editor on click). The body is rendered with `MarkdownContent` in **public-note mode** (Decision 7). This is packaged as a presentational `PublicNoteView.vue` taking `{ body, paperId }`.
- *Why:* Maximizes reuse of the heading→tree parser and the SVG mind-map; avoids duplicating layout. A read-only flag is a smaller change than a parallel component.
- *Alternatives:* a brand-new mind-map renderer (rejected — duplication); server-rendered mind-map (rejected — Non-Goal).

### 7. Public-note Markdown rendering makes block anchors inert, PDF anchors live
`MarkdownContent` gains a prop (e.g. `:public-note="true"`, equivalently an "inert block anchors" mode). In that mode, after render, anchors whose `paperland://` target is a **block target** (`?h=…`, no `?pdf=`) are de-linked — rendered as their plain text (or non-clickable) — while **PDF targets** (`?pdf=…`) remain clickable and keep routing to the viewer. The click interceptor ignores block targets in this mode as a backstop.
- *Why:* A block/Q&A anchor resolves against the *current viewer's* Q&A store, so it can't address the author's Q&A — rendering it as a dead link would be misleading. PDF anchors address the shared paper PDF and remain meaningful.
- *Alternatives:* strip block anchors at publish time on the server (rejected — lossy; the owner's own view should keep them live).

### 8. Right-panel placement: a section within the Note tab
The per-paper public-notes list renders as a collapsible **"Public notes from others"** section inside the Note tab area (below the user's own note view in `NoteWalkthrough`/the viewer panel), so it lives in the right panel as specified without adding a new top-level tab. It calls `GET /api/papers/:id/public-notes` once the tab/section mounts (cheap, body-less); each list entry is itself a collapsible that lazily fetches `GET /api/notes/:noteId` and renders a `PublicNoteView` on first expand. The deep-link (Decision 5) drives this section to expand a specific entry.
- *Why:* "右侧面板" with collapsed-by-default entries maps cleanly to a section of stacked collapsibles; no new tab keeps the viewer chrome stable.
- *Alternatives:* a dedicated 4th tab (heavier; the requirement says "panel", not "tab"); a global drawer (loses paper context).

### 9. Owner controls live on the owner's own note surface
On the owner's note (paper detail), add a **publish/unpublish** toggle and, when public, a **copy link** action (writes `<origin>/papers/:id?note=:noteId` to the clipboard). State flows through the `notes` store: `isPublic` derived from `noteRow.is_public`, `setPublic(bool)` calling the visibility endpoint and updating `noteRow`, and a `shareLink` getter.

## Risks / Trade-offs

- **Exposing usernames on public notes.** → Acceptable and necessary (attribution). Only `username` is surfaced, never credentials; private-note authorship is never exposed to non-admins.
- **Admin reading private notes.** → Gated strictly by `request.user.role === 'admin'` on the server (the frontend toggle is convenience only; the server is the source of truth). 404 (not 403) on unauthorized single-note fetch avoids leaking existence.
- **Inert-anchor correctness.** Block vs PDF is decided purely by the presence of `?pdf=` in the parsed `paperland://` URL (PDF already takes precedence in the existing parser). → Reuse the existing `parsePaperlandUrl` classification so the inert rule can't diverge from interception.
- **Read-only mode regressions in `NoteMindmap`.** Threading a `readonly`/external-doc mode risks breaking the editing path. → Default the new props off; the owner's editing path passes nothing and behaves exactly as before; cover the read-only branch in component usage.
- **Anonymous reaching the `/notes` page.** The standalone `/notes` page stays login-gated (unchanged); the cross-user *API* is anonymous-capable to power the right panel and shared links. → Keep the route `meta.requiresAuth`; only the API and the paper-detail panel serve anonymous.
- **Stale `?note=` link (note deleted or unpublished).** → `GET /api/notes/:noteId` returns 404; the deep-link handler shows a brief "note unavailable" notice and lands on the paper without opening anything.

## Migration Plan

1. Add `is_public` to the `notes` schema; run `bunx drizzle-kit generate` and apply on startup. Existing notes remain private — no backfill.
2. Ship backend endpoints + shared types, then frontend. The flag is additive and defaulted, so an old frontend against a new backend still works (it just never sets `is_public`).
3. Rollback: the column is harmless if unused; reverting the frontend hides all public-notes UI and notes simply stay private.

## Open Questions

- Should the per-paper right-panel list ever include the admin's "private notes" view, or is admin-private strictly a `/notes` + by-id-link affordance? (Current design: the latter, to keep the panel = public-only.)
- Should `/notes` "everyone" scope be available to anonymous visitors (route currently login-gated)? (Current design: no — only the API and the paper-detail panel are anonymous-capable.)

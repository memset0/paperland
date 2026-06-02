## 1. Data model & shared types

- [x] 1.1 Add `is_public: integer('is_public').notNull().default(0)` to the `notes` table in `packages/backend/src/db/schema.ts` (plain integer 0/1, matching the existing `completed` convention; surfaced as boolean via `toNote`)
- [x] 1.2 Run `cd packages/backend && bunx drizzle-kit generate` and verify the generated migration only adds the `is_public` column (default 0); confirm it applies on startup → `0020_public_the_santerians.sql`
- [x] 1.3 In `packages/shared/src/types.ts`, add `is_public: boolean` to `Note`; add a `PublicNoteSummary` type (`id`, `user_id`, `username`, `updated_at`) and a `NoteWithAuthor` type (`NoteWithPaper` + `username`) for the cross-user/list and single-note responses

## 2. Backend — visibility & cross-user read endpoints

- [x] 2.1 In `packages/backend/src/api/notes.ts`, ensure `GET /api/papers/:id/note` returns the owner's note including `is_public` (via the extended `toNote` helper)
- [x] 2.2 Add `PUT /api/papers/:id/note/visibility` (inline auth guard, body `{ is_public: boolean }`): operate only on the caller's `(user, paper)` note, require an existing non-empty note (else 400), set `is_public`, return `{ data: Note }`; independent of the body's optimistic `updated_at`
- [x] 2.3 Add `GET /api/notes/:noteId` returning `NoteWithAuthor` (join papers for `paper_title`, join users for `username`); authorize when the note `is_public` OR owned by caller OR caller is admin (`request.user?.role === 'admin'`); otherwise 404. No auth required for the public case
- [x] 2.4 Add `GET /api/papers/:id/public-notes` returning body-less `PublicNoteSummary[]` of public, non-empty notes for the paper authored by users other than the caller (anonymous excludes none); no auth required
- [x] 2.5 Extend `GET /api/notes` with `?scope=mine|all` (default `mine`) and admin-only `?include_private=true`: `mine` unchanged (401 for anonymous); `all` returns public (any author) + caller-owned non-empty notes (anonymous allowed, public-only, 200); `all&include_private=true` adds others' private notes only for admins; annotate every row with `user_id`, `username`, `is_public`
- [x] 2.6 Added backend tests in `packages/backend/src/api/notes.test.ts` covering: visibility toggle (owner-only, empty-note rejection), single-note authz (public/own/admin/404), per-paper public list (excludes own, excludes private, body-less), and `GET /api/notes` scope/include_private matrix — 22 pass

## 3. Frontend — API client & notes store

- [x] 3.1 In `packages/frontend/src/api/client.ts`, add `notesApi.setVisibility(paperId, is_public)`, `notesApi.getById(noteId)`, `notesApi.listPublicForPaper(paperId)`, and a `scope`/`include_private` option on `notesApi.listAll()`
- [x] 3.2 In `packages/frontend/src/stores/notes.ts`, expose `isPublic` (from `noteRow.is_public`), a `setPublic(bool)` action calling the visibility endpoint and updating `noteRow`, and a `shareLink` getter (`<origin>/papers/<paperId>?note=<noteId>`)

## 4. Frontend — read-only public-note rendering

- [x] 4.1 Add a public-note mode to `packages/frontend/src/components/MarkdownContent.vue` (`:public-note` prop): post-render, de-link block (`?h=`) `paperland://` anchors to inert plain text (`.anchor-inert`) and make the click interceptor ignore block targets, while leaving PDF (`?pdf=`) anchors actionable (reuse `parsePaperlandUrl` for classification)
- [x] 4.2 Add a read-only/external-doc mode to `packages/frontend/src/components/notes/NoteMindmap.vue` + `NoteNode.vue` (`readonly` + `doc` props) that renders an explicit parsed doc and disables drag, undo, node-action menus, and open-editor-on-click
- [x] 4.3 Create `packages/frontend/src/components/notes/PublicNoteView.vue` taking `{ body, paperId }`: parse with `parseNoteDoc`, render the read-only mind-map first, then the document body (preamble + auto-numbered sections like the walkthrough render) via `MarkdownContent` in public-note mode

## 5. Frontend — right-panel public notes section

- [x] 5.1 Created `PublicNotesPanel.vue` shown in the right-panel Note area (in `NoteWalkthrough.vue`'s render scroll): fetches `GET /api/papers/:id/public-notes` on mount; renders one collapsed entry per note (author + updated date), never the caller's own (server-excluded)
- [x] 5.2 Lazily fetches `GET /api/notes/:noteId` and renders `PublicNoteView` only on an entry's first expand; entries are collapsed + unfetched by default
- [x] 5.3 Wired into `NoteWalkthrough.vue` (render area) + `PaperViewerPanel.vue` (switches to the Note tab on a `?note=` request via `usePublicNoteOpen`); shows for authenticated and anonymous visitors

## 6. Frontend — owner publish toggle & share link

- [x] 6.1 On the owner's note surface (`NoteWalkthrough.vue` header), added a publish/unpublish toggle (Globe/Lock) bound to `store.setPublic`, shown only for the owner of a non-empty note
- [x] 6.2 Added a copy-link button visible only when `store.isPublic`, copying `store.shareLink` to the clipboard with a confirmation toast

## 7. Frontend — `?note=` deep-link open behavior

- [x] 7.1 In `packages/frontend/src/views/PaperDetail.vue`, extended `handleAnchorFromRoute()` and the route watcher to handle `route.query.note`: fetches the note via `notesApi.getById`
- [x] 7.2 Own note (`note.user_id === auth.user.id`) → "this is your own note" hint, skip auto-open; otherwise `requestPublicNote(noteId)` (PaperViewerPanel switches to Note tab; PublicNotesPanel expands + scrolls)
- [x] 7.3 On null/unavailable note, shows a brief "Note unavailable" toast and stays on the paper

## 8. Frontend — notes list page (cross-user)

- [x] 8.1 In `packages/frontend/src/views/NotesPage.vue`, added a scope toggle (Mine / Everyone) driving `notesApi.listAll({ scope })`; shows each note's author + a public/private badge
- [x] 8.2 For admins (`useAuthStore().isAdmin`), added an "Include private" checkbox (passes `include_private=true`, only when scope is Everyone)
- [x] 8.3 Note selection navigates via `?note=<id>` for others' notes (opens in the right panel); own notes navigate plainly (already in the user's Note tab)

## 9. Docs & verification

- [x] 9.1 Notes endpoints are internal `/api/*` (not the Bearer `/external-api/*` in `external-api.md`), so documented the new/changed endpoints (visibility toggle, single-note fetch, per-paper public list, `scope`/`include_private`) + auth tiers in `docs/frontend-architecture.md`, and the `is_public` column in `docs/tech-stack.md`
- [x] 9.2 Updated `docs/frontend-architecture.md` with a "公开笔记 (Public notes)" subsection (public-note view, right-panel public notes section, `?note=` deep link + `usePublicNoteOpen`, notes-page scope/admin toggles, inert-anchor rendering)
- [x] 9.3 Automated verification: backend `notes.test.ts` 22 pass (visibility/authz/list/scope matrix); frontend `vue-tsc --noEmit` 0 errors; `vite build` succeeds. (Interactive end-to-end check — publish/copy-link/open-as-other-and-anonymous/own-note-hint — still recommended via `bun run dev`.)

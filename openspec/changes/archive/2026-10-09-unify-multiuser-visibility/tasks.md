## 1. Data model and config

- [x] 1.1 Add `user_sharing_settings` (PK `user_id`+`data_type`, `shared`, `updated_at`) to `db/schema.ts`, run `bunx drizzle-kit generate`, and verify the migration only creates the new table
- [x] 1.2 Add the `sharing.default_shared` block (explicit inner default `true`) to `config.ts`, `config.example.yml`, and shared config types; verify config loads with and without the key
- [x] 1.3 Add `SharingPreferences` and `shared`/`username` fields to the relevant `packages/shared` types; verify `bun run --filter '@paperland/frontend' build` type-checks

## 2. Visibility helper and preferences API

- [x] 2.1 Implement `auth/visibility.ts` (`getSharingPrefs`, `setSharingPrefs`, `canViewOwnedRow`, `ownerVisibilityFilter`, `isSharedByOwner`, `sharedFlagsFor`) with unit tests covering mine, non-admin all (shared, unshared, default true/false), admin all, and anonymous
- [x] 2.2 Add `GET/PUT /api/auth/me/sharing` (in a dedicated `api/sharing.ts`) with validation (unknown key or non-boolean → 400, anonymous → 401); verify with tests

## 3. Apply visibility to endpoints

- [x] 3.1 `api/qa.ts`: use the helper for `/api/qa/free` and `/api/papers/:id/qa` all scope (SQL-level, so pagination totals are correct) and return `shared`; verify existing QA tests plus new sharing cases in `qa_access.test.ts`
- [x] 3.2 Result SSE / QA viewer-preference authorization: deny non-admins a free entry whose owner does not share Q&A (404); verify with a test
- [x] 3.3 `api/notes.ts`: the all scope becomes published OR shared OR own (admin: all), `include_private` is ignored, `shared` is returned; `GET /api/notes/:id` and `/api/papers/:id/public-notes` follow the same rule; verify `notes.test.ts` with published-overrides-off and admin cases
- [x] 3.4 `api/highlights.ts`: add `scope` with `user_id`/`username`/`shared`; keep mutations owner-only; verify with new tests
- [x] 3.5 `api/reference_links.ts`: add `scope` with `user_id`/`username`/`shared`; keep mutations owner-only; verify `reference_links.test.ts` with sharing and non-owner delete cases

## 4. Frontend

- [x] 4.1 API client and store methods for sharing prefs; add a "Sharing" section with four switches and explanatory copy to `AccountDialog.vue`; verify that toggling persists across reopen
- [x] 4.2 NotesPage: remove the include-private toggle, show the author, a "Published" indicator, and an admin "Private" badge; verify in the browser as admin and as a normal user
- [x] 4.3 QAPage feed and PaperDetail User Q&A card: show the "Private" badge for admins on `shared: false` entries; verify both views
- [x] 4.4 ReferenceLinksSection: add a Mine/All selector, owner label, Private badge, and edit/delete only on own links; verify in the browser
- [x] 4.5 Highlights: store `scope` (localStorage-remembered), Mine/All selector on PaperDetail and `/qa`, `hl-foreign` read-only rendering with an owner tooltip, no click menu on foreign highlights; verify in the browser with two users
- [x] 4.6 PaperDetail others' notes section: show author, Published, and Private markers, and rename the heading to reflect shared plus published notes; verify the anonymous view still lists only published notes

## 5. Docs and verification

- [x] 5.1 Update `docs/frontend-architecture.md`, `docs/external-api.md` (note: the External API has no optionally-shared data; internal API scope changes), and `docs/tech-stack.md` (new table, config key, visibility helper)
- [x] 5.2 Run the targeted backend tests (`qa_access`, `notes`, `reference_links`, `tags`, new visibility/sharing tests; no external-API-hitting tests) and the frontend build; walk through with an admin plus two normal users (one sharing, one not) and verify all scenarios in the delta specs
- [x] 5.3 Run `npx openspec validate unify-multiuser-visibility --strict` and verify it passes
- [x] 5.4 Fix the pre-existing `images.test.ts` "counts references across note bodies" failure (it inserted two notes for one (user, paper), violating `notes_user_paper_unq`) by giving each note its own paper; verify the full non-external backend suite is green

## 1. Data model and API

- [x] 1.1 Add nullable `users.nickname` to `db/schema.ts`, run `bunx drizzle-kit generate`, and verify the migration only adds the column
- [x] 1.2 Add `nickname` to shared `User`/`SessionUser` and `display_name` to attributed row types; session user, login, `/api/auth/me` return `nickname`
- [x] 1.3 `PATCH /api/auth/me` and `PATCH /api/users/:id` accept `nickname` (trim, empty → null, >32 or non-string → 400); `GET /api/users` returns it; verify with tests
- [x] 1.4 Return `display_name` from `api/qa.ts`, `api/notes.ts` (list, single, public-notes), `api/highlights.ts`, `api/reference_links.ts`; verify with tests

## 2. Frontend

- [x] 2.1 AccountDialog nickname field; Settings user table nickname column + edit; account menu shows own display name
- [x] 2.2 Show `display_name` everywhere an owner is shown (NotesPage incl. search, QAList, QAFeedPanel, ReferenceLinksSection, PublicNotesPanel, highlight tooltip); verify type-check/build and in the browser with two users

## 3. Docs and verification

- [x] 3.1 Update `docs/tech-stack.md`, `docs/frontend-architecture.md`, and check `docs/external-api.md`
- [x] 3.2 Run targeted backend tests and `npx openspec validate add-user-nickname --strict`

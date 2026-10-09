## 1. Data model

- [x] 1.1 Add `user_papers` to `schema.ts`, generate migration 0029, and append the backfill INSERTs (starter paper plus the interaction sources)
- [x] 1.2 Add `library.starter_arxiv_id` to `config.ts` (default `1706.03762`) and `config.example.yml`

## 2. Backend

- [x] 2.1 `services/user_library.ts`: add/remove/lookup helpers and `addStarterPaper`; seed the starter paper at startup when `papers` is empty
- [x] 2.2 `GET /api/papers` scope + `in_library`; `GET /api/papers/:id` `in_library`; `PUT`/`DELETE /api/papers/:id/library`; delete paper removes `user_papers` rows
- [x] 2.3 Bind on `POST /api/papers`, open-arxiv, conference one-click ingest, and external-api create (token user); starter paper on `POST /api/users`
- [x] 2.4 Tests: scope filtering, binding on create (new and existing), add/remove idempotency/404/auth, starter on user creation and seeding, backfill migration

## 3. Frontend

- [x] 3.1 Shared `Paper.in_library`; papers store `scope` (persisted), `addToLibrary`, `removeFromLibrary`
- [x] 3.2 `PaperList.vue` Mine/All toggle, in-list marker / add button, empty-state hint; `PaperDetail.vue` add/remove button

- [x] 3.3 Shared `ScopeToggle` component (Mine/All, md/sm sizes, sliding highlight); replace every Mine/All switch with it (paper list uses `sm`)
- [x] 3.4 Highlight Mine/All selector also in the User Q&A card header, sharing the one highlight scope with Preset Q&A

## 4. Docs and verification

- [x] 4.1 Update `docs/frontend-architecture.md`, `docs/external-api.md`, `docs/tech-stack.md`
- [x] 4.2 Run safe backend tests and `vue-tsc`; browser check on an isolated instance

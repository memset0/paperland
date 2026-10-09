## 1. Schema

- [x] 1.1 Add `s2_paper_id` (text, unique) to `papers` in `db/schema.ts`, generate the Drizzle migration, append the `s2_url` backfill UPDATE; verify the migration applies on a copy of `data/paperland.db` and populates the expected count
- [x] 1.2 Add `s2_paper_id` to the shared `Paper` type; verify frontend type-check

## 2. Identifier handling

- [x] 2.1 Create `utils/s2_ids.ts` (normalize corpus id / S2 paper id / S2 URL); verify with `utils/s2_ids.test.ts`
- [x] 2.2 Runner: write `s2_paper_id` as a top-level column with collision skip and count it as an existing key; verify with a `service_runner.test.ts` case

## 3. S2 service

- [x] 3.1 `semantic_scholar_service`: write back `paperId` → `s2_paper_id`, query by bare paper id when only `s2_paper_id` exists; verify with mocked-fetch tests

## 4. Create / lookup APIs

- [x] 4.1 `ingestPaper` + `paper_dedup`: accept `s2_paper_id`, dedup arxiv → corpus → s2, backfill cross-ids; `POST /api/papers` normalizes inputs (422 on invalid); verify with `api/s2_paper_id.test.ts` (create, match by s2 id, corpus match backfills s2 id, URL input, invalid)
- [x] 4.2 External API: `POST /external-api/v1/papers`, `POST /external-api/v1/papers/batch`, `GET /external-api/v1/papers` and `GET /external-api/v1/papers/full` accept `s2_paper_id` with normalization; verify with an API test

## 5. Frontend

- [x] 5.1 PaperList add dialog: "Semantic Scholar" tab accepting Corpus ID / S2 paper id / URL, routed to `corpus_id` or `s2_paper_id`; store `createPaper` accepts `s2_paper_id`; verify with frontend type-check/build and a parser unit test

## 6. Docs and verification

- [x] 6.1 Update `docs/frontend-architecture.md`, `docs/external-api.md`, `docs/tech-stack.md`; verify `s2_paper_id` documented in each
- [x] 6.2 Run targeted backend/frontend tests (mocked only); verify all pass

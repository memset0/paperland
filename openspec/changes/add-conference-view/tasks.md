## 1. Database Schema & Migration

- [x] 1.1 Add `conferences` table to `packages/backend/src/db/schema.ts` (id, name not null, year int nullable, start_date/end_date text nullable, location, description, link, created_at, updated_at)
- [x] 1.2 Add `conference_papers` table to `packages/backend/src/db/schema.ts` (id, conference_id FK→conferences.id not null, title not null, topic, authors JSON, abstract, source, external_id, link, status not null default 'pending', paper_id FK→papers.id nullable, metadata JSON, created_at, updated_at) with index on (conference_id, status)
- [x] 1.3 Generate Drizzle migration with `bunx drizzle-kit generate` from `packages/backend/` and verify it is CREATE TABLE only (no changes to existing tables, no backfill)

## 2. Shared Types

- [x] 2.1 Add `Conference` interface to `packages/shared/src/types.ts` (id, name, year, start_date, end_date, location, description, link, created_at, updated_at)
- [x] 2.2 Add `ConferencePaper` interface to `packages/shared/src/types.ts` with `status: 'pending' | 'candidate' | 'ingested'` and `source: 'arxiv' | 'openreview' | 'semantic_scholar' | null`, plus paper_id, topic, external_id, authors, etc.
- [x] 2.3 Add request/response helper types (import payload `{ papers: [...] }`, ingest summary `{ ingested, skipped, errors }`)

## 3. Backend — Reusable Ingest Helper

- [x] 3.1 Extract the paper-create core (dedup check + insert + `serviceRunner.triggerForPaper`) from `packages/backend/src/api/papers.ts` `createFn` into a reusable `ingestPaper({ arxiv_id?, corpus_id?, title, authors?, link? })` function (e.g. `packages/backend/src/services/ingest_paper.ts`)
- [x] 3.2 Refactor `POST /api/papers` to call the extracted `ingestPaper` helper (behavior unchanged, verified by existing flow)

## 4. Backend — Conferences API

- [x] 4.1 Create `packages/backend/src/api/conferences.ts` with `GET /api/conferences?search=&year=&page=` returning `{ data, pagination }` where each item includes `paper_count` and per-status counts
- [x] 4.2 Add `POST /api/conferences` (name required) and `GET /api/conferences/:id`
- [x] 4.3 Add `PATCH /api/conferences/:id` and `DELETE /api/conferences/:id` (delete cascades `conference_papers` in one transaction; never deletes `papers`)
- [x] 4.4 Add `GET /api/conferences/:id/papers` supporting optional `topic`/`status` filters (returns candidates for grouping)
- [x] 4.5 Add `POST /api/conferences/:id/papers/import` — batch insert candidates (status `pending`) in one transaction; title required, unknown `source` stored as null
- [x] 4.6 Add `PATCH /api/conferences/:id/papers/:cpId` (update topic/status) and batch form `{ ids, status }` for status transitions (pending↔candidate)
- [x] 4.7 Add `DELETE /api/conferences/:id/papers/:cpId` (remove candidate only)
- [x] 4.8 Add `POST /api/conferences/:id/ingest` — ingest all `candidate` rows via `ingestPaper` (map arxiv→arxiv_id, semantic_scholar→corpus_id, openreview/unknown→manual), set status `ingested` + `paper_id`, idempotent on existing papers, return summary
- [x] 4.9 Add `POST /api/conferences/:id/papers/:cpId/ingest` — single-candidate ingest using the same pipeline
- [x] 4.10 Register `conferenceRoutes` in `packages/backend/src/index.ts` (under Internal API / basic auth)

## 5. Frontend — Store & Routing

- [x] 5.1 Create `packages/frontend/src/stores/conferences.ts` (fetchConferences, fetchConference, createConference, fetchCandidates, importPapers, updateCandidate(s), deleteCandidate, ingestConference, ingestCandidate)
- [x] 5.2 Add routes to `packages/frontend/src/router/index.ts`: `/conferences` (name `conferences` → ConferenceList.vue) and `/conferences/:id` (name `conference-detail` → ConferenceDetail.vue)
- [x] 5.3 Add a「会议」nav item to `navItems` in `packages/frontend/src/App.vue` (lucide icon, placed after「论文管理」) so it is sibling-level and highlights on `/conferences*`

## 6. Frontend — Conference List Page

- [x] 6.1 Create `packages/frontend/src/views/ConferenceList.vue` rendering conference cards from `GET /api/conferences`
- [x] 6.2 Add name search and year filter controls wired to the list query
- [x] 6.3 Add a「新建会议」dialog (name + optional year/date/location/description/link) calling `POST /api/conferences`
- [x] 6.4 Make each card navigate to `/conferences/:id` on click

## 7. Frontend — Conference Detail Page

- [x] 7.1 Create `packages/frontend/src/views/ConferenceDetail.vue` loading conference + candidates and grouping papers by `topic` (null topic → 「未分类」group)
- [x] 7.2 Create source badge + status badge components/snippets (arXiv / OpenReview / Semantic Scholar; 待确认 / 候选中 / 已入库)
- [x] 7.3 Create an import dialog (upload JSON file or paste JSON) that posts to `/api/conferences/:id/papers/import` and refreshes the candidate pool
- [x] 7.4 Add per-candidate and bulk actions: confirm (pending→candidate), revert (candidate→pending), edit topic, delete
- [x] 7.5 Add the「本次会议一键添加」button: confirm dialog → `POST /api/conferences/:id/ingest` → show ingest summary and refresh statuses
- [x] 7.6 For `ingested` candidates with `paper_id`, link to `/papers/:paper_id`

## 8. Tests

- [x] 8.1 Add backend tests for conferences CRUD and candidate import (no external calls)
- [x] 8.2 Add backend tests for status transitions and one-click ingest using mocked/dedup paths (avoid real arxiv/S2/OpenAI calls per testing caution)

## 9. Docs

- [x] 9.1 Update `docs/frontend-architecture.md` (new pages/routes/nav/store for conferences)
- [x] 9.2 Update `docs/external-api.md` (or internal API docs) with the new `/api/conferences*` endpoints —— Internal API；已写入 `docs/frontend-architecture.md` § 1A.5（项目内部 API 没有独立 doc 文件，沿用 frontend-architecture 里的"页面 + 配套 API"约定）
- [x] 9.3 Update `docs/tech-stack.md` if any new dependency or pattern was introduced —— schema 已加，未引入新依赖

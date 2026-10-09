## Why

Users identify Semantic Scholar papers by either the numeric Corpus ID or the 40-hex S2 paper id (the one in semanticscholar.org URLs), but Paperland only accepts `corpus_id`. The S2 paper id is only kept implicitly inside `metadata.s2_url`, so it cannot be used to look up or dedupe papers, and users cannot paste an S2 URL to add a paper.

## What Changes

- New nullable unique column `papers.s2_paper_id`; the migration backfills it from existing `metadata.s2_url` (258 of 267 papers today).
- `semantic_scholar_service` writes back `s2_paper_id` (from the response `paperId`) when missing, and can query S2 by the bare paper id when a paper has only `s2_paper_id` (priority: arxiv_id → corpus_id → s2_paper_id). Collision with another row is skipped like `corpus_id`.
- Paper creation and lookup accept either identifier, plus S2 URLs:
  - `POST /api/papers`, `POST /external-api/v1/papers`: new `s2_paper_id` body field; dedup checks arxiv_id → corpus_id → s2_paper_id and backfills missing cross-ids on the matched paper.
  - `GET /external-api/v1/papers`, `GET /external-api/v1/papers/full`: new `s2_paper_id` query parameter (lookup; `/full` also `auto_create`).
  - `POST /external-api/v1/papers/batch`: `s2_paper_id` per entry; invalid entries get a per-entry error.
  - Inputs are normalized server-side: `s2_paper_id` is lowercased and validated as 40 hex chars; `corpus_id` accepts `123`, `CorpusId:123`; an S2 URL (`semanticscholar.org/paper/[slug/]<sha>` or `.../CorpusID:<n>`) passed in either field is parsed. Invalid values → 422.
- Frontend add dialog: the "Corpus ID" tab becomes "Semantic Scholar" with one input accepting Corpus ID, S2 paper id, or S2 URL.
- `Paper` shared type gains `s2_paper_id`; paper responses include it.
- Docs updated (`frontend-architecture.md`, `external-api.md`, `tech-stack.md`).

## Capabilities

### New Capabilities
- `s2-paper-id`: Storing, resolving, and accepting the Semantic Scholar paper id alongside Corpus ID for paper lookup, creation, and dedup.

### Modified Capabilities
<!-- none: semantic-scholar-fetch/paper-dedup behaviors are extended via new requirements in s2-paper-id -->

## Impact

- DB: migration adding `papers.s2_paper_id` (unique) + data backfill.
- Backend: `db/schema.ts`, `services/semantic_scholar_service.ts`, `services/service_runner.ts` (top-level key + collision skip), `services/ingest_paper.ts`, `services/paper_dedup.ts`, new `utils/s2_ids.ts`, `api/papers.ts`, `external-api/papers.ts`.
- Shared: `Paper` type. Frontend: `views/PaperList.vue`, `stores/papers.ts`.
- External API: additive fields only, no breaking change.

## 1. Database & Shared Types

- [x] 1.1 Add `link` column (nullable text) to papers table in `packages/backend/src/db/schema.ts`
- [x] 1.2 Generate Drizzle migration with `bunx drizzle-kit generate` (from packages/backend)
- [x] 1.3 Edit the generated migration SQL to include backfill: `UPDATE papers SET link = 'https://arxiv.org/abs/' || arxiv_id WHERE arxiv_id IS NOT NULL AND link IS NULL`
- [x] 1.4 Add `link` field to Paper type in `packages/shared/src/types.ts`

## 2. Backend API

- [x] 2.1 Update `POST /api/papers` in `packages/backend/src/api/papers.ts` to accept and store optional `link` parameter
- [x] 2.2 Update `POST /external-api/v1/papers` in `packages/backend/src/external-api/papers.ts` to accept and store optional `link` parameter
- [x] 2.3 Update `POST /external-api/v1/papers/batch` to accept and store optional `link` parameter per paper

## 3. ArXiv Service Auto-Link

- [x] 3.1 Update `packages/backend/src/services/arxiv_service.ts` to set `link = https://arxiv.org/abs/{arxiv_id}` when link is null, add `link` to `produces` array

## 4. Frontend

- [x] 4.1 Rename "arXiv ID" column to "来源" in `packages/frontend/src/views/PaperList.vue`
- [x] 4.2 Implement source tag rendering: red tag for arXiv (`arxiv:{id}`), gray tag for other URLs (domain only), `-` for null
- [x] 4.3 Make tags clickable — open link in new tab on click
- [x] 4.4 Add optional `link` input field to the Manual Input tab in the paper creation dialog

## 5. Documentation

- [x] 5.1 Update `docs/frontend-architecture.md` to reflect the new "来源" column and link field
- [x] 5.2 Update `docs/external-api.md` to document the `link` parameter in paper creation endpoints

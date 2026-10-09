## Why

Opening the paper list takes seconds: `GET /api/papers` returns every column of each paper, including the full parsed text (`contents`, ~165 KB per paper on average) and the full Semantic Scholar `metadata` (reference lists, ~15 KB per paper). A 20-row page is ~4.5–5 MB of JSON. The server also loads every matching row, with its full text, into memory and only then slices out the page (≈20–39 MB read per request on the production database). The list page uses none of that text.

## What Changes

- `GET /api/papers` (paper list) no longer includes `contents` in its items.
- List items carry a slimmed `metadata` containing only what the list renders: `citation_count`, `reference_count` (computed server-side from `references` when absent), and `s2_url`.
- Pagination is done in SQL (`LIMIT`/`OFFSET` plus a `COUNT(*)` for `total`) instead of loading all matching rows and slicing in JavaScript; the full-text column is never read for the list.
- Filtering, sorting, scope, `pagination` shape, and all other item fields are unchanged.
- `GET /api/papers/:id` (detail) and the external API are unchanged and still return full `contents` and `metadata`.

## Capabilities

### New Capabilities
- `paper-list-payload`: what the paper list endpoint returns per item (no full text, slim metadata) and that it paginates in the database.

### Modified Capabilities
- `paper-list-citation-metrics`: the reference-count fallback to `references.length` moves to the server; the list receives `reference_count` directly.

## Impact

- Backend: `packages/backend/src/api/papers.ts` list handler.
- Shared types: `Paper.contents` becomes optional (absent in list items).
- Frontend: `PaperList.vue` reads `metadata.reference_count` only (no behavior change).
- Docs: `docs/tech-stack.md` / `docs/frontend-architecture.md` describe the list payload.
- No database or config changes.

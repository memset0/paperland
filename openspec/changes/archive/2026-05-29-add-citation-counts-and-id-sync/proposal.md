## Why

Today the Semantic Scholar service only triggers on `arxiv_id`. So a paper added by **arXiv ID** automatically resolves its **Corpus ID** plus citation enrichment, but a paper added by **Corpus ID** gets nothing — it never resolves its arXiv ID, never fetches citation metrics, and never builds a citation graph. ID resolution should be symmetric: adding a paper by either identifier should resolve the other and pull the same enrichment.

The paper list also shows only source badges, giving no signal of how influential a paper is. Surfacing **how many papers cite it** (citation count) and **how many it cites** (reference count) lets users gauge papers at a glance.

## What Changes

- Make `semantic_scholar_service` **bidirectional**: it resolves enrichment from whichever identifier the paper has — `arxiv_id` **or** `corpus_id` — querying S2 via `ARXIV:{id}` or `CORPUSID:{id}` accordingly, and writes back the missing cross-ID (the field-mapping already back-fills both IDs; only the trigger and the queried id-expression change).
- **BREAKING (behavior)**: corpus-only papers are now enriched and have their `arxiv_id` resolved. This reverses the current "Corpus-only paper is not enriched / no reverse resolution" behavior. As an emergent benefit, once a corpus-only paper's `arxiv_id` is resolved, the existing arxiv metadata/PDF services pick it up automatically through the dependency graph.
- Fetch and store `reference_count` (S2 `referenceCount`) alongside `citation_count`, so the true number of references is available independent of the single-page (capped) `references` array.
- Add a **citation-metrics column** to the paper list showing each paper's citation count (cited-by) and reference count, with English labels, shown as `–` when enrichment is absent.
- Update the service-declaration unit test and the affected docs.

No database migration is needed — counts continue to live in the paper `metadata` JSON.

## Capabilities

### New Capabilities
- `paper-list-citation-metrics`: the paper list displays each paper's citation count (cited-by) and reference count, sourced from `metadata`, gracefully degrading when absent.

### Modified Capabilities
- `semantic-scholar-fetch`: bidirectional identifier resolution — the service triggers on `arxiv_id` **or** `corpus_id` and resolves the missing one; the enrichment set additionally includes `reference_count`.

## Impact

- **Backend** — `packages/backend/src/services/semantic_scholar_service.ts`: service `depends_on`, id-expression selection in `execute`, `S2_FIELDS` (+`referenceCount`), `mapS2ToPaperFields` (+`reference_count`), and `fetchAndSaveEdges` (id-expression). Its unit test (`semantic_scholar_service.test.ts`) updates the service-declaration assertions. The `service_runner` itself is unchanged.
- **Frontend** — `packages/frontend/src/views/PaperList.vue`: new column (optionally a small presentational component) reading `paper.metadata.citation_count` / `reference_count`.
- **Shared** — `metadata` is already a generic record; no type change required.
- **Docs** — `docs/external-api.md` (enrichment fields incl. `reference_count`, bidirectional resolution) and `docs/frontend-architecture.md` (new list column).
- **No DB migration**; no config schema change.

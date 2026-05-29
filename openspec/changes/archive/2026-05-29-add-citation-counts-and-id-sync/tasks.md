## 1. Backend — bidirectional S2 service

- [x] 1.1 In `packages/backend/src/services/semantic_scholar_service.ts`, change `semanticScholarService.depends_on` to `[]` and add `reference_count` to `produces` (keep `arxiv_id` out of `produces`).
- [x] 1.2 Rewrite `execute()` to select the S2 id-expression from the paper: `ARXIV:{arxiv_id}` when `arxiv_id` is present, else `CORPUSID:{corpus_id}`; when neither is present, return `{}` (no request) so it completes as a no-op.
- [x] 1.3 Change `fetchAndSaveEdges()` to take the resolved id-expression (e.g. `ARXIV:1706.03762` or `CORPUSID:13756489`) instead of a hardcoded `ARXIV:` prefix, and use it for both `/references` and `/citations`.
- [x] 1.4 Add `referenceCount` to `S2_FIELDS` and map it to `result.reference_count` (default `0`) in `mapS2ToPaperFields`; update the `S2Response` interface to include `referenceCount?: number`.

## 2. Backend — tests

- [x] 2.1 Update the `service declaration` test in `packages/backend/src/services/semantic_scholar_service.test.ts`: assert `depends_on` is `[]` and `produces` contains `reference_count` (and still `corpus_id`, `citation_count`, `influential_citation_count`, `references`), and does NOT contain `arxiv_id`/`tldr`.
- [x] 2.2 Extend the `mapS2ToPaperFields` tests: corpus-only input (`{ corpus_id: '13756489', arxiv_id: null }`) back-fills `arxiv_id` from `externalIds.ArXiv`; `reference_count` is mapped from `referenceCount` and defaults to `0` when absent.
- [x] 2.3 Run only this mocked test file (no real network): `bun test packages/backend/src/services/semantic_scholar_service.test.ts` and confirm green.

## 3. Frontend — citation/reference column

- [x] 3.1 In `packages/frontend/src/views/PaperList.vue`, add a table column (header in English, e.g. "Citations") between "来源" and "添加日期".
- [x] 3.2 Render per row: citation count from `paper.metadata?.citation_count` and reference count from `paper.metadata?.reference_count ?? paper.metadata?.references?.length`; format numbers with `toLocaleString()`.
- [x] 3.3 Show a neutral placeholder (`–`) when a value is `undefined`/`null` (unknown), but show `0` when the value is a known zero; keep the cell compact and `whitespace-nowrap` (optionally extract a small `CitationMetrics.vue` presentational component).
- [x] 3.4 Verify the column degrades gracefully for metadata-only and manually-added papers (no enrichment → placeholders) and does not break row click navigation.

## 4. Docs

- [x] 4.1 Update `docs/external-api.md`: document that the S2 service is bidirectional (`arxiv_id` OR `corpus_id`) and that enrichment now includes `reference_count`.
- [x] 4.2 Update `docs/frontend-architecture.md`: note the new citation/reference column in the paper list and the `metadata.reference_count` (with `references.length` fallback) it reads.

## 5. Verification

- [x] 5.1 Manual smoke test (with backend running from project root): add a paper by Corpus ID, confirm its `arxiv_id` is resolved and `citation_count`/`reference_count` appear in metadata after enrichment; add a paper by arXiv ID and confirm `corpus_id` + counts still resolve.
- [x] 5.2 Confirm the paper list shows both counts for enriched papers and placeholders for un-enriched ones; confirm no duplicate S2 fetch when a paper is ingested with both IDs.
- [x] 5.3 Run `openspec validate "add-citation-counts-and-id-sync" --strict` and ensure it passes.

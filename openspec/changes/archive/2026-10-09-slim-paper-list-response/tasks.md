## 1. Backend

- [x] 1.1 List handler selects all `papers` columns except `contents`; build items without `contents` and with `slimListMetadata()` metadata (`citation_count`, `reference_count` with `references.length` fallback, `s2_url`)
- [x] 1.2 Paginate in SQL: `count(*)` with the same conditions for `total`; page query with `limit`/`offset`, sort column plus `id` tiebreaker
- [x] 1.3 Tests: list item has no `contents` while detail does; slim metadata incl. fallback; page/total correctness with scope and filters (existing list tests still pass)

## 2. Shared / Frontend

- [x] 2.1 `Paper.contents` optional in `packages/shared/src/types.ts`; `PaperList.vue` reads `metadata.reference_count` only; `vue-tsc` passes

## 3. Docs & verification

- [x] 3.1 Update `docs/tech-stack.md` and `docs/frontend-architecture.md` (list payload); `docs/external-api.md` unaffected (note only if it documents the internal list)
- [x] 3.2 Re-measure the list response on a production DB copy (size and time) and record the result
  - Result (prod copy, page 1): Mine 4.51 MB → 44.7 KB, All 5.21 MB → 47.1 KB; warm server time ~380–530 ms → ~55–70 ms

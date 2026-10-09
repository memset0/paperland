## Context

`metadata.s2_url` already embeds the S2 paperId for most papers; `corpus_id` is a unique column used for dedup (`withDedup` keys `arxiv:`/`corpus:`), lookup, and as the S2 query id. `ServiceRunner` writes `arxiv_id`/`corpus_id`/`pdf_path`/`link` to top-level columns and skips a conflicting `corpus_id`.

## Goals / Non-Goals

**Goals:** first-class `s2_paper_id` usable everywhere `corpus_id` is; paste-an-URL convenience.
**Non-Goals:** browser extension / Zotero plugin S2 support; listing-eligibility changes (an S2-id-only paper resolves its corpus_id on first enrichment); DOI input.

## Decisions

1. **Real column, not metadata.** Lookup/dedup need an indexed unique field; matches `corpus_id`. Migration backfills via `substr(json_extract(metadata,'$.s2_url'), 39)` restricted to the `https://www.semanticscholar.org/paper/` prefix and to `MIN(id)` per value (uniqueness-safe).
2. **No synchronous S2 resolution at create time.** A paper created with only `s2_paper_id` is resolved asynchronously by `semantic_scholar_service` (S2 accepts the bare paperId in `/paper/{id}`). Keeps creation fast and avoids a blocking 1-RPS call. Trade-off: a racing create by corpus_id before enrichment could produce a duplicate; the enrichment then skips the conflicting id (existing collision rule). Accepted as rare.
3. **One normalizer module `utils/s2_ids.ts`** (`normalizeCorpusId`, `normalizeS2PaperId`, `parseS2Input`) used by both APIs; frontend has its own small parser for routing the single input to the right field (backend still validates).
4. **Dedup key** gains `'s2'` type; key choice priority arxiv → corpus → s2.
5. **Runner**: treat `s2_paper_id` like `corpus_id` (top-level column, collision skip, existing-key). Not added to S2 `produces` (avoid re-running enrichment for the 9 papers S2 doesn't know).

## Risks / Trade-offs

- [Unique index creation fails on dirty data] → backfill picks one row per value; verified 0 duplicates in current DB.
- [S2 paperId changes (merges)] → S2 redirects old ids; we only write when missing.

## Migration Plan

`drizzle-kit generate` for the column + unique index, then append the backfill UPDATE to the generated SQL. Rollback: column is nullable and unused by older code.

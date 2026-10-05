## Context

Highlights are private rows keyed by pathname and a whitespace-stripped MD5 content hash. They do not identify a QA result. Notes are one Markdown body per `(user, paper)` and keep anchors inline as `paperland://...?...h=` links. QA results have stable ids and immutable completed answers but currently no stored content hash.

## Goals / Non-Goals

**Goals:**

- Count the current viewer's real highlights and note references per QA entry.
- Avoid denormalized counters that drift.
- Keep existing highlight rendering/anchor URLs compatible.

**Non-Goals:**

- No shared/other-user reading activity, read receipts, note-anchor table, or arbitrary analytics.
- No streaming-result highlighting before content is final.
- No change to PDF/non-QA highlight behavior.

## Decisions

### 1. Persist final result content hashes

Add nullable `qa_results.content_hash`, backfill with MD5 after removing all whitespace, and set it whenever a new successful result is inserted (including External API compatibility writes). Centralize the algorithm so backend and frontend test vectors match.

### 2. Attribute new QA highlights explicitly

Pass result id from `QAResultView` through `MarkdownContent` and highlight store/API. Validate result paper and stored hash. Use `ON DELETE SET NULL` or equivalent transaction behavior so deleting an answer does not silently erase historical highlight rows.

Legacy attribution uses a one-time application backfill because SQLite lacks MD5. Match only exactly one result; never guess duplicates.

### 3. Aggregate highlight rows, never count cache

For a page/response, group current-user highlights by attributed result, then result by entry. A local optimistic adjustment may update UI immediately, but backend rows remain authoritative.

### 4. Parse one note body per paper

Extract paperland URLs from the current user's note body, keep only matching-paper block hashes, map hash to a unique entry, and count occurrences. For feed pagination, fetch notes for distinct paper ids in one query and parse each body once.

Identical answers within one entry still identify that entry; a hash present under multiple entries is ambiguous and excluded.

### 5. Enrich existing QA responses

Return two integer fields per entry. PaperDetail loads one paper; feed performs batched aggregation for only the current page. The UI omits zero badges and reuses one compact component on both surfaces.

## Risks / Trade-offs

- [MD5 computation/backfill cost] → Run once after a verified backup and compute only on final new answers thereafter.
- [Legacy duplicate answers] → Leave highlight relation null and exclude cross-entry ambiguous anchors.
- [Feed N+1 performance] → Batch results, highlights, and notes for the page.
- [Note parser misses malformed links] → Reuse the existing paperland URL parser/test vectors and ignore malformed input safely.

## Migration Plan

Back up and validate SQLite; add result hash/highlight relation/index; run idempotent result-hash and unique-highlight backfill on a disposable snapshot first; deploy API aggregation then frontend context/indicators. Validate counts for two users, repeated anchors, ambiguous/stale data, PaperDetail/feed consistency, and paper/result deletion. Rollback leaves additive nullable columns harmless.


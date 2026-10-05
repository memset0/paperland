## 1. Safe Hash and Attribution Migration

- [x] 1.1 Create a fresh SQLite online backup and baseline result/highlight/note hashes/counts; verify integrity before schema work
- [x] 1.2 Add nullable `qa_results.content_hash`, nullable `highlights.qa_result_id`, foreign-key behavior, and `(user_id, qa_result_id)` index; generate migration and verify no unrelated DROP/RENAME
- [x] 1.3 Centralize whitespace-stripped MD5 in backend with shared frontend-compatible test vectors and write it for every Internal/External successful result insert; verify deterministic hashes
- [x] 1.4 Implement idempotent result-hash backfill and unique-only legacy highlight attribution; verify ambiguous/stale rows remain unchanged on a disposable snapshot and second run is a no-op

## 2. Highlight Context and Counts

- [x] 2.1 Pass QA result id through `QAResultView` → `MarkdownContent` → highlight store/API while leaving non-QA content null; verify request payloads on paper and feed
- [x] 2.2 Validate result/paper/pathname/hash on highlight creation and preserve owner auth; verify mismatches reject without writes
- [x] 2.3 Batch current-user highlight counts through results to entries for paper/feed responses; verify counts across multiple results and strict user isolation

## 3. Note Anchor Counts

- [x] 3.1 Extract/reuse a backend paperland block-link parser matching existing URL precedence and malformed handling; verify PDF/cross-paper/stale cases
- [x] 3.2 Batch current-user notes for distinct response paper ids, parse each body once, and map unique hashes to entries; verify repeated links count and cross-entry ambiguity does not
- [x] 3.3 Return zero for anonymous/no-note viewers without disclosing another user's note existence; verify public-note data never contributes

## 4. UI Indicators

- [x] 4.1 Extend shared QA response types/store with both integer counts and update after highlight/note mutations; verify cross-surface consistency
- [x] 4.2 Add reusable compact non-zero indicators to PaperDetail and feed collapsed headers; verify counts stay visible while collapsed and omit zeros
- [x] 4.3 Verify feed aggregation remains page-bounded and does not issue per-card highlight/note requests

## 5. Documentation and Verification

- [x] 5.1 Update all three required docs for hash/attribution schema, privacy, derived-count semantics, API fields, and UI
- [x] 5.2 Run focused hash/migration/highlight/anchor/QA response tests plus backend/frontend builds with no external calls; verify all pass
- [x] 5.3 Run strict OpenSpec validation, live-snapshot integrity checks, and final diff audit; verify no historical result/highlight loss or unrelated staging

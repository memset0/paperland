## 1. Durable Prompt Slice

- [x] 1.1 Create and validate online backups and reproducible QA baselines before schema changes and destructive cleanup
- [x] 1.2 Add `qa_entries.prompt`, generate/apply migration `0022`, and backfill recoverable entries without changing result ids or answers
- [x] 1.3 Persist free/preset prompts before ServiceRunner work, use immutable entry text for free reruns, refresh preset text from config, and return prompt for failed no-result entries
- [x] 1.4 Add no-network prompt/API tests, update all three required docs, and verify backend/frontend production builds
- [x] 1.5 Delete only the eight explicitly authorized unrecoverable entry ids after a second verified backup; verify integrity, zero targets/orphans, and unchanged paper/result/service counts

## 2. Exact Result-Service Association

- [x] 2.1 Extend the typed pure-service callback context with its exact execution id while preserving existing callers; verify ServiceRunner unit tests cover concurrent pure runs
- [x] 2.2 Replace QA latest-execution lookup with callback-supplied identity and keep repeated same-paper/model runs distinct; verify mocked concurrent QA results link one-to-one
- [x] 2.3 Preserve historical ambiguous links and document that Services remains monitoring-only; verify migration performs no historical execution-id rewrite

## 3. Final Focused Verification

- [x] 3.1 Run focused QA/ServiceRunner tests with mocked providers plus backend/frontend builds; verify no paid or external-service calls
- [x] 3.2 Run strict OpenSpec validation and final diff/data integrity audit; verify no unrelated paths are staged and `packages/backend/data/` is absent

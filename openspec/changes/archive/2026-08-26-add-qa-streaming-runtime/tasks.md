## 1. Baseline, Backup, and Additive Schema

- [x] 1.1 Re-read the archived translation stream/provider tests plus current QA/exact-execution code, add mocked characterization coverage for buffered/streaming QA calls, and verify the baseline tests pass without external services
- [x] 1.2 Create a fresh SQLite online backup and record integrity, foreign-key check, QA entry/Result counts, and stable id/prompt/answer/execution/content-hash digests; verify the backup has no WAL/SHM dependency
- [x] 1.3 Add the Result lifecycle/requester/capability/timing columns to Drizzle schema, generate an additive migration with historical-success backfill, and verify the SQL neither rebuilds tables nor changes existing ids/content
- [x] 1.4 Apply the migration to a disposable production snapshot and verify integrity, FK behavior (`requested_by_user_id` set-null), deletion flows, digests, and historical rows backfilled as done

## 2. Result State and Cancellable Service Primitives

- [x] 2.1 Add typed QA Result lifecycle predicates/transition helpers and the single entry aggregate recomputation helper; verify table-driven tests cover concurrent success, queued/running precedence, older-success-plus-new-failure, all-failed, and no-result states
- [x] 2.2 Extend semaphore and rate-limit waits with AbortSignal-aware removal/cleanup; verify deterministic tests cancel queued and cooling-down waiters without consuming a later slot or leaking listeners
- [x] 2.3 Extend pure Service execution context with an execution-owned signal, synchronous pre-run preparation hook, controller registry, and exact cancel method; verify preparation failure, queued/running cancellation, sibling isolation, terminal no-op, and release-once behavior
- [x] 2.4 Extend startup cleanup to fail stale active Results while preserving prompt/partial answer and recomputing only affected entries; verify restart fixtures reconcile matching Service executions and leave completed history untouched

## 3. Durable QA Model Runs

- [x] 3.1 Thread the existing provider-neutral `ModelInvokeOptions` through `askQuestion` and expose truthful streaming capability; verify mocked buffered and streaming providers preserve the authoritative final-string contract and AbortError
- [x] 3.2 Refactor `runQA` to prepare and return one queued Result/execution identity before background waiting, then transition to awaiting-output; verify prompt/model/requester/execution fields are durable even when cancelled or failed before the first character
- [x] 3.3 Implement ordered 150–250 ms chunk coalescing with persist-before-publish and terminal flush; verify controlled-clock tests cover first-chunk transition, bounded write count, no delta loss/reordering, failure partial retention, and authoritative final replacement/hash
- [x] 3.4 Make every Result terminal path use the aggregate helper and a first-terminal-wins guard; verify concurrent model completion/failure/cancellation cannot prematurely finish an entry or overwrite a committed terminal state
- [x] 3.5 Update free/template/regenerate trigger paths to await scheduling identities and add a backward-compatible `runs` response; verify multiple and repeated models append distinct Results while free prompts stay immutable and preset retries reload latest config text

## 4. Internal Live Stream, Cancellation, and API Boundaries

- [x] 4.1 Add a Result-scoped in-memory notification broker whose committed delta/terminal publications are subscriber-safe and non-authoritative; verify multiple subscribers, unsubscribe, terminal cleanup, and no-subscriber generation
- [x] 4.2 Add authenticated `GET /api/qa/results/:resultId/stream` with normal entry visibility, start/delta/done|error SSE, derived thinking timing, first-output transition, heartbeats/backpressure, and reconnect snapshots; verify mocked route tests cover event order, unique terminal event, denied/anonymous access, and disconnect without model abort
- [x] 4.3 Add owner/admin-scoped `POST /api/qa/results/:resultId/cancel` using the exact execution id and preset initiator rule; verify free owner, preset initiator, admin, read-only other user, terminal, and sibling-run cases
- [x] 4.4 Include additive lifecycle, derived `thinking_duration_ms`, and `can_cancel` fields in Internal paper/feed reads while filtering External API QA output to done Results only; verify duration derivation for awaiting/streaming/no-output terminal states, existing External API shapes/completed answers, and Internal mine/all visibility

## 5. Frontend Streaming Experience

- [x] 5.1 Extend shared/frontend Result types and extract/reuse a generic fetch-SSE frame consumer from translation without regressing translation; verify parser fixtures cover fragmented start/delta/done/error frames and AbortSignal cancellation
- [x] 5.2 Add QA-store Result subscription ownership, snapshot replacement, ordered delta patching before done, animation-frame batching, bounded reconnect, route/page/scope cleanup, and active-Result polling fallback; verify stale streams cannot update a newer snapshot, done waits for queued paints, and browser unsubscribe never calls cancel
- [x] 5.3 Add an isolated fixed-width Thinking timer driven by server-derived duration plus a local monotonic one-second tick; verify queued has no timer, awaiting advances without rerendering answer/tab components, first chunk freezes it, buffered/no-output terminal timing is correct, and unmount clears timers
- [x] 5.4 Add a streaming Markdown preview with append-only committed blocks and a provisional tail, shared MarkdownIt/KaTeX semantics, disabled unstable highlight/anchor writes, no auto-scroll/transitions, and one final canonical `MarkdownContent` render; verify fake-rAF/component tests cover ordered multi-delta coalescing, unclosed fences/math/lists/tables, stable prefix DOM identity, viewport stability, and exactly one final render
- [x] 5.5 Extend `QAResultView` tabs with queued/awaiting/streaming/done/failed/cancelled badges, active/terminal timestamps, Thinking/preview components, precise error, stop, and retry events; verify newest active runs auto-select while timer/answer updates do not alter result signatures and manual historical selection survives equivalent polling
- [x] 5.6 Wire the same Result experience into PaperDetail and `/qa`, including immediate scheduled runs, read-only all-scope controls, buffered-provider messaging, and exact stop/retry behavior; verify one run can stop while siblings and collapsed/background generation continue

## 6. Documentation, Verification, and Live Migration

- [x] 6.1 Add focused mocked backend tests for migration, Result state/aggregation, runner cancellation, batching, startup recovery, SSE, auth, triggers, and External filtering; run only those tests and verify no real model/paper service is contacted
- [x] 6.2 Add focused frontend stream/store/selection/timer/incremental-Markdown/layout-stability fixtures and run them plus backend/frontend production builds; wait for real child exit codes and verify only known dependency/chunk-size warnings remain
- [x] 6.3 Update `docs/frontend-architecture.md`, `docs/external-api.md`, and `docs/tech-stack.md` for the state machine, schema, SSE/cancel APIs, ownership, recovery, Service distinction, UI, and completed-only External behavior; verify documented snake_case fields match code
- [x] 6.4 Run strict OpenSpec validation, migration snapshot/diff checks, `git diff --check`, and an exact-path worktree audit; verify `packages/backend/data/` is absent and no unrelated concurrent files would be staged
- [x] 6.5 Create an immediate pre-apply online backup, apply the reviewed migration to the live database, and recheck integrity/FKs/counts/digests without restarting the shared user-managed backend; verify code activation is deferred to the next normal root-started restart

## 7. Effective Codex Streaming Configuration

- [x] 7.1 Convert the effective max/xhigh/medium GPT-5.6-sol and GPT-5.5-xhigh Codex QA definitions from shell exec to structured app-server `stream: true`, preserve names/model ids/efforts/timeouts, and update the example plus all three docs
- [x] 7.2 Validate configuration loading and `getModelCapabilities` for every configured Codex model without invoking a real model; run the existing mocked provider/config tests and strict OpenSpec validation
- [x] 7.3 Wait for currently active QA Results to become terminal, restart the shared frontend/backend from the project root, and verify health plus the safe config endpoint/capability state without issuing a paid smoke question
- [x] 7.4 Keep all newly introduced streaming-state UI copy in English (`Queued`, `Thinking`, `Streaming`, `Thought for`, buffered hint, and agent-thinking hint); verify source scan and frontend build contain no Chinese streaming hints

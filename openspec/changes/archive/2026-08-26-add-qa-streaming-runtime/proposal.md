## Why

QA generation is still represented only by a coarse entry-level `pending/running/done/failed` flag, while a successful `qa_results` row appears only after the whole model call finishes. That loses per-run queue/first-output/partial-output visibility, makes concurrent or repeated runs ambiguous, and cannot preserve a partial answer when a provider fails or the server restarts. The completed translation streaming work now provides one tested provider-neutral `onChunk + AbortSignal` contract that QA can reuse without leaving ServiceRunner.

## What Changes

- Keep the existing `qa_entries → qa_results` one-to-many structure, but create one durable Result for every model run before it enters the ServiceRunner queue.
- Add per-Result lifecycle and timing fields for `queued → awaiting_output → streaming → done|failed|cancelled`; preserve prompt, partial answer, exact `execution_id`, model, error, and timestamps for every run.
- Continue using ServiceRunner for QA concurrency, rate limiting, execution history, and coarse Service state. Add the minimal pure-execution lifecycle/cancellation hooks needed to create the Result before background work and abort one exact execution.
- Reuse `callModel(..., { onChunk, signal })`. Persist partial text in bounded batches, publish ordered live updates, and replace it with the provider's authoritative final text on success.
- Add an authenticated/visibility-checked Result SSE subscription and an owner/admin cancellation endpoint. Closing an SSE viewer SHALL only unsubscribe the viewer; it SHALL NOT cancel the background QA run.
- Keep `qa_entries.status` as a compatibility aggregate across all of an entry's Result runs, so simultaneous models and failed regenerations cannot prematurely mark the whole entry complete or failed.
- Mark stale active Results as failed after server restart while retaining their question and partial answer; allow normal QA regeneration from the persisted entry prompt.
- Update PaperDetail and `/qa` to show a tab for each queued, active, completed, failed, or cancelled run. Before the first output, show a live `Thinking · mm:ss` timer; after the first output, freeze the thinking duration and continuously append/render the real answer stream; on completion, render the authoritative final answer once through the canonical Markdown/highlight path.
- Keep the streaming UI stable: coalesce updates to animation frames, retain committed Markdown-block DOM while only the provisional tail changes, keep status/timer geometry fixed, avoid automatic page scrolling, and do not enable hash-based highlights/anchors until the final answer is stable.
- Keep completed-only External API behavior: active/failed/cancelled internal Result attempts and the internal SSE/cancel routes are not exposed under `/external-api/*`.
- Migrate the effective/default Codex QA model definitions and the repository example from buffered `codex exec` shell mode to structured `stream: true` app-server definitions, preserving each model id, reasoning effort, timeout, and stable Paperland model name.
- Update all three required `docs/` architecture documents.

## Capabilities

### New Capabilities

- `qa-streaming-runtime`: Durable per-run QA state machine, partial-output persistence, live subscription, cancellation, recovery, and entry-status aggregation.

### Modified Capabilities

- `database-schema`: Extend the existing `qa_results` table with lifecycle, partial-output, capability, error, and timing fields while preserving ids and relationships.
- `service-runner`: Give pure-service callers a pre-run execution identity and cancellable execution signal without removing QA from unified scheduling/monitoring.
- `data-ownership`: Apply existing QA visibility and owner/admin mutation rules to Result streams and cancellation.
- `qa-display-split`: Show per-Result live/terminal states and partial answers on PaperDetail.
- `qa-feed-page`: Show the same Result streaming experience in `/qa` while retaining scoped pagination and polling fallback.

## Impact

- Database: one safety-checked migration of `qa_results`; existing successful rows backfill as `done` with unchanged ids, prompts, answers, hashes, and execution links.
- Backend: QA orchestration, `askQuestion` model options, ServiceRunner pure execution lifecycle/cancellation, startup recovery, SSE subscription broker/routes, and aggregate-status helpers.
- Frontend/shared: QA Result types and derived thinking duration, stream client/store reconciliation, isolated timer, stable incremental Markdown preview, one final canonical render, Result tabs/status actions, PaperDetail/feed rendering, and active-run polling fallback.
- APIs: additive Internal API Result fields plus stream/cancel routes; trigger responses add exact `result_id`/`execution_id` identities. Existing External API fields and completed-answer semantics remain unchanged.
- Dependencies: no new runtime dependency; reuse the existing model providers, SSE parsing approach, Fastify, Drizzle, and SQLite WAL.

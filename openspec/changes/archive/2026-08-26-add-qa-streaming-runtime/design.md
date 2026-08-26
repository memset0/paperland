## Context

See `proposal.md` for motivation and the delta specs for observable behavior. The constraints shaping the implementation are:

- The current cardinality is already correct: one `qa_entries` question owns append-only `qa_results` history. Prompt persistence and exact successful Result ↔ Service execution association have already been applied in `isolate-qa-runtime`.
- `runQA()` currently creates a Result only after `askQuestion()` returns, and each concurrent callback directly writes the one entry-level status. That makes the first finishing model incorrectly capable of ending the whole entry.
- `callModel(prompt, modelName, { onChunk, signal })` and truthful provider `streaming` capabilities are now shipped by the archived translation change. Buffered providers still return the same authoritative final string without fake deltas.
- Translation's HTTP request owns its model call, so disconnect aborts it. QA instead runs as a background pure Service and must outlive any one viewer or route.
- SQLite runs in WAL mode. Token-level writes would create needless contention, but partial text must become durable frequently enough to survive a process interruption.
- Existing Internal API/frontend code assumes `completed_at` is non-null. The change should remain additive and avoid rebuilding the Result table while other active changes share the dirty worktree.

## Goals / Non-Goals

**Goals:**

- Make one Result row the source of truth for one exact model run, including failure and cancellation.
- Preserve useful partial output and expose genuine live progress with reconnectable snapshots.
- Keep ServiceRunner as the only QA concurrency/rate-limit/execution monitor.
- Keep current entry ids, Result ids, history, highlight hashes, and External API completed-answer behavior compatible.
- Make multi-model and repeated runs aggregate correctly at the entry level.

**Non-Goals:**

- No provider-level continuation of an interrupted generation; recovery is honest failure plus a fresh retry.
- No follow-up/tree context or multi-turn prompt assembly; that remains the next independent change.
- No Agent-facing QA API, database view, or direct database exposure.
- No QA-specific retry/cancel buttons on the Services dashboard; Services remains a coarse unified monitor.
- No fake character pacing for buffered providers and no persistence of provider reasoning/commentary.
- No WebSocket infrastructure or new runtime dependency.

## Decisions

### 1. Extend `qa_results` additively and keep it as the only answer store

Add these columns to the existing table:

```text
status                  text     not null default 'done'
error                   text     nullable
requested_by_user_id    integer  nullable → users.id (ON DELETE SET NULL)
streaming_capable       integer  not null default 0
created_at              text     not null default ''
started_at              text     nullable
first_chunk_at          text     nullable
finished_at             text     nullable
updated_at              text     not null default ''
```

`answer` holds either `''`, the latest durable partial output, or the authoritative final answer. `content_hash` is null until `done`, then hashes only the authoritative final. Existing rows backfill `status='done'` and use their existing `completed_at` for the new created/updated/finished timestamps.

Keep legacy `completed_at NOT NULL` to make this an additive migration and avoid a table rebuild. A newly queued row temporarily seeds it with `created_at` for schema compatibility; Internal UI ordering/status uses `created_at`/`finished_at`, and success replaces it with the real completion time. Non-done rows are excluded from External API answer output, so external consumers never observe the compatibility placeholder.

`requested_by_user_id` is necessary for a shared preset Result: the entry has no owner, but cancellation still needs an exact principal. Free Result management continues to follow the parent entry owner/admin rule.

**Alternative considered:** create a parallel `qa_runs` table and keep `qa_results` successful-only. Rejected because users need failed/partial attempts in the same answer tabs, it duplicates run/result identities, and earlier decisions explicitly keep the existing entry/result structure.

**Alternative considered:** make `completed_at` nullable by rebuilding the table. Rejected for this change because the additive fields provide correct lifecycle timestamps without a destructive copy/rename migration or overlap with the active exact-link schema delta.

### 2. Prepare the Result synchronously from the exact Service execution

Extend `executePureService` with an optional synchronous `onCreated(context)` hook and an execution context containing `{ executionId, signal }`:

```text
insert service_executions(pending)
  → create/register AbortController
  → onCreated({ executionId, signal })
      → insert qa_results(queued, execution_id=executionId)
  → launch background semaphore/rate-limit worker
  → execute callback({ executionId, signal })
```

`runQA()` becomes async only long enough to schedule the job and return `{ result_id, execution_id, model_name }`; it still does not wait for model completion. Trigger endpoints await scheduling for all chosen models and add these identities to their existing response shapes. If preparation fails, ServiceRunner marks the new execution failed, removes its controller, and never starts the worker.

This removes the race where a no-wait worker could start before its Result existed and guarantees that even a queued/cancelled-before-start attempt has a durable prompt and exact execution link.

**Alternative considered:** insert the Result immediately after `executePureService()` returns. Rejected because the fire-and-forget worker and caller continuations can race when capacity is immediately available.

### 3. Use one Result state machine and one aggregate helper

The QA callback transitions only its Result:

```text
onCreated                   queued
callback begins             awaiting_output + started_at
first non-empty chunk       streaming + first_chunk_at
provider success            done + authoritative answer/hash + finished_at
provider error              failed + partial answer/error + finished_at
AbortError                  cancelled + partial answer/error + finished_at
```

After each transition, call one transactional `recomputeQAEntryState(entryId)` helper:

```text
any awaiting_output/streaming → running
else any queued               → pending
else any done                 → done (entry.error = null)
else any result               → failed (entry.error = newest terminal error)
else                          → pending
```

The order deliberately gives active work precedence over historical success. It also prevents one model completion from hiding a sibling still in progress. Result errors remain independent; clearing `qa_entries.error` after an older success does not erase them.

### 4. Coalesce provider chunks, persist first, then broadcast

Add a small per-run accumulator around the existing `onChunk` callback. It preserves every non-empty provider delta in order but flushes them as one batch at most every 150–250 ms rather than writing per token. Each flush runs in this order:

```text
append batch to durable qa_results.answer + update lifecycle timestamp
  → publish the exact committed batch to in-memory subscribers
```

The terminal path cancels the timer and synchronously flushes any remaining batch before writing `done`, `failed`, or `cancelled`. The success path finally replaces `answer` with the provider's authoritative returned string. The batching constant is module-local/testable, not a new config surface.

This ordering gives reconnect a simple invariant: the initial database snapshot already contains every earlier published delta. It also bounds SQLite write load without manufacturing or splitting output.

**Alternative considered:** publish token deltas immediately and persist every few seconds. Rejected because a reconnect or process failure could permanently lose text the viewer had already seen.

**Alternative considered:** write every provider delta. Rejected because OpenAI-compatible providers can emit token-sized deltas and create excessive WAL churn.

### 5. Use Result-scoped SSE as an observer of the background job

Add `GET /api/qa/results/:resultId/stream`. After normal authentication/visibility checks, the handler synchronously reads a Result snapshot and subscribes to a small in-process broker before yielding to the event loop, preventing a read/subscribe gap. It sends:

```text
start { result, streaming_capable }
delta { result_id, delta, answer_length, first_chunk_at?, thinking_duration_ms? } *
done  { result }                              # success
error { result }                              # failed/cancelled
```

SSE headers, heartbeat comments, backpressure, and frame encoding follow the translation route. Unlike translation, request close only removes the broker subscriber. It never owns or aborts the model controller. Reconnecting starts with the latest full persisted `result.answer`, after which committed deltas continue.

The broker stores no canonical answer and can be empty when nobody watches; the database remains authoritative. Startup recovery and polling therefore work even though in-memory subscriptions disappear on restart.

**Alternative considered:** return the model stream directly from each trigger POST. Rejected because multi-model jobs, navigation, other viewers, refresh, and ServiceRunner queueing all require generation to outlive the triggering request.

**Alternative considered:** WebSockets. Rejected because Result-scoped server-to-client events fit SSE, and the repository already has a tested SSE parser/headers pattern.

### 6. Make explicit cancellation the only viewer action that owns AbortSignal

ServiceRunner tracks active pure-execution controllers by execution id. Extend semaphore and rate-limit waits to accept an AbortSignal and remove a cancelled waiter cleanly. Add `cancelPureExecution(executionId)` that returns false for unknown/terminal work and aborts exactly one active controller otherwise.

`POST /api/qa/results/:resultId/cancel` checks that the Result is active and authorizes:

- free QA: entry owner or admin;
- preset QA: `requested_by_user_id` or admin.

The route calls the runner by the Result's exact `execution_id`; the QA terminal handler flushes partial output and maps AbortError to Result `cancelled`. ServiceRunner retains its existing coarse schema and records cancellation as an unsuccessful/failed execution with a clear cancellation error. No new generic Service status or Services-page action is introduced.

Queued cancellation must also terminate promptly. The abortable semaphore/rate limiter prevents an already cancelled job from waiting for future capacity merely to discover its signal.

### 7. Reconcile stale Results and Services at startup

Extend the existing startup cleanup transaction:

1. mark stale `service_executions` pending/running as failed (`interrupted by server restart`);
2. mark Result rows in queued/awaiting_output/streaming as failed, preserve `answer`, clear no prompt/model/link, set error/finished/updated timestamps;
3. recompute affected entry aggregates from their Result rows rather than blanket-marking every active entry failed.

No automatic model replay occurs because provider calls cannot safely resume and replay could spend money twice. Regeneration appends a new run using the already applied prompt rules: latest config prompt for preset, immutable entry prompt for free.

### 8. Centralize frontend stream ownership in the QA store

Extend the shared `QAResult` type with lifecycle fields and a derived `thinking_duration_ms`, and make the Pinia QA store own one AbortController per currently observed active Result. Serializers compute the duration from lifecycle timestamps; it is never written as a mutable database counter. When paper/feed fetches or trigger responses reveal active ids, the store opens a fetch-based GET SSE subscription using a genericized version of the translation parser. It patches the same Result objects used by PaperDetail and feed:

- `start`: replace the entire local Result snapshot;
- `delta`: append only to the matching active Result;
- `done/error`: replace with authoritative terminal snapshot and close the subscription.

Changing paper/feed page/scope aborts only those HTTP subscriptions. Existing three-second current-page polling remains as discovery/reconciliation fallback and stops based on active Result states rather than only the coarse entry flag. A bounded reconnect delay can retry an unexpectedly closed active stream; polling prevents an infinite reconnect loop from blocking correctness.

`QAResultView` continues to own tab ordering/selection. The newest pre-created Result becomes the latest tab immediately. Each tab adds a compact status marker and uses `created_at` for active time, `finished_at`/`completed_at` for terminal time. Failed/cancelled empty answers show the error instead. Stop and retry are emitted upward and honor `can_cancel`/`can_manage` returned by the backend.

The Thinking display is a small isolated component. `queued` displays only `Queued`. `awaiting_output` starts from the server-derived `thinking_duration_ms`, advances with a local monotonic clock once per second, and uses tabular digits plus fixed minimum width so `9 → 10` seconds does not shift surrounding controls. The timer update touches only its text node. On the first delta it freezes to `first_chunk_at - started_at` and displays `Thought for`; for a terminal no-output run it freezes to `finished_at - started_at`. A buffered provider therefore truthfully remains Thinking until completion. All new streaming-state labels and hints SHALL use English UI copy.

Do not feed every partial answer into today's `MarkdownContent`: that component replaces the entire `innerHTML`, closes selection UI, re-applies image directives/highlights, and schedules highlight work on every content change. Add a dedicated streaming-preview renderer with two regions:

```text
stable committed Markdown blocks  # append-only DOM, never replaced by later deltas
provisional Markdown tail          # reparsed at most once per animation frame
```

The splitter commits only conservative complete block boundaries outside unclosed fenced code, display math, tables/lists, and other constructs that can absorb later lines. If no safe boundary exists, content remains in the provisional tail. Server batches remain intact and ordered; the browser merges all batches available in one animation frame and never invents character pacing. The preview uses the same MarkdownIt/KaTeX configuration but disables highlight selection, persisted anchors, and expensive post-processing that depends on a stable `content_hash`.

On `done`, wait for all scheduled delta callbacks, discard the preview, and mount the normal canonical `MarkdownContent` once with the authoritative final answer and final `content_hash`. Only then enable highlights/note anchors. Keep the outer Result/tab/action DOM keyed by Result id and mounted throughout; use no height/opacity transition and no automatic scroll. This allows natural downward growth without the card, active tab, timer, or viewport jumping on each chunk.

### 9. Keep Internal and External read contracts deliberately different

Internal PaperDetail/feed reads include all Result attempts and additive lifecycle fields. Result records include computed `can_cancel`; entry-level `can_manage` continues to govern regenerate/delete. Trigger responses retain current fields and add a `runs` array so old internal callers do not break.

External paper serialization filters `qa_results.status='done'` (historical rows backfill done). It does not expose SSE/cancel routes, failed/partial attempts, `requested_by_user_id`, or internal mutation flags. This prevents active partial text from silently entering an API previously understood as completed answers.

### 10. Deploy interactive Codex QA models through app-server

The runtime can only stream when the selected provider definition reports genuine deltas. Legacy `type: codex + shell` selects `codex exec --ephemeral`, whose stdout contains only the completed final message; setting up Result SSE cannot turn that buffered transport into a stream. Convert the effective interactive Codex entries to the already-supported structured shape:

```yaml
type: codex
stream: true
cli_path: /root/.local/bin/codex
codex_home: /root/.codex
model_id: <unchanged underlying model>
reasoning_effort: <unchanged effort>
timeout: 1800
```

Preserve Paperland-facing names so cached frontend model selections remain valid. Validate config/capabilities without invoking a paid model. Because config is loaded at startup, wait for active QA executions to reach terminal states before restarting the shared root-started process; otherwise honest startup recovery would mark them interrupted.

## Risks / Trade-offs

- [Frequent partial writes contend with other SQLite work] → Coalesce genuine chunks into bounded batches, use WAL, update one Result row, and fixture-test write counts.
- [Process crashes between provider output and the next batch flush] → Bound the window to a few hundred milliseconds; preserve every already published batch and all prior text, then mark the run interrupted on restart.
- [SSE disconnects or proxy buffering] → Heartbeats/no-buffer headers, reconnectable full snapshots, and existing current-page polling remain authoritative fallbacks.
- [Buffered providers appear stuck before completion] → Persist `streaming_capable=false` and label awaiting-output truthfully; never fake deltas.
- [Partial Markdown can repeatedly change structure] → Commit only conservative block prefixes, isolate reparsing to the provisional tail, batch paints to animation frames, and perform one authoritative full render at done.
- [Timer updates trigger expensive component work] → Isolate the timer, use a monotonic one-second tick and fixed-width tabular digits, and never include elapsed time in Result selection/signature keys.
- [Cancellation races terminal success] → Serialize Result terminal updates with a terminal guard; the first committed terminal state wins, later abort/done handlers become no-ops.
- [Concurrent models corrupt entry status] → All callers use one aggregate query/helper after Result transitions; tests cover finish/fail/cancel interleavings.
- [Additive legacy `completed_at` placeholder is semantically imperfect] → Internal active UI uses new timestamps/status, External API filters done, and success overwrites it with the real completion time.
- [Result broker loses state on restart] → It is notification-only; database recovery and polling do not rely on broker memory.
- [Shared dirty worktree and overlapping QA schema changes] → Generate only additive SQL, take an online backup, compare ids/content hashes on a disposable copy, and review exact migration files before live apply.

## Migration Plan

1. Re-read the archived translation stream implementation and current exact execution-link code; add mocked characterization coverage before changing shared invocation/runner seams.
2. Create a fresh SQLite online backup and record QA entry/Result counts plus stable id/prompt/answer/execution/hash digests.
3. Add lifecycle columns and safe historical backfill. Generate/review additive migration SQL and apply it first to a disposable production snapshot; verify integrity, foreign keys, deletion behavior, and digests.
4. Add Result state/aggregate helpers, startup recovery, pure-service preparation/cancellation context, and abortable wait primitives with deterministic concurrency tests.
5. Refactor QA scheduling so every invocation returns a queued Result/execution identity, then add chunk batching, authoritative terminal writes, and cancellation with mocked providers only.
6. Add visibility-checked SSE/cancel routes and broker tests for event order, reconnect snapshot, backpressure, disconnect-without-cancel, ownership, and exact cancellation.
7. Extend shared/frontend types, generic SSE consumption, store subscriptions/poll fallback, and Result tab UI on both surfaces.
8. Update `docs/frontend-architecture.md`, `docs/external-api.md`, and `docs/tech-stack.md`.
9. Run only focused mocked backend/frontend tests plus both builds and strict OpenSpec validation; do not call real model or paper services.
10. Apply the reviewed migration to the live database after another immediate backup. Do not restart the shared user-managed backend implicitly; code activates at the next normal root-started restart.

Rollback first restores the pre-migration backup if migration verification fails. After successful deployment, code rollback may safely ignore the additive columns; historical answers remain intact. Newly created failed/partial Result rows should be retained rather than destructively removed.

## Context

The existing two-table cardinality is sound: one `qa_entries` question has many `qa_results`. The defects are narrower:

- Before migration, question text existed only on a successful result. Eight failed free entries had no result and no recoverable prompt.
- `runQA()` associates results by querying the latest QA service execution for the paper. In the pre-proposal snapshot, 1,083 linked results referenced only 362 distinct execution ids, confirming that concurrent runs can share the wrong id.
- Agent readers currently need the large `/papers/full` contract or internal table knowledge to retrieve completed QA.

The prompt slice has now been applied: the live database has `qa_entries.prompt`, recoverable history is backfilled, new free/preset runs persist prompt before ServiceRunner work, and the user-authorized eight unrecoverable entries were deleted after a verified backup.

## Goals / Non-Goals

**Goals:**

- Keep the current QA tables and ServiceRunner integration.
- Guarantee durable prompt recovery and repeatable answer history.
- Make every new successful result link to its exact Service execution.

**Non-Goals:**

- No streaming/first-token/partial-output state in this change; reuse the translation streaming design later.
- No follow-up question tree or multi-turn prompt formatter; create an independent later change.
- No mine/all UI, personal background colors, or reading indicators; those are split changes.
- No historical execution-link guessing.
- No QA-specific retry/action controls in the Services dashboard; it remains unified monitoring only.
- No Agent database-read view or database exposure. A future Agent integration SHALL be designed as an authenticated API in a separate change.

## Decisions

### 1. Persist the question on the existing entry

Add nullable `qa_entries.prompt` without replacing tables. New free entries set the original question in the insert and never change it. Before every preset run, resolve `template_name` from current `config.yml` and store that text. `runQA()` persists the selected prompt synchronously before calling ServiceRunner.

Migration backfills from the newest result. Null remains representable because text cannot be fabricated, but the eight known null/no-result free rows were explicitly deleted after backup. Existing entry/result ids and answer content remain unchanged.

### 2. Keep repeated results append-only

Do not add a uniqueness constraint on `(qa_entry_id, model_name)`. Different models and repeated runs of the same model append results. Each result's `prompt` remains the exact run snapshot, so preset wording changes do not rewrite history.

### 3. Pass execution identity into the pure-service callback

Keep QA registered in ServiceRunner. Change `executePureService` so its callback receives `{ execution_id }` (or the equivalent typed context) created for that call. QA uses that id directly when inserting its successful result. The service status remains the existing coarse pending/running/done/failed lifecycle and stays visible on Services.

Alternative rejected: searching `service_executions` by service name/paper/time remains racy. A separate QA runner would unnecessarily lose unified monitoring and rate limiting.

Historical links are preserved because the service table lacks model/prompt data needed for deterministic repair.

### 4. Split independent product work

- `add-qa-all-users-scope` owns authenticated mine/all reads and asker labels.
- `add-qa-entry-background-colors` owns per-user palette preferences.
- `add-qa-reading-indicators` owns highlight attribution/count and note-anchor derivation.
- Streaming waits for the translation implementation pattern.
- Follow-up trees wait for a separate prompt/context design.

## Risks / Trade-offs

- [Existing process has not restarted] → The schema/data migration is live, while route code activates on the next normal backend restart; avoid restarting the shared dirty worktree implicitly.
- [Historical execution ids are unreliable] → Preserve them and guarantee correctness only for new results.

## Migration Plan

1. Create an online SQLite backup and verify integrity/count/id hashes.
2. Add `qa_entries.prompt`; backfill from the newest result and verify id/content hashes are unchanged.
3. Persist prompt on all creation/run paths and use entry prompt for free reruns.
4. After separate authorization, create a second backup and transactionally delete only the eight listed unrecoverable entries.
5. Extend ServiceRunner callback context and replace latest-execution lookup for new results.
6. Update all three required docs and run only mocked/local QA tests plus backend/frontend builds.

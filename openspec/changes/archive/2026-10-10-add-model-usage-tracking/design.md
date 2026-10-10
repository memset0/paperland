## Context

All model calls go through `callModel` (`services/model_invoke.ts`) → a provider (`codex` app-server/exec, `openai_api` JSON/SSE). Three callers exist: Q&A (`api/qa.ts` → `askQuestion`), Deep Research (`services/research_runtime.ts`, round + optional repair call), and translation (`services/translation_service.ts`). Today providers return only text.

Probing Codex 0.162.1 app-server showed `thread/tokenUsage/updated` notifications during a turn with `{ total, last, modelContextWindow }`, where `total` accumulates every model request of the thread (tool-call iterations included) and splits `inputTokens` / `cachedInputTokens` / `outputTokens` / `reasoningOutputTokens` / `totalTokens`. A two-request turn reported input 29997 with 25088 cached — later requests in a turn mostly hit the prompt cache, so cached and uncached input must be priced separately.

## Goals / Non-Goals

**Goals:** one ledger row per model invocation with tokens + estimated cost + user; per-user totals and an admin leaderboard.

**Non-Goals:** backfilling old calls; real billing (Codex runs on a ChatGPT plan; the cost is an estimate at API rates); costing Codex built-in image generation (not included in `tokenUsage`); exec-mode Codex usage.

## Decisions

1. **Separate ledger table, not columns on request tables** (user decision). `model_usage` has a `category` plus one nullable FK per source table (`qa_result_id`, `research_step_id`, `translation_id`) — real FKs keep integrity, `ON DELETE SET NULL` keeps spending history when the source is deleted. Adding a future category = new enum value (+ FK column if it has a source table).

2. **Provider contract: `onUsage(usage)` callback** on `ModelInvokeOptions`, not a changed return type, so `callModel` callers and tests that expect a string keep working. Codex keeps the latest `total` from `thread/tokenUsage/updated` and emits it once when the turn ends — in `finally`, so failed/cancelled turns that already consumed tokens are still reported. OpenAI JSON reads `data.usage`; SSE sends `stream_options.include_usage` and takes `usage` from the last chunk (choices empty).

3. **Recording at the caller, via a helper** `recordModelUsage({ category, userId, sourceId, modelName, usage })` in `services/model_usage.ts`: computes cost from `pricing`, inserts, swallows/logs errors. Callers know the attribution:
   - Q&A: `runQA` passes `onUsage` → Result id + `requested_by_user_id`.
   - Research: `runAgentStep` passes `onUsage` to both round and repair calls → step id + session owner.
   - Translation: the translation row id is only known after the upsert, so usage is buffered during the call and recorded after the upsert with the returned row id; `translateText` gains `userId`, passed from `api/translation.ts`.

4. **Cost** = `((input − cached) × input_rate + cached × cached_rate + output × output_rate) / 1e6`, cached_rate defaulting to input_rate; reasoning is part of output (OpenAI semantics, also Codex's). Fixed at write time so later price edits do not rewrite history. Pricing is per configured model entry (`models.available[].pricing`), consistent with other per-model settings.

5. **APIs** in new `api/usage.ts`: `/api/usage/me` (any signed-in user) and `/api/usage/leaderboard` (`requireAdmin`), both with optional `days`. Aggregation in SQL (`SUM`, `GROUP BY user_id`), join `users` for names.

6. **UI**: `components/settings/UsageSection.vue` (own totals, all time / 30 days toggle, per-category breakdown) in the Account area; `components/settings/UsageLeaderboard.vue` in the admin area. English labels.

## Risks / Trade-offs

- Some OpenAI-compatible endpoints may reject `stream_options` → acceptable; none are configured today, and the field is standard.
- Codex `total` is per thread; our threads are ephemeral and single-turn, so thread total = invocation total.
- Usage rows written for runs whose Result is later regenerated remain (that money was spent).

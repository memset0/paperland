## Why

Paperland calls models for Q&A, Deep Research rounds and translation, but records nothing about what those calls cost. To see how many tokens each user consumes and roughly what that would cost at API rates, every model call needs a usage record that can be summed per user.

## What Changes

- New table `model_usage`: one row per model invocation, holding the token counts (input, cached input, output, reasoning, total), the estimated cost in USD, the model name, a `category` (`qa` / `research` / `translation`), the owning user (FK `users`), and a nullable FK to the record that caused it (`qa_result_id`, `research_step_id`, `translation_id`). Token usage and cost live only in this table; the request tables (`qa_results`, `research_steps`, `translations`) are not changed. Existing calls are not backfilled.
- Model providers report token usage through a new `onUsage` callback:
  - Codex app-server: the last `thread/tokenUsage/updated` notification of the turn (`total` breakdown).
  - OpenAI-compatible API: `usage` of the JSON response; streaming requests send `stream_options: { include_usage: true }` and read `usage` from the final chunk.
  - Codex exec mode (`stream: false`) reports no usage, so it records nothing.
- Cost estimate: optional per-model `pricing` in `config.yml` (`input`, `cached_input`, `output` in USD per million tokens). Cost = uncached input × input + cached input × cached_input + output × output (reasoning tokens are part of output). Models without `pricing` store `cost_usd = null`; tokens are still stored.
- Usage is recorded for completed, failed and cancelled runs whenever the provider reported usage. A Deep Research round that needed a format repair records two rows (round call and repair call) for the same step.
- Attribution: Q&A → `qa_results.requested_by_user_id`; Deep Research → the session owner; translation → the signed-in user who triggered the uncached translation (cache hits make no model call and record nothing).
- API: `GET /api/usage/me` (the caller's totals, overall and per category) and `GET /api/usage/leaderboard` (admin only; per-user totals of calls, tokens and estimated cost, sorted by cost then tokens; optional `days` window).
- Settings page: "Usage" section in the Account area showing the caller's own totals; "Usage leaderboard" in the admin area.

## Capabilities

### New Capabilities
- `model-usage-tracking`: per-call token usage capture from providers, cost estimation from configured pricing, the `model_usage` ledger, attribution rules, and the usage APIs.

### Modified Capabilities
- `database-schema`: adds the `model_usage` table.
- `config-loading`: model entries accept an optional `pricing` block.
- `settings-page`: adds the personal Usage section and the admin Usage leaderboard.

## Impact

- Backend: `db/schema.ts` + migration `0038_model_usage`; `services/model_providers/{types,codex_provider,openai_provider}.ts`; `services/model_invoke.ts`; new `services/model_usage.ts`; Q&A (`api/qa.ts`, `services/qa_service.ts`), research (`services/research_runtime.ts`), translation (`services/translation_service.ts`, `api/translation.ts`); new `api/usage.ts`; `config.ts`.
- Shared: `ModelConfig.pricing`, usage response types.
- Frontend: `components/settings/` usage section + leaderboard, `views/Settings.vue`, API client.
- Config: `config.example.yml` documents `pricing`.
- Docs: `docs/tech-stack.md`, `docs/frontend-architecture.md`, `docs/external-api.md` (no External API change; note only if relevant).
- Schema change is additive (new table), so archiving bumps PATCH.

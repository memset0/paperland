## 1. Schema and config

- [x] 1.1 Add `modelUsage` table to `db/schema.ts` and generate migration `0038_model_usage` (additive)
- [x] 1.2 Add optional `pricing` (`input`, `cached_input?`, `output`, non-negative numbers) to the model schema in `config.ts` and `ModelConfig` in shared types; document it in `config.example.yml`

## 2. Provider usage capture

- [x] 2.1 Add `ModelUsage` type and `onUsage` to `ModelInvokeOptions`
- [x] 2.2 Codex app-server: track the last `thread/tokenUsage/updated` total and report it once at the end of the invocation (also on failure/cancel)
- [x] 2.3 OpenAI provider: report `usage` from JSON responses; streaming sends `stream_options.include_usage` and reports the final-chunk usage
- [x] 2.4 Provider unit tests for both paths (no network)

## 3. Ledger and attribution

- [x] 3.1 `services/model_usage.ts`: `estimateCost`, `recordModelUsage` (never throws), aggregation queries
- [x] 3.2 Q&A: record usage per Result run with `requested_by_user_id`
- [x] 3.3 Deep Research: record usage for round and repair calls with the session owner
- [x] 3.4 Translation: `translateText` takes `userId`; record usage after the upsert with the translation id; API routes pass the user
- [x] 3.5 Tests: cost formula, Q&A/research/translation attribution, failure-safe recording

## 4. API and UI

- [x] 4.1 `api/usage.ts`: `GET /api/usage/me`, `GET /api/usage/leaderboard` (admin), `days` filter; register route; shared response types; tests
- [x] 4.2 Frontend API client + `components/settings/UsageSection.vue` (Account area) + `components/settings/UsageLeaderboard.vue` (admin area) in `views/Settings.vue`

## 5. Docs and verification

- [x] 5.1 Update `docs/tech-stack.md`, `docs/frontend-architecture.md`, `docs/external-api.md` (if relevant)
- [x] 5.2 Run affected backend tests, `vue-tsc`, and a verification build; verify a real Codex Q&A run writes a usage row

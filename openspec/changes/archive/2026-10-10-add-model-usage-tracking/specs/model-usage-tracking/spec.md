## ADDED Requirements

### Requirement: Providers report token usage per invocation
Model providers SHALL report the token usage of each invocation through an optional `onUsage` callback with input tokens (including cached), cached input tokens, output tokens (including reasoning), reasoning tokens and total tokens. The Codex app-server provider SHALL report the `total` breakdown of the last `thread/tokenUsage/updated` notification of the turn, which covers every model request in the turn including tool-call iterations. The OpenAI-compatible provider SHALL report the response `usage` (`prompt_tokens`, `prompt_tokens_details.cached_tokens`, `completion_tokens`, `completion_tokens_details.reasoning_tokens`, `total_tokens`); streaming requests SHALL send `stream_options: { include_usage: true }` and read `usage` from the final chunk. Codex exec mode SHALL report no usage. A provider SHALL report usage it already received even when the invocation then fails or is cancelled.

#### Scenario: Codex turn with cached context
- **WHEN** a Codex app-server turn emits several `thread/tokenUsage/updated` notifications and the last one has `total.inputTokens = 29997`, `total.cachedInputTokens = 25088`, `total.outputTokens = 112`
- **THEN** the provider SHALL report input 29997, cached input 25088, output 112

#### Scenario: OpenAI streaming usage
- **WHEN** a streaming Chat Completions call ends with a chunk carrying `usage`
- **THEN** the provider SHALL report that usage once

#### Scenario: No usage available
- **WHEN** a provider receives no usage (exec mode, or an endpoint that omits `usage`)
- **THEN** `onUsage` SHALL NOT be called and no usage row SHALL be written

### Requirement: Usage ledger
Every reported invocation usage SHALL be stored as one row of `model_usage` with `category` (`qa`, `research` or `translation`), the attributed `user_id` (nullable), the model name, the token counts, the estimated `cost_usd` (nullable) and `created_at`, plus exactly the source foreign key matching the category: `qa_result_id` for `qa`, `research_step_id` for `research`, `translation_id` for `translation`. Token usage and cost SHALL NOT be stored on `qa_results`, `research_steps` or `translations`. Calls made before this change SHALL NOT be backfilled. Writing a usage row SHALL never fail the model run.

#### Scenario: Q&A run recorded
- **WHEN** a Q&A Result run finishes on a Codex app-server model that reported usage
- **THEN** one `model_usage` row SHALL exist with `category = qa`, `qa_result_id` of that Result and `user_id` = the Result's `requested_by_user_id`

#### Scenario: Research round with repair
- **WHEN** a Deep Research agent step needs a format repair call
- **THEN** two `model_usage` rows SHALL exist for that step, both with `category = research`, its `research_step_id`, and `user_id` = the session owner

#### Scenario: Translation cache miss
- **WHEN** a signed-in user's translation request misses the cache and calls the model
- **THEN** one `model_usage` row SHALL exist with `category = translation`, the stored translation's `translation_id` and that user's id; a cache hit SHALL record nothing

#### Scenario: Failed run still recorded
- **WHEN** a Codex turn reports usage and then fails
- **THEN** the usage row SHALL still be written

### Requirement: Cost estimate from configured pricing
The estimated cost SHALL be computed from the model's configured `pricing` (USD per million tokens) as `(input − cached_input) × pricing.input + cached_input × pricing.cached_input + output × pricing.output`, divided by 1,000,000; when `pricing.cached_input` is absent, cached input SHALL be priced at `pricing.input`. Reasoning tokens SHALL NOT be charged separately (they are part of output). When the model has no `pricing`, `cost_usd` SHALL be null while the token counts are still stored. The cost SHALL be fixed at write time.

#### Scenario: Cost with cache hits
- **WHEN** a model with pricing input 1.25, cached_input 0.125, output 10 reports input 30000, cached 25000, output 100
- **THEN** `cost_usd` SHALL be (5000 × 1.25 + 25000 × 0.125 + 100 × 10) / 1e6 = 0.010375

#### Scenario: Model without pricing
- **WHEN** a model without `pricing` reports usage
- **THEN** the row SHALL store the tokens and `cost_usd = null`

### Requirement: Usage APIs
`GET /api/usage/me` SHALL return the signed-in user's totals (calls, input, cached input, output, total tokens, estimated cost) overall and per category. `GET /api/usage/leaderboard` SHALL be admin-only and return one entry per user with usage (id, username, nickname, calls, tokens, estimated cost), sorted by estimated cost descending then total tokens descending; rows without a user SHALL be grouped as one unattributed entry. Both endpoints SHALL accept an optional `days` query parameter limiting the window to the last N days; without it they cover all time. Costs SHALL sum only non-null `cost_usd` values.

#### Scenario: Regular user reads own usage
- **WHEN** a `user`-role account calls `GET /api/usage/me`
- **THEN** it SHALL receive only its own totals

#### Scenario: Leaderboard is admin-only
- **WHEN** a `user`-role account calls `GET /api/usage/leaderboard`
- **THEN** the response SHALL be 403

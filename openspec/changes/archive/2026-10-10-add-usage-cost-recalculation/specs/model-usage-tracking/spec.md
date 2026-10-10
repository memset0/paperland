## MODIFIED Requirements

### Requirement: Cost estimate from configured pricing
The estimated cost SHALL be computed from the model's configured `pricing` (USD per million tokens) as `(input − cached_input) × pricing.input + cached_input × pricing.cached_input + output × pricing.output`, divided by 1,000,000; when `pricing.cached_input` is absent, cached input SHALL be priced at `pricing.input`. Reasoning tokens SHALL NOT be charged separately (they are part of output). When the model has no `pricing`, `cost_usd` SHALL be null while the token counts are still stored. The cost SHALL be fixed at write time unless an admin recalculates it (see "Admin cost recalculation").

#### Scenario: Cost with cache hits
- **WHEN** a model with pricing input 1.25, cached_input 0.125, output 10 reports input 30000, cached 25000, output 100
- **THEN** `cost_usd` SHALL be (5000 × 1.25 + 25000 × 0.125 + 100 × 10) / 1e6 = 0.010375

#### Scenario: Model without pricing
- **WHEN** a model without `pricing` reports usage
- **THEN** the row SHALL store the tokens and `cost_usd = null`

## ADDED Requirements
### Requirement: Admin cost recalculation
`POST /api/usage/recalculate` SHALL be admin-only (others get 403, anonymous 401) and accept an optional JSON body `{ from?, to? }` with dates `YYYY-MM-DD` (inclusive, UTC days, compared against `created_at`); an omitted bound is open, and an invalid date or `from` after `to` SHALL be rejected with 400. For every `model_usage` row in the range whose `model_name` currently has `pricing` in `config.yml`, `cost_usd` SHALL be recomputed from the stored token counts with the formula of "Cost estimate from configured pricing". Rows whose model is not configured or has no pricing SHALL be left unchanged. The response SHALL be `{ updated, skipped, skipped_models }` (counts and the distinct skipped model names). The Settings page's admin area SHALL offer this as a "Recalculate costs" card with From / To date inputs (blank = unbounded) and a button that asks for confirmation and then shows the result.

#### Scenario: Rows recorded before pricing get costs
- **WHEN** rows of model M have `cost_usd = null` and M now has pricing, and an admin recalculates without a range
- **THEN** those rows SHALL get the cost computed from their tokens and the response SHALL count them as updated

#### Scenario: Range limits the rows
- **WHEN** an admin recalculates with `from = to = 2026-10-10`
- **THEN** only rows created on 2026-10-10 (UTC) SHALL change

#### Scenario: Unconfigured model is skipped
- **WHEN** a row's model is no longer in `config.yml`
- **THEN** its `cost_usd` SHALL stay as it was and its model name SHALL appear in `skipped_models`

#### Scenario: Non-admin cannot recalculate
- **WHEN** a `user`-role account calls `POST /api/usage/recalculate`
- **THEN** the response SHALL be 403 and no row SHALL change

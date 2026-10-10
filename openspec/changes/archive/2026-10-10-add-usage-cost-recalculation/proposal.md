## Why

Estimated costs are fixed when a usage row is written, so rows recorded before a model had `pricing` (the first verification runs) have no cost, and later price changes in `config.yml` never reach old rows. Costs should be recomputable from the stored token counts.

## What Changes

- New admin-only `POST /api/usage/recalculate` with an optional date range (`from`, `to` as `YYYY-MM-DD`, inclusive, UTC; either may be omitted for an open end). Every `model_usage` row in the range gets `cost_usd` recomputed from its stored tokens and the **current** `pricing` of its `model_name` in `config.yml`. Rows whose model is no longer configured or has no pricing are left unchanged and reported as skipped (with the model names). Response: `{ updated, skipped, skipped_models }`.
- Settings page, admin area: a "Recalculate costs" card with From / To date inputs (blank = unbounded) and a button (with confirmation) that shows the result.
- One-off: after deploy, run the recalculation over all existing rows so the four rows recorded before pricing was configured get costs.
- The "cost is fixed at write time" rule becomes "fixed at write time unless an admin recalculates".

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `model-usage-tracking`: cost estimates can be recalculated by an admin for a date range; the Settings admin area hosts the control.

## Impact

- Backend: `services/model_usage.ts` (`recalculateCosts`), `api/usage.ts` (route), tests.
- Shared: request/response types.
- Frontend: new `components/settings/UsageRecalculate.vue`, one line in `views/Settings.vue` admin area, API client.
- Docs: `docs/tech-stack.md`, `docs/frontend-architecture.md`.
- Coordination: `add-home-dashboard` (active, another agent) moves the usage UI from Settings to Home and edits `api/usage.ts` / `Settings.vue`; this change only adds a route and an admin card and does not touch the requirements that change modifies.

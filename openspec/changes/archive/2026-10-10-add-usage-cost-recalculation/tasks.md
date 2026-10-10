## 1. Implementation

- [x] 1.1 `recalculateCosts({ from, to })` in `services/model_usage.ts` (per-model SQL update in a transaction, skip unpriced models)
- [x] 1.2 `POST /api/usage/recalculate` (admin, date validation) + shared types
- [x] 1.3 Tests: null costs filled, range limits, skipped models, 403/400
- [x] 1.4 `components/settings/UsageRecalculate.vue` in the Settings admin area; API client
- [x] 1.5 Docs; vue-tsc; deploy and recalculate all existing rows

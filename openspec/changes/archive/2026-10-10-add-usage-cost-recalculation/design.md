## Decisions

- **Current config is the source of truth.** Recalculation reads `models.available[].pricing` at request time (the loaded config; editing `config.yml` needs a restart, as for every config value).
- **Skip, don't null, unknown models.** A model renamed or removed from config (e.g. `codex-gpt-5.6-sol-max` → `codex-gpt-6.1-sol-max`) would otherwise lose its historical cost; such rows are left as they are and reported.
- **UTC day bounds** on `created_at` (ISO strings): `from` → `>= fromT00:00:00.000Z`, `to` → `< (to+1 day)T00:00:00.000Z`. The UI labels the range as UTC.
- **One SQL update per model** inside a transaction: `UPDATE model_usage SET cost_usd = ((input - min(cached,input)) * in + min(cached,input) * cached + output * out) / 1e6 WHERE model_name = ? AND <range>`; counts via `changes`. Keeps it fast for large ledgers and identical to `estimateCost`.
- **UI** is a separate component so it does not collide with the concurrent `add-home-dashboard` rework of the Settings usage sections.

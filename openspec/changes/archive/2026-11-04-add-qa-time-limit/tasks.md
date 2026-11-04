## 1. Implementation

- [x] 1.1 Add optional `time_limit` (seconds) to the service config schema in `config.ts`; add `time_limit: 7200` under `services.qa` in `config.example.yml` and `config.yml`
- [x] 1.2 Enforce the limit in `runQA`: timer from run start, combined abort signal, race that finalizes the result as failed with the limit error (partial answer kept, execution failed, slot released), not reported as cancelled
- [x] 1.3 Offline tests: hanging `askFn` times out (result failed, partial answer kept, execution failed); `askFn` that ignores abort still finalizes; fast run unaffected; user cancel still `cancelled`
- [x] 1.4 Update `docs/tech-stack.md`, `docs/external-api.md` and `docs/frontend-architecture.md` where Q&A runtime/config is described
- [x] 1.5 Raise the Codex models' `timeout` from 1800 to 7200 in `config.yml`, and in the `config.example.yml` / `docs/tech-stack.md` examples

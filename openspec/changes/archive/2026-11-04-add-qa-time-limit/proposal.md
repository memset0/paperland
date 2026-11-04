## Why

Q&A answers can run unbounded: results 1566 and 1568 stayed `streaming` for about 19 hours on 2026-10-15 until a server restart marked them failed, even though their Codex model has `timeout: 1800`. The provider's own timeout never finalized them (no Q&A result has ever failed with "timed out"), and while they hung they also held two of the `qa` service's concurrency slots. The user wants a 2-hour limit on Q&A answers.

## What Changes

- Every Q&A answer run gets a wall-clock time limit, `services.qa.time_limit` in seconds, default 7200 (2 hours). It counts from when the run starts (status `awaiting_output`); time spent queued doesn't count.
- When the limit is reached the run is aborted (the model call receives an abort signal, so Codex is interrupted and killed), and the result is finalized immediately without waiting for the provider to shut down. The result becomes `failed` with the error "Answer exceeded the 2h time limit" (formatted from the configured value), any streamed partial answer is kept, the service execution is marked failed, and its concurrency slot is released.
- The time limit is not reported as "cancelled by user", and user cancellation keeps its current behavior.
- `config.example.yml`, `config.yml` and the docs gain the new key.
- At the user's request (1800s is too short; some answers legitimately need up to 2h), the Codex models' per-call `timeout` in `config.yml` goes from 1800 to 7200, and the example config/docs suggest 7200. This also gives Deep Research rounds on those models a 2h per-call timeout.

## Capabilities

### New Capabilities

### Modified Capabilities
- `qa-runtime`: adds the answer time limit requirement.

## Impact

- `packages/backend/src/config.ts` (service schema gains `time_limit`), `packages/backend/src/api/qa.ts` (`runQA` enforces the limit), tests in `packages/backend/src/api/qa*.test.ts`.
- `config.example.yml`, `config.yml` (gitignored, local), `docs/tech-stack.md`, `docs/external-api.md` (if the Q&A status docs mention errors), `docs/frontend-architecture.md` (no UI change; the failed state already shows the error).
- No schema migration.

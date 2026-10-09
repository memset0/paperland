## Why

The doc2x integration assumed the Doc2X account allows 5 concurrent tasks. The 2026-10-09 backfill of old papers showed otherwise. At 5 concurrent parses, 10 of the first 16 executions failed at the parse stage with `task_request_failed`. With 2 concurrent parses, one still failed. The same PDFs all succeeded when parsed one at a time, and the failed tasks were not charged pages. The account effectively allows a single running doc2x task.

## What Changes

- The default site configuration (`config.example.yml`) sets `max_concurrency: 1` for both `doc2x_parse` and `doc2x_translate`. They stay in the shared `doc2x` concurrency group, so at most one doc2x task runs at a time across parse and translate; the rest queue.
- The docs (`docs/tech-stack.md`, `docs/frontend-architecture.md`) state the verified limit of 1 instead of the assumed 5.
- Fix stale comments in `config.example.yml` that still described auto-translate on import. The shipped behavior: new papers are auto-parsed, and translation is on demand only.
- The service-runner spec scenario for the doc2x shared group uses the limit 1.

## Capabilities

### New Capabilities

### Modified Capabilities
- `service-runner`: the doc2x shared-concurrency-group scenario now uses a combined limit of 1.

## Impact

- `config.example.yml`, the docs, and the `config.test.ts` fixture value. No runtime code changes, because concurrency is configured in `config.yml`; the local gitignored `config.yml` was already switched to 1.
- Doc2X throughput is serialized. A paper takes about 45–60 s, so a batch of N papers takes N times as long.

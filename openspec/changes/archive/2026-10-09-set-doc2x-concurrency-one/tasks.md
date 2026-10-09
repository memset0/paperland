## 1. Configuration

- [x] 1.1 Set `max_concurrency: 1` for `doc2x_parse` and `doc2x_translate` in `config.example.yml`, and make the doc2x comments describe auto-parse plus on-demand translation. Verify by grepping the file and by running `config.test.ts`, whose concurrency-group fixture also uses 1.

## 2. Docs

- [x] 2.1 Update `docs/tech-stack.md` and `docs/frontend-architecture.md` to the verified limit of 1, and verify by grep that neither still says 5 for doc2x. `docs/external-api.md` has no concurrency content, so it needs no change.

## 3. Validation

- [x] 3.1 Run `openspec validate set-doc2x-concurrency-one --strict` and `service_runner.test.ts`, and verify both pass.

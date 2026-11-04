## Context

`runQA` (`api/qa.ts`) runs each answer through `serviceRunner.executePureService('qa', …)`, which holds a `qa` semaphore slot until the callback settles. The Codex provider has its own `timeout` (1800s in config), but on timeout it rejects inside a `try/finally` whose cleanup awaits the process exit and the stderr reader. If a grandchild process keeps stderr open, that cleanup never finishes, so the rejection never propagates. Results 1566 and 1568 hung this way for about 19 hours.

## Decisions

- **Enforce the limit in `runQA`, provider-independent.** `askFn` is raced against a timer. The call gets `AbortSignal.any([userSignal, limitSignal])`. When the timer fires, the race rejects with a `QATimeLimitError` first and then the limit controller aborts, so the provider still gets a chance to interrupt and kill Codex. The abandoned `askFn` promise gets a no-op `.catch`. The callback then settles, so `executePureService` marks the execution failed and releases the slot even if the provider never returns.
- **Count from run start.** The timer starts at the `awaiting_output` transition, after the semaphore and rate limiter, so queue time is excluded.
- **Config.** Use `services.qa.time_limit` (seconds), next to the `qa` service's concurrency settings. It is an optional field on the shared service schema, read as `?? 7200`.
- **Error text.** "Answer exceeded the <N> time limit". N is shown as hours when it divides evenly ("2h"), otherwise as minutes or seconds. The error is a backend message, not a UI string, but it is shown in the UI, so it is in English.
- **Not fixing the Codex cleanup hang here.** That is a separate provider bug, and Deep Research has a related risk. This change only adds the Q&A cap the user asked for.

- **Model timeout raised to 7200.** With the old 1800s per-call timeout, the 2h Q&A limit would never be reached by a healthy run. The model `timeout` stays as the provider's own guard; `services.qa.time_limit` is the hard cap that always finalizes.

## Risks

- After a timeout the abandoned provider promise may keep a Codex process alive until its own kill succeeds. `proc.kill()` is still called through the abort path, which is acceptable.

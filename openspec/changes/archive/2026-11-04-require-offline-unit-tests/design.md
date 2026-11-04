## Context

See proposal.md. Relevant service/provider tests already replace fetch, inject model functions or use fake executables. AGENTS.md and OpenSpec task guidance currently warn about costs rather than prohibit live calls in repeated unit tests.

## Goals / Non-Goals

Goals: make offline execution mandatory for recurring unit/regression tests across all providers, including luna.
Non-goals: add integration calls, run unreviewed suites or change application behavior.

## Decisions

Replace the cost-only warning with explicit fixture/mock/injection requirements. Keep real external-service checks separate and opt-in with user authorization, excluded from default unit/CI commands. Preserve the existing local service tests; inspection found their existing test doubles, so no test implementation change is needed for this documentation update.

## Risks / Trade-offs

Instruction-only policy is not a network sandbox → review test entry points and dependencies before execution; fix tests that would use live services instead of treating a cheap model as an exception.

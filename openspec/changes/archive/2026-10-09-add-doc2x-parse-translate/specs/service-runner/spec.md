## ADDED Requirements

### Requirement: Shared concurrency groups
A service configuration MAY set `concurrency_group`. All services with the same group SHALL share a single concurrency semaphore whose limit is the group members' `max_concurrency`, so the total number of running executions across the group never exceeds that limit. Services without a group keep their own semaphore.

#### Scenario: Doc2X services share a limit
- **WHEN** `doc2x_parse` and `doc2x_translate` both use `concurrency_group: doc2x` with `max_concurrency: 5` and 5 doc2x executions are running in total
- **THEN** any further `doc2x_parse` or `doc2x_translate` execution SHALL wait until one finishes

## ADDED Requirements

### Requirement: Service eligibility gate
A paper-bound service MAY declare an eligibility predicate over the paper. During automatic scheduling (initial trigger and the post-completion re-check), a service whose predicate returns false for the paper SHALL be skipped silently: no execution, no `blocked` or `deferred` record. Explicit per-service execution requests SHALL bypass the predicate.

#### Scenario: Ineligible service skipped
- **WHEN** services are triggered for a paper for which `doc2x_translate`'s predicate is false
- **THEN** `doc2x_translate` SHALL not run and no execution record SHALL be written for it

#### Scenario: Eligible after request
- **WHEN** a translation request makes the predicate true and `doc2x_parse` later completes
- **THEN** the post-completion re-check SHALL start `doc2x_translate`

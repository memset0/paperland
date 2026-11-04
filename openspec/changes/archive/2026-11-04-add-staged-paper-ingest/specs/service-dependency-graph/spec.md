## ADDED Requirements

### Requirement: Listed-gated service execution
A paper-bound service MAY declare `requires_listed: true`. A `requires_listed` service SHALL execute only when its paper has `listed=true`; for a `listed=false` paper such a service SHALL be deferred (a `deferred` state meaning "waiting until the paper is added to the library") rather than run, failed, or blocked. Services without `requires_listed` (e.g. `semantic_scholar_service`) SHALL run regardless of `listed`. This gate is applied in addition to the existing `depends_on` resolution; when `listed=true` it is a no-op, so existing scheduling behavior is unchanged.

#### Scenario: Heavy services deferred for metadata-only paper
- **WHEN** services are scheduled for a `listed=false` paper
- **THEN** `requires_listed` services (arxiv metadata, arxiv PDF, PDF parse, papers.cool) SHALL be marked `deferred` and SHALL NOT execute, while `semantic_scholar_service` SHALL run

#### Scenario: Listed paper schedules normally
- **WHEN** services are scheduled for a `listed=true` paper
- **THEN** the gate SHALL have no effect and scheduling SHALL proceed exactly as before (depends_on/produces only)

### Requirement: Full pipeline on promotion to listed
When a paper transitions from `listed=false` to `listed=true`, the system SHALL re-run `triggerForPaper` so the previously deferred services execute. Services whose `produces` keys already exist SHALL be skipped (no duplicate work).

#### Scenario: Deferred services run after promotion
- **WHEN** a metadata-only paper is promoted to `listed=true`
- **THEN** the deferred `requires_listed` services SHALL be triggered

#### Scenario: Already-complete work not repeated
- **WHEN** the pipeline re-runs after promotion and Semantic Scholar enrichment already exists
- **THEN** `semantic_scholar_service` SHALL be skipped as already complete

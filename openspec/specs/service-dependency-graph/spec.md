# service-dependency-graph Specification

## Purpose
TBD - created by archiving change service-framework. Update Purpose after archive.

## Requirements

### Requirement: Paper-bound service declaration
Each paper-bound service SHALL declare depends_on (array of paper field keys required) and produces (array of paper field keys it writes).

#### Scenario: Service with dependencies
- **WHEN** arxiv_service is registered with depends_on=["arxiv_id"] and produces=["pdf_path"]
- **THEN** the ServiceRunner SHALL know that arxiv_service requires arxiv_id and produces pdf_path

### Requirement: Skip already-complete services
When triggering services for a paper, if all produces keys already have non-null values on the paper, the service SHALL be skipped and marked done.

#### Scenario: All outputs exist
- **WHEN** services are triggered for a paper that already has pdf_path set, and arxiv_service produces=["pdf_path"]
- **THEN** arxiv_service SHALL be skipped for this paper

### Requirement: Auto-trigger upstream dependencies
When a service's depends_on key is missing and another service produces it, the upstream service SHALL be automatically triggered first.

#### Scenario: Recursive dependency trigger
- **WHEN** pdf_parse_service (depends_on=["pdf_path"]) is triggered but pdf_path is null
- **THEN** the runner SHALL find arxiv_service (produces=["pdf_path"]) and trigger it first
- **THEN** after arxiv_service completes, pdf_parse_service SHALL run

### Requirement: Blocked status for unresolvable dependencies
When a service's depends_on key cannot be produced by any registered service, the execution SHALL be marked as blocked.

#### Scenario: No producer available
- **WHEN** arxiv_service depends_on=["arxiv_id"] but the paper has no arxiv_id and no service produces it
- **THEN** arxiv_service SHALL be marked as blocked

### Requirement: Wait for in-progress dependencies
When a depends_on key is being produced by a currently running/pending service, the dependent service SHALL wait for it to complete.

#### Scenario: Wait for upstream
- **WHEN** semantic_scholar_service is running and will produce arxiv_id
- **THEN** arxiv_service SHALL enter waiting status until semantic_scholar_service completes

### Requirement: Basic fields auto-fill
Paper-bound services that fetch metadata SHALL automatically fill title, abstract, and authors if those fields are empty on the paper. These fields are NOT part of the dependency graph.

#### Scenario: Auto-fill title
- **WHEN** a fetch service retrieves paper metadata and the paper's title is "Untitled"
- **THEN** the service SHALL update the paper's title with the fetched value

### Requirement: Service eligibility gate
A paper-bound service MAY declare an eligibility predicate over the paper. During automatic scheduling (initial trigger and the post-completion re-check), a service whose predicate returns false for the paper SHALL be skipped silently: no execution, no `blocked` or `deferred` record. Explicit per-service execution requests SHALL bypass the predicate.

#### Scenario: Ineligible service skipped
- **WHEN** services are triggered for a paper for which `doc2x_translate`'s predicate is false
- **THEN** `doc2x_translate` SHALL not run and no execution record SHALL be written for it

#### Scenario: Eligible after request
- **WHEN** a translation request makes the predicate true and `doc2x_parse` later completes
- **THEN** the post-completion re-check SHALL start `doc2x_translate`

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

## ADDED Requirements

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

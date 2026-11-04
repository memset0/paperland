## ADDED Requirements

### Requirement: Global listed flag on papers
A paper SHALL have a global `listed` boolean (default `true`). `listed=true` means the paper is shown in the library and runs the full fetch pipeline; `listed=false` means the paper is a metadata-only record (hidden from listings, populated only from Semantic Scholar). Visibility is global — a paper is either visible to all users or to none.

#### Scenario: New papers default to listed
- **WHEN** a paper is created through the normal add flow
- **THEN** it SHALL have `listed=true`

#### Scenario: Metadata-only paper is unlisted
- **WHEN** a paper is ingested as metadata-only (`listed=false` passed explicitly)
- **THEN** it SHALL have `listed=false`

### Requirement: Paper list supports listed / unlisted / all view modes
The web paper list (`GET /api/papers`) SHALL accept a `listed` filter with three modes — `listed` (default), `unlisted`, and `all` — controlling whether only listed papers, only metadata-only papers, or both are returned. When the parameter is omitted, only `listed=true` papers SHALL be returned.

#### Scenario: Default mode shows only listed
- **WHEN** the paper list is requested without a `listed` parameter
- **THEN** only `listed=true` papers SHALL be returned

#### Scenario: Unlisted mode shows only metadata-only
- **WHEN** the paper list is requested with the unlisted mode
- **THEN** only `listed=false` (metadata-only) papers SHALL be returned

#### Scenario: All mode shows both
- **WHEN** the paper list is requested with the all mode
- **THEN** both listed and metadata-only papers SHALL be returned

### Requirement: Metadata-only rows are non-navigable with an inline fetch action
In the paper list, a metadata-only (`listed=false`) row SHALL NOT be clickable to open the paper detail page. Instead it SHALL offer an inline "fetch" (抓取) action that promotes the paper (sets `listed=true` and runs the full pipeline); after fetching, the row SHALL become navigable to the detail page.

#### Scenario: Metadata-only row not navigable
- **WHEN** a `listed=false` row is shown in the list and the user attempts to open it
- **THEN** the detail page SHALL NOT open; the row offers a fetch action instead

#### Scenario: Fetch promotes and enables navigation
- **WHEN** the user activates the fetch action on a metadata-only row
- **THEN** the paper SHALL be promoted (`listed=true`, full pipeline triggered) and thereafter be navigable to its detail page

### Requirement: Programmatic listings exclude metadata-only papers
The External API `GET /papers` (and `/papers/full`, `/papers/batch` listings) and the idea-forge paper-dump candidate selection SHALL return only `listed=true` papers, with no mode toggle.

#### Scenario: External API list excludes metadata-only papers
- **WHEN** an External API client lists papers
- **THEN** metadata-only (`listed=false`) papers SHALL NOT be returned

### Requirement: Metadata-only papers remain reachable
Metadata-only papers SHALL keep a real `id` and be reachable directly (`GET /api/papers/:id`). Deduplication SHALL still match them by `arxiv_id`/`corpus_id`.

#### Scenario: Direct access to a metadata-only paper
- **WHEN** `GET /api/papers/:id` targets a `listed=false` paper
- **THEN** the paper SHALL be returned (it is hidden from lists, not from direct access)

#### Scenario: Dedup merges into an existing metadata-only paper
- **WHEN** a new ingest resolves to an `arxiv_id`/`corpus_id` that already exists as a metadata-only paper
- **THEN** the existing row SHALL be reused (no duplicate), preserving its `id`

### Requirement: Promote a paper to the library
The system SHALL provide a way to promote a metadata-only paper to the library by setting `listed=true`. Promotion SHALL trigger the full fetch pipeline for that paper.

#### Scenario: Promote runs the full pipeline
- **WHEN** a `listed=false` paper is promoted to `listed=true`
- **THEN** the previously deferred services (arxiv metadata, arxiv PDF, PDF parse, papers.cool) SHALL be triggered, while already-completed work (e.g. Semantic Scholar enrichment) SHALL NOT be repeated

#### Scenario: Promoted paper appears in the library
- **WHEN** a metadata-only paper is promoted
- **THEN** it SHALL thereafter appear in the paper list

### Requirement: Metadata-only papers fetch only Semantic Scholar
While a paper is `listed=false`, the system SHALL fetch its information only from Semantic Scholar (ids, citation graph, basic fields, abstract) and SHALL NOT crawl arxiv metadata, download the arxiv PDF, parse the PDF, or fetch papers.cool, until the paper is promoted.

#### Scenario: No arxiv work for metadata-only paper
- **WHEN** a metadata-only paper is ingested
- **THEN** only Semantic Scholar fetching SHALL run; arxiv metadata/PDF, PDF parse, and papers.cool SHALL be deferred

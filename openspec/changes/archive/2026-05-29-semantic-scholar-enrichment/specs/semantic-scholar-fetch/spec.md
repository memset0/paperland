## MODIFIED Requirements

### Requirement: Fetch Semantic Scholar data
The semantic_scholar_service SHALL fetch paper data from the Semantic Scholar Graph API using the paper's `arxiv_id` via the `ARXIV:{id}` path identifier, resolving citation metadata in a single request. It SHALL be a paper-bound service with `depends_on=["arxiv_id"]`. The service SHALL write back every external ID present in the response `externalIds` that the paper is missing (notably `corpus_id`); when only the original ID is available it SHALL keep it unchanged and SHALL NOT fail.

#### Scenario: Successful fetch stores both IDs and enrichment
- **WHEN** the service executes for a paper that has arxiv_id "1706.03762" and no corpus_id
- **THEN** it SHALL request `GET /graph/v1/paper/ARXIV:1706.03762` with the enrichment `fields`
- **AND** it SHALL set the resolved `corpus_id` on the paper (from `externalIds.CorpusId`)
- **AND** it SHALL store `citation_count`, `influential_citation_count`, `references`, and `tldr` in the paper's `metadata`

#### Scenario: Only the original id available
- **WHEN** the S2 response contains no additional external ID beyond the one queried
- **THEN** the service SHALL keep the paper's existing id and persist whatever enrichment fields are present, without raising an error

#### Scenario: Corpus-only paper is not enriched
- **WHEN** a paper has corpus_id but no arxiv_id
- **THEN** the service SHALL NOT run (its dependency arxiv_id is absent) and the paper SHALL keep its single id (no reverse resolution)

### Requirement: Service declaration
The Semantic Scholar integration SHALL register a single paper-bound service with `depends_on=["arxiv_id"]` and `produces=["corpus_id","citation_count","influential_citation_count","references"]`, bound to the `config.yml` services entry named `semantic_scholar_service`. These produced keys SHALL always be written on a successful fetch (citation counts default to 0, references to an empty array) so the service is not re-run; `tldr` and other optional fields are stored in metadata but NOT part of `produces` because they may be absent.

#### Scenario: Registration and config binding
- **WHEN** the server starts
- **THEN** `semantic_scholar_service` SHALL be registered with the ServiceRunner
- **AND** its `max_concurrency` and `rate_limit_interval` SHALL be taken from the `services.semantic_scholar_service` config entry (not the runner defaults)

#### Scenario: Skip when enrichment already present
- **WHEN** a paper already has corpus_id and all declared enrichment keys in metadata
- **THEN** the service SHALL be skipped and marked done (no S2 request issued)

## ADDED Requirements

### Requirement: Enrichment field set
The service SHALL persist a defined set of Semantic Scholar fields, storing whatever is available and skipping anything missing. `corpus_id` SHALL be stored on the top-level paper column; `citation_count`, `influential_citation_count`, `references` (each with `paper_id`, `title`, `year`), `tldr` (text), `venue`, `year`, `doi`, `fields_of_study`, and `s2_url` SHALL be stored in `metadata` using snake_case keys. Basic fields (title, abstract, authors) SHALL only be filled when empty and SHALL NOT overwrite values already set by arxiv_service.

#### Scenario: Store available enrichment in metadata
- **WHEN** the S2 response contains citationCount, influentialCitationCount, tldr, references, venue, year, and externalIds.DOI
- **THEN** the service SHALL write `citation_count`, `influential_citation_count`, `tldr`, `references`, `venue`, `year`, and `doi` into the paper's metadata

#### Scenario: Do not overwrite existing basic fields
- **WHEN** the paper already has a non-empty title set by arxiv_service and S2 returns a different title
- **THEN** the service SHALL NOT change the paper's title

### Requirement: API key and rate-limit compliance
The service SHALL send the configured Semantic Scholar API key via the `x-api-key` HTTP header when one is configured (`api_key` literal or `api_key_env` environment variable), and SHALL apply exponential backoff with jitter on HTTP 429 and 5xx responses as required by Semantic Scholar. The service SHALL respect the configured `max_concurrency` and `rate_limit_interval`.

#### Scenario: Send API key header
- **WHEN** `services.semantic_scholar_service.api_key` (or `api_key_env`) is configured
- **THEN** every S2 request SHALL include the `x-api-key` header with that value

#### Scenario: Backoff on rate limit
- **WHEN** an S2 request returns HTTP 429
- **THEN** the service SHALL wait with exponentially increasing delay (honoring `Retry-After` if present) and retry, rather than failing immediately

#### Scenario: Degrade without a key
- **WHEN** no API key is configured
- **THEN** the service SHALL still issue requests anonymously and rely on backoff plus the configured (larger) interval to absorb throttling

### Requirement: corpus_id uniqueness safety
When the resolved `corpus_id` is already held by a different paper row, the service SHALL NOT fail the whole execution; it SHALL skip writing `corpus_id` and still persist the remaining enrichment fields.

#### Scenario: corpus_id collision
- **WHEN** S2 resolves a corpus_id that already belongs to another paper
- **THEN** the service SHALL leave that paper's corpus_id unchanged, still store citation metadata in metadata, and complete without raising an unhandled unique-constraint error

### Requirement: Backfill existing papers
The system SHALL provide a one-time backfill that runs the semantic_scholar_service for existing papers that have an `arxiv_id` but are missing Semantic Scholar enrichment (no `citation_count` in metadata), saving the resolved corpus_id and enrichment to the database. Backfill SHALL go through the ServiceRunner so it respects the configured rate limit and surfaces progress in `service_executions`.

#### Scenario: Backfill resolves missing S2 data
- **WHEN** backfill is triggered
- **THEN** for each paper with arxiv_id and no citation_count in metadata, the service SHALL fetch S2 and persist the corpus_id and enrichment

#### Scenario: Backfill skips already-enriched papers
- **WHEN** a paper already has citation_count in its metadata
- **THEN** backfill SHALL NOT issue an S2 request for it

#### Scenario: Backfill respects the rate limit
- **WHEN** many papers are eligible for backfill
- **THEN** the requests SHALL be serialized through the service's rate limiter so the configured rate is not exceeded

### Requirement: Capture citation graph
The service SHALL capture the paper's Semantic Scholar citation graph into a `paper_citations` table: both `references` (papers this paper cites) and `citations` (papers that cite this paper). For each edge it SHALL store the related paper's title, authors, year, venue, external IDs (arxiv_id / doi / corpus_id) and S2 url, plus the citation `contexts`, `intents`, and an `is_influential` flag. It SHALL fetch one page per direction via the dedicated `/references` and `/citations` endpoints, and ALL S2 requests (single-paper lookup + edge endpoints) SHALL share one rate limiter so the configured rate is not exceeded. Citation-graph fetching SHALL be best-effort. A read endpoint `GET /api/papers/:id/citations` SHALL return the stored references and citations.

#### Scenario: References and citations stored with contexts
- **WHEN** the service runs for a paper with arxiv_id
- **THEN** it SHALL store the paper's references and citations in paper_citations, each with title, authors, link, contexts, intents, and is_influential

#### Scenario: One page per direction
- **WHEN** a paper has more citations than a single API page
- **THEN** the service SHALL store the first page returned and SHALL NOT paginate further (the true total remains available as citation_count)

#### Scenario: Best-effort capture
- **WHEN** the references or citations request fails
- **THEN** the failure SHALL be logged and the paper's main enrichment (corpus_id, citation_count, …) SHALL still be saved

#### Scenario: Re-run replaces edges
- **WHEN** the service runs again for the same paper
- **THEN** the previously stored edges for each direction SHALL be replaced, with no duplicates

#### Scenario: Cascade on delete
- **WHEN** a paper is deleted
- **THEN** its paper_citations rows SHALL be deleted as well

### Requirement: Surface Semantic Scholar data in paper detail
The paper detail view SHALL display `citation_count`, `influential_citation_count`, and `tldr` when present in the paper's metadata.

#### Scenario: Display citation metrics and tldr
- **WHEN** a paper's metadata contains citation_count and tldr
- **THEN** the paper detail view SHALL show the citation count (and influential citation count) and the tldr text

#### Scenario: Hidden when absent
- **WHEN** a paper's metadata has no S2 fields
- **THEN** the paper detail view SHALL NOT render the citation/tldr section

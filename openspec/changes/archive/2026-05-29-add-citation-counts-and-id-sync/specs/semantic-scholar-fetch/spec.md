## MODIFIED Requirements

### Requirement: Fetch Semantic Scholar data
The semantic_scholar_service SHALL fetch paper data from the Semantic Scholar Graph API for any paper that has an `arxiv_id` **or** a `corpus_id`, in a single request. It SHALL query via the `ARXIV:{arxiv_id}` path identifier when an `arxiv_id` is present, otherwise via the `CORPUSID:{corpus_id}` path identifier. It SHALL be a paper-bound service that is eligible for every paper and selects its query identifier at run time (no `depends_on` gate). The service SHALL write back every external ID present in the response `externalIds` that the paper is missing — so a paper added by `arxiv_id` gains its `corpus_id`, and a paper added by `corpus_id` gains its `arxiv_id`. When only the original ID is available it SHALL keep it unchanged and SHALL NOT fail. When the paper has neither identifier the service SHALL no-op (no request, no metadata change) and complete successfully.

#### Scenario: Successful fetch from arxiv_id stores both IDs and enrichment
- **WHEN** the service executes for a paper that has arxiv_id "1706.03762" and no corpus_id
- **THEN** it SHALL request `GET /graph/v1/paper/ARXIV:1706.03762` with the enrichment `fields`
- **AND** it SHALL set the resolved `corpus_id` on the paper (from `externalIds.CorpusId`)
- **AND** it SHALL store `citation_count`, `reference_count`, `influential_citation_count`, `references`, and `tldr` in the paper's `metadata`

#### Scenario: Reverse resolution from corpus_id
- **WHEN** the service executes for a paper that has corpus_id "13756489" and no arxiv_id
- **THEN** it SHALL request `GET /graph/v1/paper/CORPUSID:13756489` with the enrichment `fields`
- **AND** it SHALL set the resolved `arxiv_id` on the paper (from `externalIds.ArXiv`) when the S2 record exposes one
- **AND** it SHALL store the same citation enrichment (`citation_count`, `reference_count`, `influential_citation_count`, `references`) in `metadata`

#### Scenario: Corpus-only paper with no arXiv version
- **WHEN** the service executes for a corpus_id paper whose S2 record has no ArXiv external id
- **THEN** the paper SHALL keep its single id (no arxiv_id is invented) and SHALL still receive full citation enrichment from the `CORPUSID:` lookup

#### Scenario: Only the original id available
- **WHEN** the S2 response contains no additional external ID beyond the one queried
- **THEN** the service SHALL keep the paper's existing id and persist whatever enrichment fields are present, without raising an error

#### Scenario: Paper with neither identifier
- **WHEN** the service is eligible for a manually-added paper that has neither arxiv_id nor corpus_id
- **THEN** the service SHALL issue no S2 request, change no fields, and complete as done

### Requirement: Service declaration
The Semantic Scholar integration SHALL register a single paper-bound service with `depends_on=[]` (it is eligible for every paper and chooses its query identifier at run time) and `produces=["corpus_id","citation_count","influential_citation_count","reference_count","references"]`, bound to the `config.yml` services entry named `semantic_scholar_service`. `arxiv_id` SHALL NOT be listed in `produces`, so that arxiv-keyed services (metadata/PDF) are chained by the runner's live-key re-trigger after a corpus-only paper's `arxiv_id` is resolved, rather than being scheduled prematurely. The produced keys SHALL always be written on a successful fetch (counts default to 0, references to an empty array) so the service is not re-run; `tldr` and other optional fields are stored in metadata but NOT part of `produces` because they may be absent.

#### Scenario: Registration and config binding
- **WHEN** the server starts
- **THEN** `semantic_scholar_service` SHALL be registered with the ServiceRunner
- **AND** its `max_concurrency` and `rate_limit_interval` SHALL be taken from the `services.semantic_scholar_service` config entry (not the runner defaults)

#### Scenario: Skip when enrichment already present
- **WHEN** a paper already has its resolved id plus all declared enrichment keys (`citation_count`, `influential_citation_count`, `reference_count`, `references`) in metadata
- **THEN** the service SHALL be skipped and marked done (no S2 request issued)

### Requirement: Enrichment field set
The service SHALL persist a defined set of Semantic Scholar fields, storing whatever is available and skipping anything missing. `corpus_id` SHALL be stored on the top-level paper column; `citation_count`, `influential_citation_count`, `reference_count`, `references` (each with `paper_id`, `title`, `year`), `tldr` (text), `venue`, `year`, `doi`, `fields_of_study`, and `s2_url` SHALL be stored in `metadata` using snake_case keys. `reference_count` SHALL be sourced from the S2 `referenceCount` field (the authoritative total), independent of the length of the stored `references` page. Basic fields (title, abstract, authors) SHALL only be filled when empty and SHALL NOT overwrite values already set by arxiv_service.

#### Scenario: Store available enrichment in metadata
- **WHEN** the S2 response contains citationCount, referenceCount, influentialCitationCount, tldr, references, venue, year, and externalIds.DOI
- **THEN** the service SHALL write `citation_count`, `reference_count`, `influential_citation_count`, `tldr`, `references`, `venue`, `year`, and `doi` into the paper's metadata

#### Scenario: reference_count reflects the true total
- **WHEN** the S2 response reports referenceCount 137 but the returned `references` page contains fewer entries
- **THEN** the service SHALL store `reference_count` = 137 in metadata (not the page length)

#### Scenario: Do not overwrite existing basic fields
- **WHEN** the paper already has a non-empty title set by arxiv_service and S2 returns a different title
- **THEN** the service SHALL NOT change the paper's title

### Requirement: Capture citation graph
The service SHALL capture the paper's Semantic Scholar citation graph into a `paper_citations` table: both `references` (papers this paper cites) and `citations` (papers that cite this paper). For each edge it SHALL store the related paper's title, authors, year, venue, external IDs (arxiv_id / doi / corpus_id) and S2 url, plus the citation `contexts`, `intents`, and an `is_influential` flag. It SHALL reach the edge endpoints using the same identifier expression used for the single-paper lookup (`ARXIV:{arxiv_id}` when available, otherwise `CORPUSID:{corpus_id}`). It SHALL fetch one page per direction via the dedicated `/references` and `/citations` endpoints, and ALL S2 requests (single-paper lookup + edge endpoints) SHALL share one rate limiter so the configured rate is not exceeded. Citation-graph fetching SHALL be best-effort. A read endpoint `GET /api/papers/:id/citations` SHALL return the stored references and citations.

#### Scenario: References and citations stored with contexts
- **WHEN** the service runs for a paper that has an arxiv_id or a corpus_id
- **THEN** it SHALL store the paper's references and citations in paper_citations, each with title, authors, link, contexts, intents, and is_influential

#### Scenario: Edge endpoints follow the resolved identifier
- **WHEN** the service enriches a corpus-only paper (no arxiv_id at fetch time)
- **THEN** it SHALL request the `/references` and `/citations` edge endpoints under the `CORPUSID:` expression

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

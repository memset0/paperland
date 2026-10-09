## Purpose

Keeps Semantic Scholar metadata for papers that are referenced (e.g. by `#cite:` links in answers or by research paper lists) but not necessarily in the library, and resolves any S2 identifier to that metadata without re-fetching from Semantic Scholar.

## ADDED Requirements

### Requirement: S2 identifier normalization
The system SHALL accept S2 paper identifiers in these forms and normalize them: a 40-character hexadecimal S2 paperId (case-insensitive, normalized to lowercase), a numeric CorpusId, `CorpusId:<n>` / `CorpusID:<n>`, and a `semanticscholar.org/paper/...` URL ending in a paperId or `CorpusID:<n>`. Any other value SHALL be reported as invalid.

#### Scenario: Normalize a mixed-case paperId
- **WHEN** an id `204E3073870FAE3D05BCBC2F6A8E263D9B72E776` is resolved
- **THEN** it SHALL be treated as paperId `204e3073870fae3d05bcbc2f6a8e263d9b72e776`

#### Scenario: Normalize a CorpusId form
- **WHEN** an id `CorpusId:13756489` or `13756489` is resolved
- **THEN** it SHALL be treated as CorpusId `13756489`

#### Scenario: Reject an unrecognized id
- **WHEN** an id `not-an-id` is resolved
- **THEN** its result SHALL have status `invalid` and no outbound request SHALL be made for it

### Requirement: Resolve endpoint
The system SHALL provide `POST /api/s2/papers/resolve` accepting `{ "ids": string[] }` and returning `{ "results": [...] }` with one entry per requested id, in request order. Each entry SHALL include `id` (as requested), `status` (`resolved` | `not_found` | `unavailable` | `invalid`), `source` (`library` | `cache` | `s2` | `stale_cache` | null), `paper` (metadata or null), and `library_paper_id` (the matching library paper id or null). `paper` SHALL include `s2_paper_id`, `corpus_id`, `arxiv_id`, `doi`, `title`, `authors` (array of names), `year`, `venue`, `abstract`, `tldr`, `citation_count`, `influential_citation_count`, `url`, `open_access_pdf_url`, and `fetched_at`. Requests with more ids than `s2_cache.max_ids_per_request` SHALL be rejected with 400. Duplicate ids SHALL be resolved once.

#### Scenario: Resolve ids in order
- **WHEN** a client posts `{ "ids": ["<paperIdA>", "123", "bad"] }`
- **THEN** the response SHALL contain three results in the same order, the third with status `invalid`

#### Scenario: Too many ids
- **WHEN** a client posts more ids than `s2_cache.max_ids_per_request`
- **THEN** the server SHALL respond with 400

### Requirement: Resolution order
For each valid id the system SHALL resolve in this order: (1) a library paper whose `s2_paper_id` or `corpus_id` matches → `source: library`, metadata taken from the library paper, `library_paper_id` set, no outbound request; (2) a fresh cache entry → `source: cache`; (3) otherwise fetch from Semantic Scholar. A cached or fetched paper that matches a library paper by any external id SHALL also carry `library_paper_id`.

#### Scenario: Library paper short-circuits
- **WHEN** a requested paperId equals the `s2_paper_id` of a library paper
- **THEN** the result SHALL have `source: library` and that paper's `library_paper_id`, and no S2 request SHALL be made for it

#### Scenario: Fresh cache hit
- **WHEN** a requested id has a cache entry fetched within `s2_cache.ttl_days`
- **THEN** the result SHALL have `source: cache` and no S2 request SHALL be made for it

### Requirement: Batched fetching through the shared S2 rate limit
All ids that need fetching in one resolve request SHALL be fetched with Semantic Scholar's batch endpoint (`POST /graph/v1/paper/batch`), in chunks of at most 500 ids, through the same API key, rate gate, and 429/5xx backoff used by `semantic_scholar_service`. Ids returned as null by S2 SHALL be stored as `not_found` cache entries. If S2 rejects a batch chunk with HTTP 400 (which it does when no id in the chunk exists), the system SHALL fall back to individual lookups for that chunk, treating per-id 404/400 as not found. Successful records SHALL be upserted into the cache keyed by both paperId and CorpusId.

#### Scenario: Several missing ids cost one request
- **WHEN** a resolve request contains 30 ids that are neither in the library nor in the cache
- **THEN** the system SHALL issue a single S2 batch request for them

#### Scenario: Batch of only unknown ids
- **WHEN** every id in a batch chunk is unknown and S2 rejects the batch with HTTP 400
- **THEN** the system SHALL look those ids up individually, and ids answered with 404 SHALL be stored as `not_found` entries rather than reported as `unavailable`

#### Scenario: Unknown id becomes a negative entry
- **WHEN** S2 returns null for a requested id
- **THEN** the result SHALL have status `not_found` and a `not_found` cache entry SHALL be stored

### Requirement: Cache expiry and negative caching
A successful cache entry SHALL be considered fresh for `s2_cache.ttl_days` (default 30) after `fetched_at`; a `not_found` entry SHALL suppress refetching for `s2_cache.not_found_ttl_days` (default 7). A stale entry SHALL be refetched on resolve; if that refetch fails, the stale data SHALL be returned with `source: stale_cache`. If an id has no cached data and fetching fails, its status SHALL be `unavailable`.

#### Scenario: Negative entry suppresses refetch
- **WHEN** an id has a `not_found` entry created 2 days ago and `not_found_ttl_days` is 7
- **THEN** resolving it SHALL return `not_found` without an S2 request

#### Scenario: Stale data served on fetch failure
- **WHEN** an id's cache entry is older than `ttl_days` and the refetch fails
- **THEN** the result SHALL be `resolved` with `source: stale_cache` and the previously cached metadata

#### Scenario: Nothing cached and S2 down
- **WHEN** an id has no cache entry and the S2 request fails
- **THEN** the result SHALL have status `unavailable` and `paper: null`

### Requirement: Anonymous requests do not fetch
The resolve endpoint SHALL be reachable without login. For anonymous requests the system SHALL resolve only from the library and the cache (including stale entries, returned as `stale_cache`) and SHALL NOT make outbound S2 requests; ids that would need fetching SHALL return status `unavailable`.

#### Scenario: Anonymous miss
- **WHEN** an anonymous client resolves an id that is not in the library or the cache
- **THEN** the result SHALL be `unavailable` and no S2 request SHALL be made

### Requirement: Cache configuration
`config.yml` SHALL support an optional `s2_cache` block with `ttl_days` (default 30), `not_found_ttl_days` (default 7), and `max_ids_per_request` (default 200). When the block or any key is absent, the defaults SHALL apply.

#### Scenario: Defaults without config
- **WHEN** `config.yml` has no `s2_cache` block
- **THEN** the system SHALL use `ttl_days` 30, `not_found_ttl_days` 7, and `max_ids_per_request` 200

### Requirement: Warm the cache when an answer finishes
When a QA result finishes successfully, the system SHALL asynchronously resolve (with fetching) all distinct `#cite:` ids in the answer so their metadata is cached. Warming SHALL NOT delay or fail the answer's completion; errors SHALL only be logged.

#### Scenario: Answer with citations warms the cache
- **WHEN** a QA answer containing `[A](#cite:<paperIdA>)` and `[B](#cite:<paperIdB>)` finishes
- **THEN** both ids SHALL subsequently be resolvable from the cache without a further S2 request

#### Scenario: Warming failure is isolated
- **WHEN** S2 is unreachable while warming
- **THEN** the QA result SHALL still be `done` and the error SHALL only be logged

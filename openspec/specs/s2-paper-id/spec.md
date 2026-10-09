# s2-paper-id Specification

## Purpose

Lets papers be identified by either Semantic Scholar identifier — the numeric Corpus ID or the 40-hex S2 paper id — for lookup, creation, and deduplication, and keeps both ids stored on the paper.

## Requirements

### Requirement: Store the S2 paper id
The `papers` table SHALL have a nullable, unique `s2_paper_id` text column holding the lowercase 40-hex Semantic Scholar paper id. The migration that adds it SHALL backfill it for existing papers from `metadata.s2_url` (`https://www.semanticscholar.org/paper/<id>`), skipping any value that would violate uniqueness. Paper API responses SHALL include `s2_paper_id`.

#### Scenario: Backfill from s2_url
- **WHEN** the migration runs on a paper whose metadata has `s2_url` "https://www.semanticscholar.org/paper/204e3073870fae3d05bcbc2f6a8e263d9b72e776"
- **THEN** that paper's `s2_paper_id` SHALL be "204e3073870fae3d05bcbc2f6a8e263d9b72e776"

#### Scenario: Paper response includes the id
- **WHEN** a client fetches `GET /api/papers/:id`
- **THEN** the response SHALL include the `s2_paper_id` field (null when unknown)

### Requirement: S2 enrichment resolves and records the paper id
`semantic_scholar_service` SHALL write the response `paperId` to `s2_paper_id` when the paper does not have one, skipping (without failing) when another paper already holds that id. When a paper has neither `arxiv_id` nor `corpus_id` but has `s2_paper_id`, the service SHALL query S2 with the bare paper id and resolve the missing ids (`corpus_id`, `arxiv_id`) with the same enrichment as other lookups. Identifier priority SHALL be `arxiv_id`, then `corpus_id`, then `s2_paper_id`.

#### Scenario: Paper created by S2 paper id
- **WHEN** the service runs for a paper with only `s2_paper_id` "649def34f8be52c8b66281af98ae884c09aef38b"
- **THEN** it SHALL request `GET /graph/v1/paper/649def34f8be52c8b66281af98ae884c09aef38b` and store the resolved `corpus_id` (and `arxiv_id` when present) plus enrichment

#### Scenario: Paper id written back
- **WHEN** the service enriches a paper that has a corpus_id but no s2_paper_id
- **THEN** it SHALL store the response `paperId` as `s2_paper_id`

#### Scenario: Paper id collision
- **WHEN** the resolved paperId already belongs to a different paper
- **THEN** the service SHALL leave `s2_paper_id` unchanged and still save the rest of the enrichment

### Requirement: Accept either S2 identifier when creating papers
`POST /api/papers` and `POST /external-api/v1/papers` SHALL accept `s2_paper_id` in addition to `arxiv_id`, `corpus_id`, and `title`. Before creating, the system SHALL look for an existing paper by `arxiv_id`, then `corpus_id`, then `s2_paper_id`; on a match it SHALL return that paper (backfilling any identifier the match is missing) instead of creating a duplicate. Concurrent requests for the same identifier SHALL resolve to the same paper.

#### Scenario: Create by S2 paper id
- **WHEN** a client posts `{"s2_paper_id": "649def34f8be52c8b66281af98ae884c09aef38b"}` and no paper has that id
- **THEN** a paper SHALL be created with that `s2_paper_id` and the service pipeline SHALL be triggered

#### Scenario: Existing paper found by the other id
- **WHEN** a client posts `{"s2_paper_id": "<id>"}` and a paper already has that `s2_paper_id`
- **THEN** the existing paper SHALL be returned with `created` false

#### Scenario: Corpus match backfills the paper id
- **WHEN** a client posts `{"corpus_id": "13756489", "s2_paper_id": "<id>"}` and a paper with corpus_id 13756489 exists without an s2_paper_id
- **THEN** the existing paper SHALL be returned and its `s2_paper_id` set to `<id>`

### Requirement: Look up papers by S2 paper id
`GET /external-api/v1/papers` and `GET /external-api/v1/papers/full` SHALL accept an `s2_paper_id` query parameter and find the paper by that column; `/full` with `auto_create=true` SHALL create it when missing, exactly as for `corpus_id`. `POST /external-api/v1/papers/batch` SHALL accept `s2_paper_id` per entry with the same dedup rules; an entry with an invalid identifier SHALL yield a per-entry `{ created: false, error: { code: "VALIDATION_ERROR" } }` result without failing the batch.

#### Scenario: Full lookup by S2 paper id
- **WHEN** a client requests `/external-api/v1/papers/full?s2_paper_id=<id>` and a paper has that id
- **THEN** the response SHALL return that paper

#### Scenario: Batch with an invalid entry
- **WHEN** a client posts a batch with one valid `s2_paper_id` entry and one entry with `corpus_id` "bogus"
- **THEN** the first result SHALL describe the paper and the second SHALL carry a `VALIDATION_ERROR`

### Requirement: Identifier normalization
The backend SHALL normalize S2 identifiers on every create/lookup path: `s2_paper_id` SHALL be lowercased and MUST be exactly 40 hex characters; `corpus_id` SHALL accept a plain integer or `CorpusId:<n>` (case-insensitive); a Semantic Scholar URL given in either field (`semanticscholar.org/paper/[<slug>/]<40-hex>` or `.../CorpusID:<n>`) SHALL be parsed into the matching identifier. An identifier that cannot be normalized SHALL be rejected with HTTP 422 `VALIDATION_ERROR`.

#### Scenario: S2 URL pasted
- **WHEN** a client posts `{"s2_paper_id": "https://www.semanticscholar.org/paper/Attention-is-All-you-Need-Vaswani/204e3073870fae3d05bcbc2f6a8e263d9b72e776"}`
- **THEN** the paper SHALL be created/looked up with `s2_paper_id` "204e3073870fae3d05bcbc2f6a8e263d9b72e776"

#### Scenario: CorpusId prefix
- **WHEN** a client posts `{"corpus_id": "CorpusId:13756489"}`
- **THEN** the paper SHALL be created/looked up with `corpus_id` "13756489"

#### Scenario: Invalid id
- **WHEN** a client posts `{"s2_paper_id": "not-an-id"}`
- **THEN** the response SHALL be 422 with code `VALIDATION_ERROR`

### Requirement: Add dialog accepts any S2 identifier
The paper list's add dialog SHALL offer a "Semantic Scholar" tab with a single input that accepts a Corpus ID, an S2 paper id, or a Semantic Scholar URL, and SHALL submit it as `corpus_id` (numeric / `CorpusId:` / CorpusID URL) or `s2_paper_id` (40-hex / paper URL).

#### Scenario: Paste a paper URL
- **WHEN** the user pastes a semanticscholar.org paper URL into the Semantic Scholar tab and confirms
- **THEN** the dialog SHALL create the paper via `s2_paper_id`

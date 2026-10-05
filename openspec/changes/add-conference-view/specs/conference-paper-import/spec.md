## ADDED Requirements

### Requirement: Upload pre-scraped file into a conference candidate pool
The system SHALL accept a pre-scraped JSON file of papers for a conference and store each paper in a candidate pool WITHOUT adding it to the main `papers` library.

#### Scenario: Import papers as candidates
- **WHEN** `POST /api/conferences/:id/papers/import` is called with `{ papers: [...] }` where each paper has at least a `title`
- **THEN** each paper SHALL be inserted into `conference_papers` for that conference with status `pending`
- **AND** no rows SHALL be inserted into the `papers` table

#### Scenario: Optional fields are preserved
- **WHEN** an imported paper includes `topic`, `source`, `external_id`, `link`, `authors`, or `abstract`
- **THEN** those values SHALL be stored on the candidate row; missing optional fields SHALL be stored as null

#### Scenario: Unknown source is tolerated
- **WHEN** an imported paper has a `source` not in {`arxiv`, `openreview`, `semantic_scholar`}
- **THEN** the candidate SHALL be stored with `source` null while retaining its `link` and other fields

#### Scenario: Batch import is atomic
- **WHEN** an import request contains multiple papers
- **THEN** all candidates SHALL be inserted within a single database transaction

#### Scenario: Upload via the UI
- **WHEN** the user uploads or pastes a pre-scraped JSON file in the conference detail page's import dialog
- **THEN** the candidates SHALL appear in the conference's candidate pool with status「待确认」

### Requirement: Candidate papers have a three-state lifecycle
Each conference paper SHALL have a status that is one of `pending` (待确认), `candidate` (候选中), or `ingested` (已入库), with defined transitions.

#### Scenario: Default status on import
- **WHEN** a candidate is imported
- **THEN** its status SHALL default to `pending`

#### Scenario: Confirm a candidate
- **WHEN** `PATCH /api/conferences/:id/papers/:cpId` (or the batch form `{ ids, status }`) sets status to `candidate`
- **THEN** the candidate's status SHALL become `candidate`

#### Scenario: Revert a candidate to pending
- **WHEN** a `candidate` paper's status is set back to `pending`
- **THEN** the status SHALL become `pending` and it SHALL be excluded from one-click ingest

#### Scenario: Delete a candidate
- **WHEN** `DELETE /api/conferences/:id/papers/:cpId` is called
- **THEN** the candidate row SHALL be removed and any already-ingested `papers` record SHALL NOT be affected

#### Scenario: Edit candidate topic
- **WHEN** `PATCH /api/conferences/:id/papers/:cpId` sets a new `topic`
- **THEN** the candidate's topic SHALL be updated and its grouping in the detail view SHALL change accordingly

### Requirement: One-click add ingests a conference's candidates into the library
The conference detail page SHALL provide a「本次会议一键添加」action that ingests all `candidate`-status papers of the conference into the main library, reusing the existing paper ingest pipeline.

#### Scenario: Ingest all candidates
- **WHEN** `POST /api/conferences/:id/ingest` is called
- **THEN** every `conference_papers` row with status `candidate` SHALL be ingested into `papers`, mapping `arxiv`→`arxiv_id`, `semantic_scholar`→`corpus_id`, and `openreview`/unknown→manual (title + authors + link)
- **AND** the existing dedup and service-trigger pipeline SHALL be reused for each ingest

#### Scenario: Mark ingested candidates
- **WHEN** a candidate is successfully ingested
- **THEN** its status SHALL become `ingested` and its `paper_id` SHALL be set to the created or matched paper's id

#### Scenario: Idempotent ingest of already-existing papers
- **WHEN** a candidate's `arxiv_id`/`corpus_id` already exists in the `papers` table
- **THEN** the candidate SHALL be linked to the existing paper and marked `ingested` WITHOUT creating a duplicate paper

#### Scenario: Pending papers are not ingested by one-click add
- **WHEN** one-click add runs
- **THEN** candidates with status `pending` SHALL be skipped (only `candidate` status is ingested)

#### Scenario: Ingest returns a summary
- **WHEN** `POST /api/conferences/:id/ingest` completes
- **THEN** it SHALL return a summary including the number ingested, skipped, and any errors

#### Scenario: Ingest a single candidate
- **WHEN** `POST /api/conferences/:id/papers/:cpId/ingest` is called for one candidate
- **THEN** that candidate SHALL be ingested using the same pipeline and marked `ingested` with its `paper_id`

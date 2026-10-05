## ADDED Requirements

### Requirement: Resolve conference candidates via Semantic Scholar title match
The system SHALL provide a rate-limited action that, for a conference's candidate papers without a linked paper (`paper_id IS NULL`), queries Semantic Scholar's title-match endpoint (`paper/search/match`) by title to obtain a `corpus_id` and (when available) an `arxiv_id`, plus a match score. Resolution SHALL go through the existing Semantic Scholar rate limiter.

#### Scenario: Resolve a conference
- **WHEN** the resolve action is invoked for a conference
- **THEN** each unlinked candidate SHALL be matched against Semantic Scholar by title, subject to the S2 rate limit

#### Scenario: Idempotent re-resolution
- **WHEN** resolve runs again and a candidate already has a linked paper
- **THEN** that candidate SHALL be skipped

### Requirement: Ingest resolved candidates as metadata-only papers
When a candidate resolves to an id with an acceptable match score, the system SHALL call `ingestPaper` with `listed=false` (passing `arxiv_id`/`corpus_id`, `title`, `authors`, `link`), which creates a new metadata-only paper or merges into an existing one by dedup, and SHALL set the candidate's `paper_id` to the resulting paper.

#### Scenario: Resolved candidate becomes a metadata-only paper
- **WHEN** a candidate resolves with a good match
- **THEN** a `listed=false` paper SHALL be created or merged, and the candidate's `paper_id` SHALL point to it

#### Scenario: Two candidates resolving to the same paper merge
- **WHEN** two candidates resolve to the same `arxiv_id`/`corpus_id`
- **THEN** both `paper_id`s SHALL reference the single merged paper row

### Requirement: Cache match metadata for review
On resolution, the system SHALL record the Semantic Scholar match score and the matched title/year on the candidate (e.g. in `conference_papers.metadata`) so a human can verify the match before promoting.

#### Scenario: Match score recorded
- **WHEN** a candidate is resolved
- **THEN** its match score and matched title SHALL be stored for review

### Requirement: Unresolved candidates remain to-be-added
When a candidate does not match (or matches below the acceptable score), the system SHALL leave its `paper_id` null and SHALL NOT create an empty paper row.

#### Scenario: No match leaves candidate to-be-added
- **WHEN** Semantic Scholar returns no acceptable match for a candidate title
- **THEN** the candidate SHALL keep `paper_id` null and remain in the "to-be-added" state

### Requirement: Conference candidate status is derived
The conference candidate status SHALL be derived rather than a stored `pending/candidate` lifecycle: `paper_id IS NULL` → to-be-added (待添加); `paper_id` set and the paper is `listed=false` → indexed/metadata-only; the paper is `listed=true` → added to the library (已加入).

#### Scenario: Status reflects linkage and listing
- **WHEN** a candidate's linked paper is promoted to `listed=true`
- **THEN** the candidate's derived status SHALL change from metadata-only to added

# paper-listing-eligibility Specification

## Purpose
Defines when a paper is eligible to be set to `listed=true`. OpenReview-only papers — those that have one or more OpenReview links but no canonical source (`arxiv_id`, `corpus_id`, or an arxiv.org `link`) — cannot be listed, since they lack a fetchable source for the metadata/PDF pipeline. The capability enforces this guard across every listing code path, exposes a derived `listable` flag in paper API responses, corrects existing wrongly-listed data, and disables the listing control in the frontend for non-listable papers.

## Requirements
### Requirement: OpenReview-only papers cannot be listed
The system SHALL refuse to set `listed=true` on a paper that is **OpenReview-only** — defined as a paper that has one or more OpenReview links (rows in `conference_papers` with a non-null `link`) AND has neither an `arxiv_id` nor a `corpus_id` nor a `link` whose host is `arxiv.org`. This rule SHALL apply to every code path that sets `listed` to `true`: `PATCH /api/papers/:id`, `PATCH /external-api/v1/papers/:id`, conference bulk ingest, conference candidate linking/promotion, and the `ingestPaper` auto-promotion branch (matching an existing metadata-only paper). Setting `listed=false` (demote/hide) SHALL always be allowed regardless of source.

#### Scenario: Reject promotion of an OpenReview-only paper via internal API
- **WHEN** a `PATCH /api/papers/:id` request with body `{"listed": true}` targets a paper that has OpenReview link(s) and no `arxiv_id`, no `corpus_id`, and no arxiv.org `link`
- **THEN** the system SHALL return HTTP 422 with error code `LISTING_NOT_ALLOWED`, SHALL leave `listed` unchanged (`0`), and SHALL NOT trigger the fetch pipeline

#### Scenario: Allow promotion when the paper has a corpus_id
- **WHEN** a `PATCH /api/papers/:id` request with body `{"listed": true}` targets a paper that has OpenReview link(s) and a non-null `corpus_id`
- **THEN** the system SHALL set `listed=true` and trigger the fetch pipeline as before

#### Scenario: Allow promotion when the paper has an arxiv_id
- **WHEN** a `PATCH /api/papers/:id` request with body `{"listed": true}` targets a paper that has a non-null `arxiv_id`
- **THEN** the system SHALL set `listed=true` regardless of any OpenReview links

#### Scenario: Demote is always allowed
- **WHEN** a `PATCH /api/papers/:id` request with body `{"listed": false}` targets any paper (including an OpenReview-only one)
- **THEN** the system SHALL set `listed=false` without applying the eligibility rule

#### Scenario: Manual title-only paper is unaffected
- **WHEN** a paper has no OpenReview links and no `arxiv_id`/`corpus_id` (e.g. a manually created title-only paper)
- **THEN** the eligibility rule SHALL NOT apply and the paper MAY be set to `listed=true`

#### Scenario: External API enforces the same rule
- **WHEN** an authenticated `PATCH /external-api/v1/papers/:id` request with `{"listed": true}` targets an OpenReview-only paper
- **THEN** the system SHALL reject it identically to the internal API (HTTP 422, `LISTING_NOT_ALLOWED`)

#### Scenario: Conference bulk ingest skips OpenReview-only candidates
- **WHEN** a conference ingest/promote operation would set `listed=true` on candidates and one candidate's linked paper is OpenReview-only
- **THEN** that candidate's paper SHALL remain `listed=false` (skipped), other eligible candidates SHALL be promoted, and the operation SHALL report the count of skipped candidates rather than silently dropping them

#### Scenario: ingestPaper auto-promotion respects the rule
- **WHEN** a new ingest matches an existing `listed=false` paper and would auto-promote it to `listed=true`
- **AND** that existing paper is OpenReview-only
- **THEN** the paper SHALL remain `listed=false`

### Requirement: Papers expose a derived listable flag
Paper API responses SHALL include a derived boolean field `listable` indicating whether the paper is currently allowed to be set to `listed=true`. `listable` SHALL be `false` for OpenReview-only papers and `true` otherwise. The field SHALL be computed at request time from the paper's identifiers and its OpenReview link count, and SHALL NOT be stored in the database. Both the paper detail endpoint (`GET /api/papers/:id`) and the paper list endpoint (`GET /api/papers`) SHALL include it.

#### Scenario: Detail response includes listable
- **WHEN** `GET /api/papers/:id` is requested for an OpenReview-only paper
- **THEN** the response SHALL include `"listable": false`

#### Scenario: List response includes listable for each paper
- **WHEN** `GET /api/papers` returns a page of papers
- **THEN** each paper object SHALL include a `listable` boolean, computed for the page in a single batched query over `conference_papers` (no per-paper N+1 query)

#### Scenario: Listable is true for a paper with a canonical source
- **WHEN** a paper has an `arxiv_id` or a `corpus_id`
- **THEN** its `listable` field SHALL be `true` even if it also has OpenReview links

### Requirement: Existing wrongly-listed papers are corrected
Existing papers that are currently `listed=true` but are OpenReview-only SHALL be corrected to `listed=false`. This correction SHALL include paper 217. The correction SHALL first enumerate the affected papers (read-only) for review before applying the update.

#### Scenario: Paper 217 corrected
- **WHEN** the data correction runs and paper 217 is `listed=true` while being OpenReview-only
- **THEN** paper 217 SHALL be set to `listed=false`

#### Scenario: Other same-state papers corrected
- **WHEN** the data correction runs and other papers are `listed=true` while being OpenReview-only
- **THEN** each such paper SHALL be set to `listed=false`

#### Scenario: Papers with a canonical source are untouched
- **WHEN** the data correction runs
- **THEN** papers that have an `arxiv_id` or `corpus_id` SHALL retain their existing `listed` value

### Requirement: Frontend disables listing for non-listable papers
The web UI SHALL prevent the user from attempting to list an OpenReview-only paper: the "加入列表" (add to list) control SHALL be disabled or hidden when a paper's `listable` is `false`, with a hint explaining that the paper has only an OpenReview link and lacks an arxiv/S2 source. When a promotion request is nonetheless rejected by the backend (HTTP 422), the UI SHALL surface the returned error message and SHALL leave the paper's local state unchanged.

#### Scenario: Promote control disabled for non-listable paper
- **WHEN** the paper list renders an unlisted paper whose `listable` is `false`
- **THEN** its "加入列表" control SHALL be disabled (or hidden) with an explanatory hint

#### Scenario: Promote control enabled for listable paper
- **WHEN** the paper list renders an unlisted paper whose `listable` is `true`
- **THEN** its "加入列表" control SHALL be enabled

#### Scenario: 422 rejection is surfaced
- **WHEN** a promotion request returns HTTP 422 `LISTING_NOT_ALLOWED`
- **THEN** the UI SHALL show the error message and the paper SHALL remain unlisted in the local store

# paper-dates Specification

## Purpose
Stores when a paper or blog post was first published and last updated at its source, and shows those dates.

## Requirements

### Requirement: Publication and update dates
A paper MAY have `metadata.published_at` (first publication) and `metadata.modified_at` (latest revision at the source), each an ISO 8601 date (`YYYY-MM-DD`) or date-time. The sources are:
- `arxiv_metadata_service` SHALL set `published_at` from the arXiv entry's `<published>` (the v1 submission) and `modified_at` from `<updated>` (the latest version), overwriting earlier values.
- `semantic_scholar_service` SHALL set `published_at` from `publicationDate` only for papers without an arXiv id whose `published_at` is empty.
- Users and agents SHALL be able to set or clear both fields through `PATCH /api/papers/:id`, `POST /api/papers`, the External API PATCH, and the MCP `add_paper` / `update_paper` tools. Invalid values SHALL be rejected with 422 `INVALID_DATE` (a tool error over MCP).

#### Scenario: arXiv dates
- **WHEN** arXiv metadata for a paper reports published "2024-01-01T10:00:00Z" and updated "2024-03-05T12:00:00Z"
- **THEN** `metadata.published_at` SHALL be "2024-01-01T10:00:00Z" and `metadata.modified_at` "2024-03-05T12:00:00Z"

#### Scenario: Blog dates from the agent
- **WHEN** an agent calls `add_paper` with `published_at: "2026-10-12"` and `modified_at: "2026-10-13"`
- **THEN** the paper's metadata SHALL contain those values

#### Scenario: Invalid date
- **WHEN** a PATCH sets `published_at: "last week"`
- **THEN** the response SHALL be 422 `INVALID_DATE` and nothing SHALL change

### Requirement: Dates are shown on the paper page
The paper detail header SHALL show "Published <date>" when `published_at` is set, and "Updated <date>" when `modified_at` is set and falls on a different day. Dates SHALL be shown as calendar dates. The edit form SHALL have "Published" and "Last updated" date inputs.

#### Scenario: Revised arXiv paper
- **WHEN** a paper has published_at 2024-01-01 and modified_at 2024-03-05
- **THEN** the header SHALL show both dates

### Requirement: Backfill of existing papers
A one-off script `scripts/backfill-paper-dates.ts`, run from the project root, SHALL fill missing dates on existing papers:
- arXiv papers: `published_at` / `modified_at` from the arXiv API, queried in batches with the arXiv rate limit respected.
- Other papers: `published_at` from the `s2_papers` cache's `publication_date`.

It SHALL not overwrite dates that are already set, and SHALL report how many papers it updated.

#### Scenario: Rerun is harmless
- **WHEN** the script runs twice
- **THEN** the second run SHALL update no papers that already have dates

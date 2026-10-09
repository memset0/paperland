## MODIFIED Requirements

### Requirement: Enrichment field set
The service SHALL persist a defined set of Semantic Scholar fields, storing whatever is available and skipping anything missing. `corpus_id` SHALL be stored on the top-level paper column; `citation_count`, `influential_citation_count`, `reference_count`, `references` (each with `paper_id`, `title`, `year`), `tldr` (text), `venue`, `year`, `doi`, `fields_of_study`, `s2_url`, `open_access_pdf_url`, and `open_access_pdf_status` SHALL be stored in `metadata` using snake_case keys. `reference_count` SHALL be sourced from the S2 `referenceCount` field (the authoritative total), independent of the length of the stored `references` page. `open_access_pdf_url` SHALL be sourced from `openAccessPdf.url` and stored only when it is a non-empty string; `open_access_pdf_status` SHALL be sourced from `openAccessPdf.status` and stored whenever S2 returns it (including `CLOSED`). Neither open-access key SHALL be part of the service's `produces`. Basic fields (title, abstract, authors) SHALL only be filled when empty and SHALL NOT overwrite values already set by arxiv_service.

#### Scenario: Store available enrichment in metadata
- **WHEN** the S2 response contains citationCount, referenceCount, influentialCitationCount, tldr, references, venue, year, and externalIds.DOI
- **THEN** the service SHALL write `citation_count`, `reference_count`, `influential_citation_count`, `tldr`, `references`, `venue`, `year`, and `doi` into the paper's metadata

#### Scenario: reference_count reflects the true total
- **WHEN** the S2 response reports referenceCount 137 but the returned `references` page contains fewer entries
- **THEN** the service SHALL store `reference_count` = 137 in metadata (not the page length)

#### Scenario: Do not overwrite existing basic fields
- **WHEN** the paper already has a non-empty title set by arxiv_service and S2 returns a different title
- **THEN** the service SHALL NOT change the paper's title

#### Scenario: Open-access PDF link stored
- **WHEN** the S2 response contains `openAccessPdf` with url "https://example.org/paper.pdf" and status "GREEN"
- **THEN** the service SHALL store `open_access_pdf_url` = "https://example.org/paper.pdf" and `open_access_pdf_status` = "GREEN" in metadata

#### Scenario: Closed-access paper
- **WHEN** the S2 response contains `openAccessPdf` with an empty url and status "CLOSED"
- **THEN** the service SHALL store `open_access_pdf_status` = "CLOSED" and SHALL NOT store `open_access_pdf_url`

#### Scenario: openAccessPdf absent
- **WHEN** the S2 response has no `openAccessPdf` field (or it is null)
- **THEN** the service SHALL store neither open-access key and SHALL still complete successfully

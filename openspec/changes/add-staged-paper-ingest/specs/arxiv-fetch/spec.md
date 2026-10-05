## ADDED Requirements

### Requirement: Arxiv fetch deferred for metadata-only papers
`arxiv_metadata_service` and `arxiv_pdf_service` SHALL be declared `requires_listed: true`, so they are deferred for `listed=false` papers and run only once the paper is promoted to `listed=true`. This keeps metadata-only papers off the (more rate-limited) arxiv endpoints.

#### Scenario: Arxiv services deferred while unlisted
- **WHEN** a `listed=false` paper has an `arxiv_id`
- **THEN** `arxiv_metadata_service` and `arxiv_pdf_service` SHALL be deferred and SHALL NOT call arxiv

#### Scenario: Arxiv services run after promotion
- **WHEN** the paper is promoted to `listed=true`
- **THEN** `arxiv_metadata_service` and `arxiv_pdf_service` SHALL run

### Requirement: Prefer Semantic Scholar over arxiv for metadata
Paper metadata SHALL be sourced from Semantic Scholar first; `arxiv_metadata_service` SHALL act as a fallback that only fills fields still missing after Semantic Scholar (and produces `link`). For the PDF, the Semantic Scholar `openAccessPdf.url` SHALL be usable as a preferred source, with `arxiv_pdf_service` as the fallback download.

#### Scenario: Arxiv metadata only fills gaps
- **WHEN** `arxiv_metadata_service` runs after Semantic Scholar already populated `abstract`/`authors`
- **THEN** it SHALL only fill remaining empty fields and set `link`, not overwrite Semantic Scholar data

#### Scenario: Open-access PDF preferred
- **WHEN** a promoted paper has a Semantic Scholar `openAccessPdf.url`
- **THEN** that URL MAY be used as the PDF source before falling back to an arxiv download

# arxiv-fetch Specification

## Purpose
TBD - created by archiving change arxiv-service. Update Purpose after archive.

## Requirements

### Requirement: Fetch arxiv metadata
The arxiv_service SHALL fetch paper metadata (title, authors, abstract, categories) from the arxiv API using the paper's arxiv_id.

#### Scenario: Successful metadata fetch
- **WHEN** arxiv_service executes for a paper with arxiv_id "1706.03762"
- **THEN** the service SHALL fetch from `http://export.arxiv.org/api/query?id_list=1706.03762` and parse the title, authors, abstract, and categories

### Requirement: Download PDF
The arxiv_service SHALL download the paper's PDF from arxiv and store it locally.

#### Scenario: Successful PDF download
- **WHEN** arxiv_service executes for a paper with arxiv_id "1706.03762"
- **THEN** the PDF SHALL be downloaded from `https://arxiv.org/pdf/1706.03762.pdf` and stored at `data/pdfs/1706_03762.pdf`
- **THEN** the paper's pdf_path SHALL be set to the local file path

### Requirement: Service declaration
The arxiv_service SHALL be registered as a paper-bound service with depends_on=["arxiv_id"] and produces=["pdf_path"].

#### Scenario: Dependency declaration
- **WHEN** the server starts
- **THEN** arxiv_service SHALL be registered with the ServiceRunner with the correct depends_on and produces

### Requirement: Auto-fill basic fields
The arxiv_service SHALL update the paper's title, abstract, and authors if they are empty or default values.

#### Scenario: Fill empty metadata
- **WHEN** a paper has title "Untitled" and the arxiv API returns title "Attention Is All You Need"
- **THEN** the paper's title SHALL be updated to "Attention Is All You Need"

### Requirement: Arxiv fetch deferred for metadata-only papers
`arxiv_metadata_service` and `arxiv_pdf_service` SHALL be declared `requires_listed: true`, so they are deferred for `listed=false` papers and run only once the paper is promoted to `listed=true`. This keeps metadata-only papers off the (more rate-limited) arxiv endpoints.

#### Scenario: Arxiv services deferred while unlisted
- **WHEN** a `listed=false` paper has an `arxiv_id`
- **THEN** `arxiv_metadata_service` and `arxiv_pdf_service` SHALL be deferred and SHALL NOT call arxiv

#### Scenario: Arxiv services run after promotion
- **WHEN** the paper is promoted to `listed=true`
- **THEN** `arxiv_metadata_service` and `arxiv_pdf_service` SHALL run

### Requirement: Prefer Semantic Scholar over arxiv for metadata
Paper metadata SHALL be sourced from Semantic Scholar first; `arxiv_metadata_service` SHALL act as a fallback that only fills fields still missing after Semantic Scholar (and produces `link`). For the PDF, a paper with an `arxiv_id` SHALL keep arXiv as its PDF source; the Semantic Scholar open-access PDF is used only for papers without an `arxiv_id` (see `s2-pdf-fetch`).

#### Scenario: Arxiv metadata only fills gaps
- **WHEN** `arxiv_metadata_service` runs after Semantic Scholar already populated `abstract`/`authors`
- **THEN** it SHALL only fill remaining empty fields and set `link`, not overwrite Semantic Scholar data

#### Scenario: arXiv papers keep arXiv as PDF source
- **WHEN** a promoted paper has an `arxiv_id` and Semantic Scholar also reports an open-access PDF URL
- **THEN** its PDF SHALL be downloaded by `arxiv_pdf_service`, not from the Semantic Scholar URL

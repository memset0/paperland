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


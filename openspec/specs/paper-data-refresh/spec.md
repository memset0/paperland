# paper-data-refresh Specification

## Purpose
Lets users manually re-fetch a paper's PDF (e.g. a newer arXiv version) and refresh its Semantic Scholar data (citation counts, citation graph), without any automatic re-fetching.

## Requirements

### Requirement: Manual PDF re-fetch
The system SHALL provide `POST /api/papers/:id/pdf/refetch` for logged-in users. It SHALL download the paper's PDF again from its PDF source, chosen in this order: the arXiv PDF of the paper's `arxiv_id` (which serves the latest version); otherwise `metadata.pdf_url`; otherwise `metadata.open_access_pdf_url`. The download SHALL go through the same service, concurrency limit, and rate limit as the automatic download from that source, and SHALL be recorded as an execution of that service. The endpoint SHALL respond 202 with `{ queued: true, service: <service name> }` without waiting for the download. It SHALL reject: anonymous requests (401); unknown papers (404); metadata-only (unlisted) papers (422 `NOT_LISTED`); papers with no PDF source (422 `NO_PDF_SOURCE`); and papers for which that service is already pending or running (409 `REFRESH_IN_PROGRESS`). The system SHALL NOT re-fetch PDFs automatically; only this endpoint and the MCP `refresh_paper` tool SHALL start a re-fetch.

#### Scenario: Re-fetch an arXiv paper
- **WHEN** a logged-in user re-fetches the PDF of a listed paper with arxiv_id "2401.00001"
- **THEN** the response SHALL be 202 and an `arxiv_pdf_service` execution SHALL download `https://arxiv.org/pdf/2401.00001.pdf`

#### Scenario: Manual paper with a PDF URL
- **WHEN** a paper without arxiv_id has `metadata.pdf_url` "https://example.org/report.pdf"
- **THEN** the re-fetch SHALL download from that URL through `url_pdf_service`

#### Scenario: No PDF source
- **WHEN** a paper has no arxiv_id, no `pdf_url`, and no `open_access_pdf_url`
- **THEN** the response SHALL be 422 `NO_PDF_SOURCE` and no download SHALL start

#### Scenario: Already running
- **WHEN** the paper's `arxiv_pdf_service` execution is running and the user re-fetches again
- **THEN** the response SHALL be 409 `REFRESH_IN_PROGRESS`

### Requirement: Re-fetched PDFs are versioned files
A re-fetched (or replacement-uploaded) PDF SHALL pass the same validation as the source's normal download (HTTP status, timeout, size limit, `%PDF` signature) and SHALL be stored under `data/pdfs/` with a file name containing a hash of its content, so a stored name is never reused for different bytes. When the new content is byte-identical to the paper's current PDF, the paper's `pdf_path` and derived data SHALL NOT change (only `metadata.pdf_fetched_at` is updated), the duplicate file SHALL be removed, and the execution SHALL complete with result `unchanged`. Otherwise the paper's `pdf_path` SHALL point to the new file and the execution SHALL complete with result `updated`. The previous PDF file SHALL be kept on disk. A failed re-fetch SHALL leave `pdf_path` and all derived data unchanged and SHALL leave no new file behind. Every successful download SHALL record `metadata.pdf_fetched_at` (ISO 8601).

#### Scenario: Same version
- **WHEN** the re-downloaded arXiv PDF is identical to the current file
- **THEN** `pdf_path`, `contents`, and doc2x data SHALL be unchanged and the execution result SHALL be `unchanged`

#### Scenario: New version
- **WHEN** the re-downloaded PDF differs from the current file
- **THEN** `pdf_path` SHALL point to a new file under `data/pdfs/`, the old file SHALL still exist, and the execution result SHALL be `updated`

#### Scenario: Download fails
- **WHEN** the arXiv download returns HTTP 503 during a re-fetch
- **THEN** the execution SHALL fail with the status in its error and the paper SHALL keep its current PDF

### Requirement: Derived data follows the new PDF
When a paper's `pdf_path` changes to a new file (re-fetch with result `updated`, or a replacement upload), the system SHALL remove the data derived from the old PDF — `contents.pdf_parsed`, `contents.doc2x_parsed`, the doc2x parse id, the doc2x translation record, and the paper's doc2x output files — and SHALL schedule the paper's service pipeline so PDF-dependent services run on the new file. If the paper had a doc2x parse before, a new doc2x parse SHALL be requested; if it had a doc2x translation, a new translation SHALL be requested. User data (notes, Q&A, tags, `contents.user_input`) SHALL be kept. PDF highlights recorded on the old file SHALL be kept in the database and, per the existing highlight rule, SHALL NOT be drawn on the new file.

#### Scenario: Parsed text is regenerated
- **WHEN** a re-fetch replaces the PDF of a paper with `contents.pdf_parsed`
- **THEN** `contents.pdf_parsed` SHALL be removed and `pdf_parse_service` SHALL run again on the new file

#### Scenario: doc2x is re-requested
- **WHEN** a paper that had a doc2x parse and translation gets a new PDF
- **THEN** the old doc2x data SHALL be removed and a doc2x parse followed by a translation SHALL be scheduled for the new PDF

### Requirement: Manual Semantic Scholar refresh
The system SHALL provide `POST /api/papers/:id/s2/refresh` for logged-in users that runs `semantic_scholar_service` for the paper even when its enrichment is already present, responding 202 with `{ queued: true, service: "semantic_scholar_service" }`. The run SHALL overwrite the stored S2 enrichment (`citation_count`, `influential_citation_count`, `reference_count`, `references`, `tldr`, `venue`, `year`, open-access fields, …) with the fresh values, SHALL replace the stored citation graph, SHALL NOT overwrite non-empty title, authors, or abstract, and SHALL record `metadata.s2_fetched_at` (ISO 8601). It SHALL reject anonymous requests (401), unknown papers (404), papers without an arxiv_id, corpus_id, or s2_paper_id (422 `NO_S2_ID`), and papers whose `semantic_scholar_service` is already pending or running (409 `REFRESH_IN_PROGRESS`). It SHALL go through the service's normal rate limit. The system SHALL NOT refresh S2 data automatically.

#### Scenario: Citation count grows
- **WHEN** a paper stored with citation_count 10 is refreshed and S2 now reports 25
- **THEN** `metadata.citation_count` SHALL become 25, the citation graph SHALL be replaced, and `metadata.s2_fetched_at` SHALL be updated

#### Scenario: Paper without S2 identifiers
- **WHEN** a manual paper with no arxiv_id, corpus_id, or s2_paper_id is refreshed
- **THEN** the response SHALL be 422 `NO_S2_ID`

### Requirement: Refresh controls in paper detail
For logged-in users, the paper detail page SHALL offer "Re-fetch PDF" when the paper has a PDF source and "Refresh Semantic Scholar data" when the paper has an S2-resolvable id. "Re-fetch PDF" on a paper that already has a PDF SHALL first ask for confirmation, naming the consequence (parsed text and translations are regenerated; highlights made on the old version are hidden). While a refresh runs the control SHALL show an in-progress state ("Re-fetching PDF…" / "Refreshing…"); when it ends the page SHALL reload the paper and show the outcome ("PDF updated", "PDF unchanged", "Semantic Scholar data refreshed", or the error). The page SHALL show when the PDF and the S2 data were last fetched when those times are known. Anonymous viewers SHALL NOT see the controls.

#### Scenario: Re-fetch finds a new version
- **WHEN** a user confirms "Re-fetch PDF" and the download yields a different file
- **THEN** the page SHALL show "PDF updated" and the viewer SHALL load the new PDF without a full page reload

#### Scenario: Anonymous visitor
- **WHEN** an anonymous visitor opens a public paper page
- **THEN** no refresh controls SHALL be shown

## MODIFIED Requirements

### Requirement: Derived PDF status
`GET /api/papers/:id` SHALL include `pdf_status` and `pdf_unavailable_reason`:
- `available` (reason null) when the paper has `pdf_path`;
- otherwise `fetching` (reason null) when the latest execution of `arxiv_pdf_service`, `s2_pdf_service`, or `url_pdf_service` is pending/running, or — for a paper without `arxiv_id` — the latest `semantic_scholar_service` execution is pending/running;
- otherwise `upload_required` with reason `download_failed` when the latest `arxiv_pdf_service`, `s2_pdf_service`, or `url_pdf_service` execution failed, `closed_access` when metadata has `open_access_pdf_status` but no `open_access_pdf_url`, and `not_found` in every other case.

#### Scenario: Closed-access paper
- **WHEN** a corpus-only paper has no pdf_path, no running PDF/S2 services, and metadata `open_access_pdf_status` "CLOSED"
- **THEN** the response SHALL have `pdf_status` "upload_required" and `pdf_unavailable_reason` "closed_access"

#### Scenario: Download in progress
- **WHEN** the paper's latest `s2_pdf_service` execution is running
- **THEN** `pdf_status` SHALL be "fetching"

#### Scenario: PDF URL download in progress
- **WHEN** a manual paper's latest `url_pdf_service` execution is running
- **THEN** `pdf_status` SHALL be "fetching"

#### Scenario: Download failed
- **WHEN** the latest `s2_pdf_service` execution failed and the paper has no pdf_path
- **THEN** `pdf_status` SHALL be "upload_required" with reason "download_failed"

#### Scenario: PDF present
- **WHEN** the paper has a pdf_path
- **THEN** `pdf_status` SHALL be "available"

### Requirement: Upload a PDF for a paper
The system SHALL provide `POST /api/papers/:id/pdf` for logged-in users, accepting the raw PDF bytes with `Content-Type: application/pdf`. It SHALL store the file under `data/pdfs/` with a content-hashed name, set the paper's `pdf_path`, record `metadata.pdf_fetched_at`, and trigger the paper's service pipeline so PDF-dependent services run. It SHALL respond with the updated paper. With the query parameter `replace=1` it SHALL also accept papers that already have a PDF: identical content SHALL leave the paper unchanged, and different content SHALL switch `pdf_path` to the new file with the derived-data handling of a re-fetched PDF (paper-data-refresh). It SHALL reject: unauthenticated requests (401); unknown papers (404); papers that already have a `pdf_path` when `replace=1` is not given (409 `PDF_EXISTS`); bodies larger than `pdf_upload.max_file_size_mb` (413); bodies that do not start with `%PDF` (422 `INVALID_PDF`). Rejected uploads SHALL NOT leave files behind.

#### Scenario: Successful upload
- **WHEN** a logged-in user posts a valid PDF to a paper without pdf_path
- **THEN** the paper SHALL get a `pdf_path` under `data/pdfs/`, the response SHALL contain it, and PDF-dependent services SHALL be scheduled

#### Scenario: Not a PDF
- **WHEN** the body is an HTML or text file
- **THEN** the response SHALL be 422 `INVALID_PDF` and `pdf_path` SHALL remain unset

#### Scenario: Paper already has a PDF
- **WHEN** the paper already has a pdf_path and `replace=1` is not given
- **THEN** the response SHALL be 409 `PDF_EXISTS` and the existing PDF SHALL be unchanged

#### Scenario: Replace a PDF
- **WHEN** a user posts a different valid PDF with `replace=1` to a paper that has a PDF
- **THEN** `pdf_path` SHALL point to the new file, the old file SHALL be kept, and parsed text SHALL be regenerated from the new file

#### Scenario: Anonymous user
- **WHEN** an unauthenticated request posts a PDF
- **THEN** the response SHALL be 401

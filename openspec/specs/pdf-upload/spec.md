# pdf-upload Specification

## Purpose

Lets users supply a PDF themselves when Paperland cannot obtain one automatically (closed-access papers or failed downloads), and tells them in the paper viewer whether a PDF is available, still being fetched, or needs to be uploaded.

## Requirements

### Requirement: Derived PDF status
`GET /api/papers/:id` SHALL include `pdf_status` and `pdf_unavailable_reason`:
- `available` (reason null) when the paper has `pdf_path`;
- otherwise `fetching` (reason null) when the latest execution of `arxiv_pdf_service` or `s2_pdf_service` is pending/running, or — for a paper without `arxiv_id` — the latest `semantic_scholar_service` execution is pending/running;
- otherwise `upload_required` with reason `download_failed` when the latest `arxiv_pdf_service` or `s2_pdf_service` execution failed, `closed_access` when metadata has `open_access_pdf_status` but no `open_access_pdf_url`, and `not_found` in every other case.

#### Scenario: Closed-access paper
- **WHEN** a corpus-only paper has no pdf_path, no running PDF/S2 services, and metadata `open_access_pdf_status` "CLOSED"
- **THEN** the response SHALL have `pdf_status` "upload_required" and `pdf_unavailable_reason` "closed_access"

#### Scenario: Download in progress
- **WHEN** the paper's latest `s2_pdf_service` execution is running
- **THEN** `pdf_status` SHALL be "fetching"

#### Scenario: Download failed
- **WHEN** the latest `s2_pdf_service` execution failed and the paper has no pdf_path
- **THEN** `pdf_status` SHALL be "upload_required" with reason "download_failed"

#### Scenario: PDF present
- **WHEN** the paper has a pdf_path
- **THEN** `pdf_status` SHALL be "available"

### Requirement: Upload a PDF for a paper
The system SHALL provide `POST /api/papers/:id/pdf` for logged-in users, accepting the raw PDF bytes with `Content-Type: application/pdf`. It SHALL store the file under `data/pdfs/`, set the paper's `pdf_path`, and trigger the paper's service pipeline so PDF-dependent services run. It SHALL respond with the updated paper. It SHALL reject: unauthenticated requests (401); unknown papers (404); papers that already have a `pdf_path` (409 `PDF_EXISTS`); bodies larger than `pdf_upload.max_file_size_mb` (413); bodies that do not start with `%PDF` (422 `INVALID_PDF`). Rejected uploads SHALL NOT leave files behind.

#### Scenario: Successful upload
- **WHEN** a logged-in user posts a valid PDF to a paper without pdf_path
- **THEN** the paper SHALL get a `pdf_path` under `data/pdfs/`, the response SHALL contain it, and PDF-dependent services SHALL be scheduled

#### Scenario: Not a PDF
- **WHEN** the body is an HTML or text file
- **THEN** the response SHALL be 422 `INVALID_PDF` and `pdf_path` SHALL remain unset

#### Scenario: Paper already has a PDF
- **WHEN** the paper already has a pdf_path
- **THEN** the response SHALL be 409 `PDF_EXISTS` and the existing PDF SHALL be unchanged

#### Scenario: Anonymous user
- **WHEN** an unauthenticated request posts a PDF
- **THEN** the response SHALL be 401

### Requirement: Upload size limit is configurable
`config.yml` SHALL support `pdf_upload.max_file_size_mb` (default 100 when absent).

#### Scenario: Default limit
- **WHEN** `pdf_upload` is absent from config
- **THEN** uploads up to 100 MB SHALL be accepted and larger ones rejected with 413

### Requirement: Viewer shows PDF availability and upload entry
The paper detail viewer panel SHALL always show the "PDF" tab. When the paper has no PDF:
- with `pdf_status` "fetching" it SHALL show a "Fetching PDF…" state and refresh the paper periodically until the status changes;
- with `pdf_status` "upload_required" it SHALL show a "PDF needed" panel that states the reason (closed access / automatic download failed / no PDF source found) and offers a file picker and drag-and-drop upload limited to PDF files.
After a successful upload the panel SHALL refresh the paper and render the PDF without a page reload. Anonymous viewers SHALL see the reason but no upload control. Upload errors SHALL be shown in the panel.

#### Scenario: Closed-access paper opened
- **WHEN** a user opens a closed-access paper without a PDF
- **THEN** the left panel SHALL show "PDF needed" with the closed-access reason and an upload control

#### Scenario: Upload from the panel
- **WHEN** the user drops a PDF onto the panel
- **THEN** it SHALL be uploaded and the PDF viewer SHALL replace the panel once the upload succeeds

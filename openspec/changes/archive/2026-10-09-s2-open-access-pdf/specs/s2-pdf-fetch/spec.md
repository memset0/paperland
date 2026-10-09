## Purpose

Provides a paper's PDF from its Semantic Scholar open-access link when the paper has no arXiv id, so papers that only exist on Semantic Scholar can use the PDF viewer, PDF parsing, and translation pipeline.

## ADDED Requirements

### Requirement: Download open-access PDF for papers without arXiv id
The system SHALL provide a paper-bound service `s2_pdf_service` that, for a paper with no `arxiv_id` and no `pdf_path` whose metadata contains `open_access_pdf_url`, downloads the PDF from that URL, stores it under `data/pdfs/`, and sets the paper's `pdf_path`. The service SHALL declare `depends_on=["open_access_pdf_url"]` and `produces=["pdf_path"]`, so that PDF-dependent services (pdf_parse, doc2x parse/translate) are chained automatically after it succeeds. The service SHALL only run for listed papers; for metadata-only (unlisted) papers it SHALL be deferred until promotion, like `arxiv_pdf_service`.

#### Scenario: Corpus-only paper with open-access PDF
- **WHEN** a listed paper has corpus_id, no arxiv_id, no pdf_path, and `semantic_scholar_service` stores `open_access_pdf_url`
- **THEN** `s2_pdf_service` SHALL run automatically, save the file under `data/pdfs/`, and set `pdf_path` to its relative path
- **AND** pdf-dependent services SHALL then be scheduled for the paper

#### Scenario: Unlisted paper
- **WHEN** the paper is metadata-only (listed = 0)
- **THEN** `s2_pdf_service` SHALL be recorded as deferred and SHALL NOT download until the paper is listed

### Requirement: arXiv remains the preferred PDF source
`s2_pdf_service` SHALL NOT run automatically for any paper that has an `arxiv_id`, including when the `arxiv_id` was resolved by `semantic_scholar_service` in the same enrichment that produced `open_access_pdf_url`. Such papers SHALL obtain their PDF from `arxiv_pdf_service`.

#### Scenario: Paper with arxiv_id
- **WHEN** a paper has an arxiv_id and its metadata also contains `open_access_pdf_url`
- **THEN** `s2_pdf_service` SHALL NOT be scheduled and no request SHALL be made to the open-access URL

#### Scenario: arxiv_id resolved from corpus_id
- **WHEN** a corpus-only paper's S2 enrichment resolves both an arxiv_id and an `open_access_pdf_url`
- **THEN** only `arxiv_pdf_service` SHALL download the PDF

### Requirement: Closed-access papers do not fail
When Semantic Scholar provides no open-access PDF URL for a paper, `s2_pdf_service` SHALL NOT issue any download request and SHALL NOT produce a failed execution; the paper SHALL simply remain without `pdf_path`.

#### Scenario: No open-access URL
- **WHEN** a corpus-only paper's metadata has `open_access_pdf_status` "CLOSED" and no `open_access_pdf_url`
- **THEN** no download SHALL be attempted, no `failed` execution SHALL be recorded for `s2_pdf_service`, and `pdf_path` SHALL remain empty

### Requirement: Downloaded content validation
The service SHALL follow redirects, apply a configurable request timeout and maximum file size, and SHALL only write `pdf_path` when the downloaded body is a PDF (begins with the `%PDF` signature). On a non-2xx response, timeout, oversize body, or non-PDF body (e.g. an HTML landing page), the execution SHALL fail with an error message describing the cause, no file SHALL be left in `data/pdfs/`, and `pdf_path` SHALL remain unset. A failed execution SHALL be retryable through the existing per-service trigger.

#### Scenario: Landing page instead of PDF
- **WHEN** the open-access URL returns HTTP 200 with an HTML body
- **THEN** the execution SHALL fail with an error indicating the response is not a PDF and `pdf_path` SHALL remain unset

#### Scenario: Publisher blocks the request
- **WHEN** the open-access URL returns HTTP 403
- **THEN** the execution SHALL fail with an error containing the status code and `pdf_path` SHALL remain unset

#### Scenario: File too large
- **WHEN** the response body exceeds `max_file_size_mb`
- **THEN** the execution SHALL fail with a size error and no file SHALL be written

### Requirement: Configuration
`s2_pdf_service` SHALL be configured under `services.s2_pdf_service` in `config.yml` with `max_concurrency`, `rate_limit_interval`, `download_timeout` (seconds, default 60), and `max_file_size_mb` (default 100). When the entry or the optional keys are absent, these defaults SHALL apply.

#### Scenario: Defaults without config
- **WHEN** `config.yml` has no `services.s2_pdf_service` entry
- **THEN** the service SHALL still run with a 60-second download timeout and a 100 MB size limit

### Requirement: Backfill existing corpus-only papers
The system SHALL provide an admin-only endpoint `POST /api/services/backfill/s2_pdf_service` that re-runs `semantic_scholar_service` for every listed paper with no `arxiv_id`, a `corpus_id`, no `pdf_path`, and no `open_access_pdf_status` in metadata, so the open-access link is captured and `s2_pdf_service` chains automatically. It SHALL return `{ success: true, queued: <count> }`.

#### Scenario: Backfill queues eligible papers
- **WHEN** an admin calls the backfill endpoint and two listed corpus-only papers lack `open_access_pdf_status`
- **THEN** the response SHALL be `{ success: true, queued: 2 }` and `semantic_scholar_service` SHALL be executed for both papers through the service runner

#### Scenario: Non-admin rejected
- **WHEN** a non-admin user calls the backfill endpoint
- **THEN** the request SHALL be rejected by the admin guard

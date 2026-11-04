# manual-paper-sources Specification

## Purpose
Supports papers that are not on a preprint server (only a project page and a PDF) and web articles such as blog posts: adding them with a link, a remote PDF URL or an uploaded PDF, and editing their metadata.

## Requirements

### Requirement: Paper kind
Every paper SHALL have a `kind` of `paper` (default) or `article` (a web article such as a blog post). Paper create and update endpoints SHALL accept `kind`; any other value SHALL be rejected with 422 `VALIDATION_ERROR`. Paper responses SHALL include `kind`. The paper detail page and the paper list SHALL mark `article` entries with an "Article" badge.

#### Scenario: Add a blog post
- **WHEN** a user creates a paper with `{"title": "Scaling notes", "link": "https://blog.example.com/post", "kind": "article"}`
- **THEN** the paper SHALL be stored with kind `article` and shown with an "Article" badge

#### Scenario: Invalid kind
- **WHEN** a create request has `kind: "video"`
- **THEN** the response SHALL be 422 and no paper SHALL be created

### Requirement: Remote PDF URL for manual papers
Paper create and update endpoints SHALL accept `pdf_url`, an `http`/`https` URL of the paper's PDF, stored as `metadata.pdf_url` (an empty string clears it; other schemes SHALL be rejected with 422). A paper-bound service `url_pdf_service` SHALL, for a listed paper with no `arxiv_id` and no `pdf_path` whose metadata has `pdf_url`, download that URL with the same validation as the open-access download (redirects, `services.url_pdf_service.download_timeout` default 60 s, `max_file_size_mb` default 100, `%PDF` signature) and set `pdf_path`, so PDF-dependent services chain after it. When both `pdf_url` and `open_access_pdf_url` exist, `pdf_url` SHALL be used and `s2_pdf_service` SHALL NOT download. A failed download SHALL be a failed execution, retryable by the per-service trigger or by re-fetch, and SHALL make the paper's `pdf_status` `upload_required` with reason `download_failed`.

#### Scenario: Project-page paper with a tech report
- **WHEN** a user adds `{"title": "Code Video Model", "link": "https://code-video-model.github.io", "pdf_url": "https://code-video-model.github.io/tech_report.pdf"}`
- **THEN** `url_pdf_service` SHALL download the PDF, set `pdf_path`, and PDF parsing SHALL then run

#### Scenario: URL returns a web page
- **WHEN** the `pdf_url` returns HTML
- **THEN** the `url_pdf_service` execution SHALL fail with a not-a-PDF error and the paper SHALL stay without `pdf_path`

#### Scenario: PDF URL added later
- **WHEN** a user sets `pdf_url` on an existing manual paper without a PDF
- **THEN** `url_pdf_service` SHALL be scheduled for the paper

### Requirement: Manual papers are deduplicated by link
When a create request carries no arxiv_id, corpus_id, or s2_paper_id but has a `link`, the system SHALL look for an existing paper without any of those ids whose link is the same after normalization (scheme and host lower-cased, `http`/`https` treated alike, a leading `www.` ignored, trailing slash and fragment removed). If found, it SHALL return that paper with `created: false` (adding it to the caller's library) instead of creating a duplicate, and SHALL NOT change its fields.

#### Scenario: Same project page added twice
- **WHEN** a paper with link "https://code-video-model.github.io/" exists and a user adds a manual paper with link "http://code-video-model.github.io"
- **THEN** the existing paper SHALL be returned with `created: false`

### Requirement: Creating a manual paper with metadata and PDF
`POST /api/papers` SHALL additionally accept `abstract`, `year` (integer), `venue`, `kind`, and `pdf_url` for manual papers and store them (abstract on the paper; year and venue in metadata). A manual paper SHALL require a non-empty `title`.

#### Scenario: Manual paper with full metadata
- **WHEN** a user posts title, authors, link, abstract, year 2026, venue "Tech report", and pdf_url
- **THEN** the created paper SHALL return those values and `url_pdf_service` SHALL be scheduled

### Requirement: Add dialog supports non-preprint papers
The "Add paper" dialog's "Manual" tab SHALL offer: a type choice ("Paper" / "Web article"), title (required), authors, link, abstract, a PDF given either as a URL or as an uploaded PDF file, content, and tags. When a file is chosen, the dialog SHALL create the paper and then upload the file to it; if the upload fails the paper SHALL still exist and the error SHALL be shown on its detail page. After success the user SHALL be taken to the paper's detail page.

#### Scenario: Add with an uploaded PDF
- **WHEN** a user fills in the title, chooses a local PDF, and clicks "Add"
- **THEN** the paper SHALL be created, the PDF SHALL be uploaded to it, and the paper detail page SHALL open showing the PDF

#### Scenario: Add a web article without PDF
- **WHEN** a user chooses "Web article", enters a title and link, and adds it
- **THEN** the paper SHALL be created with kind `article` and no PDF download SHALL be attempted

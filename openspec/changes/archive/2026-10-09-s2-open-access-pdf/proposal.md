## Why

Papers that exist on Semantic Scholar but not on arXiv (added via `corpus_id`) currently never get a PDF: the only PDF source is `arxiv_pdf_service`, which requires `arxiv_id`. Without `pdf_path`, the whole downstream pipeline (pdf_parse, doc2x parse/translate, the PDF viewer, region screenshots, PDF-based Q&A context) is unavailable for these papers. Semantic Scholar exposes an `openAccessPdf` link for many such papers, so we can close most of this gap without manual uploads.

## What Changes

- `semantic_scholar_service` additionally requests the S2 `openAccessPdf` field and stores `open_access_pdf_url` (only when S2 returns a non-empty URL) and `open_access_pdf_status` (when present, e.g. `GREEN`, `BRONZE`, `CLOSED`) in paper metadata.
- New paper-bound service `s2_pdf_service`: for papers **without** an `arxiv_id` and without a `pdf_path`, downloads the PDF from `open_access_pdf_url` into `data/pdfs/` and writes `pdf_path`, so the existing dependency graph automatically chains pdf_parse / doc2x.
  - Downloaded content is validated (must start with `%PDF`, size limit, timeout); HTML landing pages / 403 / broken links fail the execution with a clear error instead of writing a bogus `pdf_path`.
  - Papers with an `arxiv_id` keep using `arxiv_pdf_service` (arXiv stays the preferred source); `s2_pdf_service` never runs for them.
  - Order for papers added via S2 (`corpus_id`): `semantic_scholar_service` first resolves the arXiv id; if one exists, the existing arXiv metadata/PDF pipeline is used unchanged. Only when S2 has no arXiv id does `s2_pdf_service` download the open-access PDF.
  - Closed-access papers (no open-access URL) simply have no S2 PDF; the service stays un-runnable (`blocked`) and nothing fails.
  - Deferred until the paper is listed (`requires_listed`), like `arxiv_pdf_service`.
- New config entry `services.s2_pdf_service` in `config.yml` / `config.example.yml` with `max_concurrency`, `rate_limit_interval`, and new optional service fields `download_timeout` (seconds) and `max_file_size_mb`.
- Admin backfill endpoint `POST /api/services/backfill/s2_pdf_service`: re-runs `semantic_scholar_service` for listed corpus-only papers (no `arxiv_id`, no `pdf_path`) that lack `open_access_pdf_status`, so existing papers pick up the open-access link and chain the download.
- Docs updated: `docs/frontend-architecture.md`, `docs/external-api.md`, `docs/tech-stack.md`.

Out of scope (separate changes): manual PDF upload, adding papers by S2 URL / DOI.

## Capabilities

### New Capabilities
- `s2-pdf-fetch`: Downloading a paper's open-access PDF via Semantic Scholar for papers without an arXiv id, including validation, failure semantics, config, and backfill.

### Modified Capabilities
- `semantic-scholar-fetch`: The enrichment field set additionally includes `open_access_pdf_url` and `open_access_pdf_status` from the S2 `openAccessPdf` field.

## Impact

- Backend: `packages/backend/src/services/semantic_scholar_service.ts` (fields + mapping), new `packages/backend/src/services/s2_pdf_service.ts` (+ unit test with mocked fetch), `packages/backend/src/index.ts` (register), `packages/backend/src/config.ts` (optional `download_timeout`, `max_file_size_mb` on service schema), `packages/backend/src/api/services.ts` (backfill endpoint).
- Config: `config.yml`, `config.example.yml` gain `services.s2_pdf_service`.
- External: additional outbound HTTP requests to publisher / repository hosts serving open-access PDFs.
- No DB schema change (uses existing `pdf_path` column and `metadata` JSON). No frontend code change needed: the viewer already renders any `pdf_path`.

## Why

Closed-access papers (and papers whose automatic PDF download failed) can be added and enriched with metadata, but they never get a PDF, so the viewer, PDF parsing, doc2x, and PDF-based Q&A are unusable. The left viewer panel only says "暂无可用的查看模式" with no way forward. Users need to see that a PDF is required and upload it themselves.

## What Changes

- Paper detail responses (`GET /api/papers/:id`) gain a derived `pdf_status` (`available` | `fetching` | `upload_required`) and `pdf_unavailable_reason` (`closed_access` | `download_failed` | `not_found` | null), computed from `pdf_path`, S2 open-access metadata, and the latest PDF-related service executions.
- New endpoint `POST /api/papers/:id/pdf` (logged-in users): raw `application/pdf` body, validated (`%PDF` signature, size limit from `config.yml` `pdf_upload.max_file_size_mb`), stored under `data/pdfs/`, sets `pdf_path`, and triggers the service pipeline so pdf_parse / doc2x run automatically. Rejected with 409 when the paper already has a PDF.
- Viewer panel (left side of paper detail): the "PDF 原文" tab is always shown. Without a PDF it shows either "正在获取 PDF…" (polling until the state changes) or a "需要上传 PDF" panel explaining why (closed access / download failed / not found) with a file picker + drag-and-drop upload. After upload the PDF renders immediately.
- Config: new `pdf_upload.max_file_size_mb` (default 100) in `config.yml` / `config.example.yml`.
- Docs updated (`frontend-architecture.md`, `external-api.md`, `tech-stack.md`).

Out of scope: replacing an existing PDF; uploads through the External API.

## Capabilities

### New Capabilities
- `pdf-upload`: Derived PDF availability status, user PDF upload endpoint, and the viewer's upload-required / fetching states.

### Modified Capabilities
<!-- none -->

## Impact

- Backend: `api/papers.ts` (pdf_status in detail, upload route with a scoped `application/pdf` body parser), new `utils/pdf_status.ts`, `config.ts`.
- Frontend: `components/PaperViewerPanel.vue`, new `components/PdfUploadPanel.vue`, `views/PaperDetail.vue`, `stores/papers.ts`, shared `Paper` type.
- Config: `config.yml`, `config.example.yml`. No DB migration.

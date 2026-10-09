## Context

`PaperViewerPanel` hides the PDF tab when `pdf_path` is null; with no modes it shows "暂无可用的查看模式". The backend has no multipart support; image uploads use base64 JSON. `/api/files/*` serves files from CWD with `Cache-Control: max-age=86400`. PDF producers: `arxiv_pdf_service`, `s2_pdf_service` (change `s2-open-access-pdf`).

## Goals / Non-Goals

**Goals:** clear PDF state in the viewer; one-step upload that plugs into the existing pipeline.
**Non-Goals:** replacing PDFs, External API upload, upload permissions beyond "logged-in" (papers are global records; uploading only fills a missing PDF, so it cannot clobber someone else's file).

## Decisions

1. **Raw `application/pdf` body** with a route-scoped `addContentTypeParser('application/pdf', { parseAs: 'buffer', bodyLimit })` instead of adding `@fastify/multipart` or base64 JSON (33% overhead on large PDFs). Body limit = `max_file_size_mb`; Fastify's 413 covers oversize.
2. **Server-derived `pdf_status`** (`utils/pdf_status.ts`, pure function over paper + latest executions) rather than client inference, so the rules live in one tested place. Only detail responses carry it (list endpoints unchanged).
3. **Filename** `data/pdfs/upload_<paperId>_<sha256[0..8]>.pdf` — content-hashed so the 24h `/api/files` cache can never serve a stale file.
4. **After upload** call `serviceRunner.triggerForPaper(id)` (same as creation); `pdf_path` now exists so pdf_parse/doc2x get scheduled; `arxiv_pdf_service`/`s2_pdf_service` are skipped since `pdf_path` is produced.
5. **Viewer:** the PDF tab is always available; `PdfViewer` renders when `pdfPath`, otherwise new `PdfUploadPanel` (fetching / upload-required). `PaperDetail` passes `pdf_status`, reason, and refetches on `uploaded`; fetching polls every 5 s via the store.

## Risks / Trade-offs

- [Wrong PDF uploaded] → no replace in this change; admin can clear `pdf_path` via existing tooling; replacement can be a follow-up.
- [Large body memory] → bounded by `max_file_size_mb`.

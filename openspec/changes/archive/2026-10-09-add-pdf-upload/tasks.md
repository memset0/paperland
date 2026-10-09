## 1. Backend

- [x] 1.1 Add `pdf_upload.max_file_size_mb` (explicit default 100) to `config.ts`, `config.yml`, `config.example.yml`; verify with a `config.test.ts` case
- [x] 1.2 Create `utils/pdf_status.ts` deriving `pdf_status`/`pdf_unavailable_reason`; include in `GET /api/papers/:id`; verify with `utils/pdf_status.test.ts` covering every state/reason
- [x] 1.3 Add `POST /api/papers/:id/pdf` (scoped raw PDF parser, 401/404/409/413/422, content-hashed file, set pdf_path, trigger pipeline); verify with `api/pdf_upload.test.ts` (Fastify inject, temp cwd, stubbed runner)

## 2. Frontend

- [x] 2.1 Add `pdf_status`/`pdf_unavailable_reason` to the shared `Paper` type and an `uploadPdf` store action; verify type-check
- [x] 2.2 Create `PdfUploadPanel.vue` (fetching / upload-required states, reason text, picker + drag-and-drop, errors, anonymous read-only) and wire it into `PaperViewerPanel` (PDF tab always shown) and `PaperDetail` (props, refetch, 5 s polling while fetching); verify with frontend build

## 3. Docs and verification

- [x] 3.1 Update `docs/frontend-architecture.md`, `docs/external-api.md`, `docs/tech-stack.md`; verify the endpoint / panel are documented
- [x] 3.2 Run targeted backend tests and frontend build; verify all pass

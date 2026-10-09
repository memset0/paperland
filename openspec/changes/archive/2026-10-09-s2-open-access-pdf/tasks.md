## 1. S2 enrichment

- [x] 1.1 Add `openAccessPdf` to `S2_FIELDS` and map `openAccessPdf.url` (non-empty only) → `open_access_pdf_url`, `openAccessPdf.status` → `open_access_pdf_status` in `mapS2ToPaperFields`; verify with new mocked-fetch cases in `semantic_scholar_service.test.ts` (open, CLOSED, absent)

## 2. Config

- [x] 2.1 Add optional `download_timeout` and `max_file_size_mb` to `serviceSchema` in `config.ts`; add `services.s2_pdf_service` block to `config.yml` and `config.example.yml`; verify `config.test.ts` passes

## 3. s2_pdf_service

- [x] 3.1 Create `services/s2_pdf_service.ts` (`depends_on: ['open_access_pdf_url']`, `produces: ['pdf_path']`, `requires_listed`, `eligible` = no arxiv_id and no pdf_path) with timeout, size limit, http(s) check, `%PDF` validation, write to `data/pdfs/s2_<corpus_id>.pdf`; verify with `s2_pdf_service.test.ts` (mocked fetch: success, HTML body, 403, oversize, eligibility)
- [x] 3.2 Register the service in `index.ts`; verify with a service-runner test that a corpus-only paper chains S2 → `s2_pdf_service` and that a paper with arxiv_id never schedules it

## 4. Backfill

- [x] 4.1 Add admin `POST /api/services/backfill/s2_pdf_service` in `api/services.ts` queuing `semantic_scholar_service` for listed corpus-only papers without pdf_path / `open_access_pdf_status`; verify with `api/s2_pdf_backfill.test.ts` (Fastify inject, in-memory DB, stubbed runner: eligibility filter + admin guard) instead of calling the live backend

## 5. Docs and verification

- [x] 5.1 Update `docs/frontend-architecture.md` (service graph + config), `docs/external-api.md` (corpus-only PDF behavior), `docs/tech-stack.md` (file tree + config); verify the new service is mentioned in all three
- [x] 5.2 Run targeted backend tests (mocked only, no real external calls) and the backend type-check; verify all pass

## 1. Schema and config

- [x] 1.1 Add `papers.kind` (text not null default 'paper') to schema, generate the Drizzle migration, and verify it is a single additive `ALTER TABLE` that applies on a copy of the DB with existing rows set to `paper`
- [x] 1.2 Add `services.url_pdf_service` (max_concurrency, rate_limit_interval, download_timeout, max_file_size_mb) to `config.yml`/config example and verify config loads with and without the entry (config test)
- [x] 1.3 Add `kind`, `pdf_fetched_at`/`s2_fetched_at`-related fields and new request types to `packages/shared/src/types.ts`; verify `vue-tsc --noEmit` (frontend, which compiles the shared types) reports no errors (backend tsc is not runnable: missing bun-types)

## 2. PDF storage, download, and replacement

- [x] 2.1 Create `services/pdf_store.ts`: shared `downloadPdf(url, limits)` (moved from s2_pdf_service), content-hashed `writePdfFile`, `pdfSourceService(paper)`, `invalidatePdfDerived` and replacement comparison; unit tests with mocked fetch cover HTML body, 403, oversize, same/different hash
- [x] 2.2 Switch `arxiv_pdf_service` and `s2_pdf_service` to `downloadPdf`/`writePdfFile` with hashed names, always download (explicit execution works even when `pdf_path` exists), record `pdf_fetched_at`; `s2_pdf_service` yields to `pdf_url`; verify existing s2_pdf tests pass
- [x] 2.3 Add `url_pdf_service` (depends_on pdf_url, produces pdf_path, requires_listed, eligible) and register it; verify with a runner test that a listed manual paper with `pdf_url` gets `pdf_path` and an unlisted one is deferred
- [x] 2.4 ServiceRunner: replacement handling (execution result `updated`/`unchanged`) (unchanged vs updated + invalidation + re-trigger), and `derived_reset_at`-aware re-check; verify runner tests for unchanged/updated/doc2x re-request/chain after reset
- [x] 2.5 Add `url_pdf_service` to `derivePdfStatus` and verify pdf_status tests (fetching / download_failed)

## 3. API endpoints

- [x] 3.1 `POST /api/papers/:id/pdf/refetch` and `POST /api/papers/:id/s2/refresh` with 401/404/422/409 rules; verify route tests (mocked services, no network)
- [x] 3.2 `semantic_scholar_service` records `s2_fetched_at`; verify S2 service test asserts it with mocked fetch
- [x] 3.3 Upload `replace=1` (extract `storeUploadedPdf`), recording `pdf_fetched_at`; verify pdf_upload tests for replace same/different content and 409 without replace
- [x] 3.4 PATCH accepts abstract/year/venue/kind/pdf_url with validation and schedules services when pdf_url is set; extract `updatePaperFields`; verify route tests including 422 and arXiv lock
- [x] 3.5 POST accepts abstract/year/venue/kind/pdf_url, requires title for manual papers; `ingestPaper` link dedup; responses include `kind`; verify tests for dedup normalization and invalid kind

## 4. MCP

- [x] 4.1 Add `add_paper`, `update_paper`, `upload_paper_pdf`, `refresh_paper` tools with personal-token gate and annotations; verify mcp/agent_tools tests (agent token rejected, add with pdf_url, upload base64, refresh queues)
- [x] 4.2 Raise `/mcp` body limit for base64 PDFs and restrict research rounds to read tools + upload_image; verify tests for tools/list annotations and research attach tool list

## 5. Frontend

- [x] 5.1 API client + PaperList "Add paper" Manual tab: type, title (required), authors, link, abstract, PDF URL or file upload, content, tags; Article badge in list; verify via scratch build and vue-tsc
- [x] 5.2 PaperDetail: Refresh menu (Re-fetch PDF with confirm, Refresh Semantic Scholar data), progress polling and outcome toast, last-fetched times, Article badge, edit fields (abstract/year/venue/type/PDF URL); verify via scratch build, vue-tsc, and a headless-Chrome check of the deployed app (menu, edit fields, add dialog)

## 6. Docs and verification

- [x] 6.1 Update `docs/tech-stack.md`, `docs/frontend-architecture.md`, `docs/external-api.md` (MCP write tools, refresh endpoints, kind, url_pdf_service); verify content by review
- [x] 6.2 Run the reviewed offline backend test files touched by this change and `openspec validate add-paper-refresh-and-manual-sources --strict`; all pass
- [x] 6.3 Deploy (frontend build + backend restart) and verify health; add Code Video Model via the new flow (link + PDF URL) as the acceptance check, as the user requested (paper 318 via MCP `add_paper`; re-fetch returned `unchanged`)

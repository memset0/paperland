## Context

- The only PDF producer today is `arxiv_pdf_service` (`depends_on: ['arxiv_id']`, `produces: ['pdf_path']`, `requires_listed`). `pdf_parse` / `doc2x_parse_service` depend on `pdf_path`.
- `semantic_scholar_service` runs for every paper (`depends_on: []`) and queries `ARXIV:` or `CORPUSID:`; it does not request `openAccessPdf` today.
- `ServiceRunner` has two scheduling points: the initial plan (`buildExecutionPlan`, keys reachable via `produces`), and a post-completion live-key re-trigger that runs any service whose `depends_on` keys now exist on the paper, unless it already has a pending/running/done execution. `eligible(paper)` gates both and skips silently. The arxiv chaining for corpus-only papers already relies on the live-key re-trigger (`arxiv_id` is deliberately not in S2's `produces`).
- Metadata JSON keys count as "existing keys" for dependency purposes.

## Goals / Non-Goals

**Goals:** best-effort open-access PDF for papers lacking an arXiv id, reusing the dependency graph with no runner changes.

**Non-Goals:** manual PDF upload; replacing arXiv PDFs with publisher versions; scraping landing pages to find a PDF link; multi-source fallback (e.g. Unpaywall).

## Decisions

1. **Separate service `s2_pdf_service` with `depends_on: ['open_access_pdf_url']`** rather than downloading inside `semantic_scholar_service`.
   - Keeps the S2 service fast and rate-limited at 1 RPS for the S2 API only; publisher downloads get their own concurrency / rate limit and their own retryable execution record.
   - `open_access_pdf_url` is stored only when non-empty and is not in any `produces`, so at initial planning the service is `blocked` (no failure), and once S2 writes the URL the live-key re-trigger starts it — the same mechanism already used for `arxiv_id`. Closed-access papers just stay `blocked`, which matches the spec's "no failure".
   - Alternative: put `pdf_path` into S2's produces — rejected, it would make S2 "not done" for every closed-access paper and conflict with `arxiv_pdf_service`.

2. **`eligible: paper => !paper.arxiv_id && !paper.pdf_path`.** Evaluated against the fresh paper row in the re-trigger, so when S2 resolves `arxiv_id` and the URL in the same write, the S2 PDF path is skipped and `arxiv_pdf_service` wins. `requires_listed: true` mirrors `arxiv_pdf_service` (deferred for metadata-only papers; promotion re-triggers).

3. **Validation:** `fetch` with `redirect: 'follow'`, an `AbortSignal.timeout(download_timeout*1000)`, a browser-like `User-Agent` + `Accept: application/pdf` (some repositories reject the default UA), reject when `Content-Length` exceeds the limit, read the body, re-check size, then require the first bytes to be `%PDF` (content-type is unreliable for repositories). Only after validation is the file written, so failures never leave a file behind.

4. **File naming:** `data/pdfs/s2_<corpus_id>.pdf` (fallback `s2_paper_<id>.pdf` if no corpus_id), distinct from arXiv's `<sanitized arxiv id>.pdf`, so no collision.

5. **Config:** add optional `download_timeout` and `max_file_size_mb` to the generic `serviceSchema` (code defaults 60 s / 100 MB); new `services.s2_pdf_service` block in `config.yml` and `config.example.yml` (`max_concurrency: 2`, `rate_limit_interval: 2`).

6. **Backfill:** existing corpus-only papers already have a `done` S2 execution, so they will not re-run on their own. The admin endpoint re-executes `semantic_scholar_service` for listed papers with `corpus_id`, no `arxiv_id`, no `pdf_path`, and no `open_access_pdf_status`; the live-key re-trigger then chains the download. Users can also retry `semantic_scholar_service` per paper from the existing service UI.

## Risks / Trade-offs

- [Many "open-access" URLs are landing pages or block bots] → strict `%PDF` check, clear error message, retryable execution; accepted as best-effort.
- [Publisher PDF may differ from final/arXiv version] → only used when no arXiv id exists.
- [Outbound requests to arbitrary hosts from S2 data] → URL comes from S2 API only, http(s) scheme enforced, size/timeout bounded.
- [`blocked` record for every corpus-only paper at creation] → harmless and consistent with existing blocked semantics; no UI change.

## Migration Plan

No DB migration. Deploy, add the config block, optionally call `POST /api/services/backfill/s2_pdf_service` once. Rollback: unregister the service; downloaded files and `pdf_path` stay valid.

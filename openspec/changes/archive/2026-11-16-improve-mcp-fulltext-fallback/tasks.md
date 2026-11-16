# Tasks

## 1. Fallback text and readiness

- [x] 1.1 Add `readPdfText(paperId)` to `pdf_pages.ts` (whole-document pdftotext under existing confinement, semaphore, timeout and output cap; small mtime-keyed LRU cache); verify with fake local executables in `pdf_pages.test.ts` that it extracts once per PDF version and reports unavailable PDFs.
- [x] 1.2 Update `read_paper` and `get_paper` in `agent_tools.ts` with `precision`, `precise_pending`, rough-text fallback, the `not_ready` result with arXiv links, re-check notes and an updated `read_paper` description; verify with offline `agent_tools.test.ts` cases for precise, rough stored, rough on-the-fly, doc2x pending/failed and not-ready papers, and run the focused MCP tests.
- [x] 1.3 Update `docs/external-api.md` and `docs/tech-stack.md` (frontend architecture unaffected); verify the docs match the tool output fields.

## 2. Deployment

- [x] 2.1 Restart the backend service from the project root, check `/api/health`, and verify read-only through the production `/mcp` tools/list that the new `read_paper` description is served (tool calls are skipped to avoid incrementing the user's MCP call counters; field behavior is covered by the offline tests).

## Workflow follow-up

- Report the deployment and ask whether to archive; re-run `/mcp-review` later to mark ERR-1/ERR-2 resolved.

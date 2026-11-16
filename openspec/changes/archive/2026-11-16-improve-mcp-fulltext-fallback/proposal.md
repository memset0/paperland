# Proposal

## Why

The 2026-11-16 MCP design review (`docs/mcp-reviews/2026-11-16.md`) found that `read_paper` dead-ends while a paper's text is not ready (ERR-1, high). Right after `add_paper`, a paper can have a PDF but no stored text yet, because both the unpdf parse and the slower doc2x parse are queued, and the tool only answers "no full text (not parsed yet)". When a rough `pdf_parsed` text exists but the precise doc2x parse is still running, the tool returns the rough text without saying it is rough or that a better version is coming. `get_paper` shows only `full_text: null` and no progress (ERR-2). Chat clients such as ChatGPT add a paper and want to discuss it in the same conversation, so they need something usable right away and need to know when to look again.

## What Changes

- `read_paper` labels every result with `precision` (`precise` for user input or doc2x Markdown, `rough` for unpdf or on-the-fly PDF text) and with `precise_pending` when a doc2x parse is expected but not finished.
- When no stored text exists but the paper's local PDF does, `read_paper` returns a rough text extracted on the fly from the PDF (local Poppler, paginated as usual) instead of an error.
- When neither text nor PDF is available, `read_paper` returns a non-error "not ready" result. It carries the PDF status, the abstract, direct arXiv HTML and abstract-page links for arXiv papers, and an instruction to use those now and call `read_paper` again on the user's next question.
- Every rough result carries a `note` telling the model that layout, formulas and tables may be garbled, and that it should call `read_paper` again on the user's next question to pick up the precise version.
- `get_paper` reports the PDF status and the text precision or pending state, and the `read_paper` description explains the fallback.

## Capabilities

### New Capabilities

### Modified Capabilities
- `research-agent-tools`: Site paper tools: `read_paper` falls back to rough PDF text or arXiv links with re-check guidance, and `read_paper`/`get_paper` report text precision and readiness.

## Impact

- `packages/backend/src/services/agent_tools.ts` (read_paper, get_paper, descriptions) and `services/pdf_pages.ts` (shared whole-document text extraction under the existing Poppler limits and concurrency). Tests in `agent_tools.test.ts` / `pdf_pages.test.ts` use fake local executables.
- Docs: `docs/external-api.md`, `docs/tech-stack.md`. `docs/frontend-architecture.md` is unaffected (no UI change).
- No database, External API or UI change. The backend service needs a restart to deploy.

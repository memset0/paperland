## MODIFIED Requirements

### Requirement: MCP endpoint
The backend SHALL expose an MCP server at `POST /mcp` using the Streamable HTTP transport without sessions: each POST carries one JSON-RPC message (or a batch) and is answered with `application/json`. It SHALL support `initialize`, `ping`, `tools/list`, and `tools/call`; notifications SHALL be answered with HTTP 202 and no body; unknown methods SHALL return JSON-RPC error `-32601`. `GET` and `DELETE` on `/mcp` SHALL return 405. The endpoint SHALL be reachable from any origin (including through the production reverse proxy); access is controlled only by the bearer token. It is not part of the External API. The read tools SHALL declare `readOnlyHint: true`; `upload_image` SHALL declare `readOnlyHint: false`, `destructiveHint: false` and `idempotentHint: true`; the paper write tools (`add_paper`, `update_paper`, `upload_paper_pdf`, `refresh_paper`) SHALL declare `readOnlyHint: false` and `openWorldHint: true`, with `destructiveHint: true` for `update_paper` and `upload_paper_pdf` (they can overwrite data) and `false` for the others. `POST /mcp` SHALL accept request bodies large enough for a base64-encoded PDF at `pdf_upload.max_file_size_mb` (and an image at the image host's limit).

#### Scenario: Tool listing
- **WHEN** a client with a valid token posts `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`
- **THEN** the response SHALL list the site tools, the S2 tools, `upload_image`, and the paper write tools, each with a name, description, JSON Schema input and its annotations

#### Scenario: Tool error is reported as a tool result
- **WHEN** a tool call fails (e.g. unknown paper id or an S2 outage)
- **THEN** the response SHALL be a successful JSON-RPC result with `isError: true` and a text explanation

## ADDED Requirements

### Requirement: Paper write tools
The MCP server SHALL provide tools that let a user's external agent add and maintain papers, with the same validation and effects as the corresponding website endpoints, acting as the token's user:
- `add_paper(arxiv_id? | corpus_id? | s2_paper_id? | title, authors?, link?, abstract?, year?, venue?, kind?, content?, pdf_url?, pdf_data?, tags?)`: creates (or finds, with the same identifier and link deduplication as `POST /api/papers`) a paper, adds it to the caller's library, attaches `tags` as the caller's tags when the paper was created, and when `pdf_data` (base64 or a `data:application/pdf` URL) is given stores it as the paper's PDF like an upload (ignored with a note when the found paper already has a PDF). It SHALL return the paper's id, `created`, its metadata, its in-app link `paperland://paper/<id>`, and its `pdf_status`.
- `update_paper(paper_id, title?, authors?, link?, abstract?, year?, venue?, kind?, pdf_url?, content?)`: updates the paper like `PATCH /api/papers/:id`, including the arXiv title/authors lock, and returns the updated metadata.
- `upload_paper_pdf(paper_id, data? | url?, replace?)`: exactly one of `data` (base64 PDF) or `url`; `data` is stored like `POST /api/papers/:id/pdf` (with `replace` meaning `replace=1`). `url` is rejected for arXiv papers (their PDF comes from arXiv) and, when the paper already has a PDF, unless `replace` is true (`PDF_EXISTS`); otherwise it sets the paper's `pdf_url` and starts a re-fetch from it when the paper has a PDF, or schedules `url_pdf_service` when it has none.
- `refresh_paper(paper_id, pdf?, s2?)`: starts a manual PDF re-fetch and/or S2 refresh (at least one SHALL be true) with the same rules as the website endpoints and returns which ones were queued.
These tools SHALL only be usable with a `personal` token; a call with an agent token SHALL be a tool error and SHALL change nothing. Validation failures (missing title, invalid kind or URL, not a PDF, too large, arXiv lock, refresh already running) SHALL be tool errors with a message.

#### Scenario: Agent adds a project-page paper with a PDF
- **WHEN** an external agent with a personal token calls `add_paper` with title "Code Video Model", link "https://code-video-model.github.io", and pdf_url "https://code-video-model.github.io/tech_report.pdf"
- **THEN** the paper SHALL be created in the caller's library, the result SHALL contain its id and `created: true`, and `url_pdf_service` SHALL download the PDF

#### Scenario: Agent uploads a PDF and edits metadata
- **WHEN** an agent calls `upload_paper_pdf` with base64 PDF data for a paper without a PDF and then `update_paper` with an abstract
- **THEN** the paper SHALL get the PDF and the new abstract

#### Scenario: Agent token cannot write
- **WHEN** a Codex run authenticated with an agent token calls `add_paper`
- **THEN** the result SHALL be a tool error and no paper SHALL be created

### Requirement: Agent runs get read-only paper tools
Deep Research rounds SHALL be attached to the `paperland` MCP server with only the read tools, the S2 tools, and `upload_image` enabled; the paper write tools SHALL NOT be enabled for them. Q&A runs keep only `upload_image`.

#### Scenario: Research round tool list
- **WHEN** a research round starts with agent tools enabled
- **THEN** its enabled `paperland` tools SHALL NOT include `add_paper`, `update_paper`, `upload_paper_pdf`, or `refresh_paper`

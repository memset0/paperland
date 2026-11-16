# Spec Delta

## MODIFIED Requirements

### Requirement: MCP authentication with API tokens
Every request to `/mcp` SHALL carry `Authorization: Bearer <token>` where the token is a non-revoked row of `api_tokens` of kind `personal`, `agent` or `topic` whose owning user exists and is active. Requests to a service URL `/mcp/s/<secret>` SHALL instead be authenticated by the secret in the path against non-revoked `api_tokens` rows of kind `service` (see the mcp-services capability) and SHALL NOT need an Authorization header. Topic tokens SHALL additionally require current membership in their bound Topic and enforce its scope. Missing, unknown, revoked, ownerless or inactive-account tokens SHALL receive HTTP 401. Tools SHALL act with the token owner's identity and permitted visibility. No other token store SHALL be used for `/mcp`.

#### Scenario: Missing token
- **WHEN** a request to `/mcp` has no `Authorization` header
- **THEN** the response SHALL be 401

#### Scenario: Personal and agent tokens both work
- **WHEN** a user calls `/mcp` with one of their personal tokens, or with their agent token
- **THEN** the request SHALL be served as that user

#### Scenario: Reset agent token value stops working
- **WHEN** a user resets their agent token and the previous value is used on `/mcp`
- **THEN** the response SHALL be 401

#### Scenario: Request through the reverse proxy
- **WHEN** a request with a valid token reaches `/mcp` through the production reverse proxy
- **THEN** it SHALL be served like a direct request

#### Scenario: Topic credential carries scoped identity
- **WHEN** a member calls `/mcp` with their Topic token
- **THEN** tool calls SHALL use that member's identity and only the bound Topic's authority

#### Scenario: Service URL without header
- **WHEN** a client posts to a valid `/mcp/s/<secret>` with no Authorization header
- **THEN** the request SHALL be served as the service owner with the service's permissions

### Requirement: Paper write tools
The MCP server SHALL provide tools that let a user's external agent add and maintain papers, with the same validation and effects as the corresponding website endpoints, acting as the token's user:
- `add_paper(arxiv_id? | corpus_id? | s2_paper_id? | title, authors?, link?, abstract?, year?, venue?, kind?, content?, pdf_url?, pdf_data?, tags?)`: creates (or finds, with the same identifier and link deduplication as `POST /api/papers`) a paper, adds it to the caller's library, attaches `tags` as the caller's tags when the paper was created, and when `pdf_data` (base64 or a `data:application/pdf` URL) is given stores it as the paper's PDF like an upload (ignored with a note when the found paper already has a PDF). It SHALL return the paper's id, `created`, its metadata, its in-app link `paperland://paper/<id>`, and its `pdf_status`.
- `update_paper(paper_id, title?, authors?, link?, abstract?, year?, venue?, kind?, pdf_url?, content?)`: updates the paper like `PATCH /api/papers/:id`, including the arXiv title/authors lock, and returns the updated metadata.
- `upload_paper_pdf(paper_id, data? | url?, replace?)`: exactly one of `data` (base64 PDF) or `url`; `data` is stored like `POST /api/papers/:id/pdf` (with `replace` meaning `replace=1`). `url` is rejected for arXiv papers (their PDF comes from arXiv) and, when the paper already has a PDF, unless `replace` is true (`PDF_EXISTS`); otherwise it sets the paper's `pdf_url` and starts a re-fetch from it when the paper has a PDF, or schedules `url_pdf_service` when it has none.
- `refresh_paper(paper_id, pdf?, s2?)`: starts a manual PDF re-fetch and/or S2 refresh (at least one SHALL be true) with the same rules as the website endpoints and returns which ones were queued.
These tools SHALL only be usable with a `personal` token or through an MCP service with `write` permission; a call with an agent token or a service without `write` SHALL be a tool error and SHALL change nothing. Validation failures (missing title, invalid kind or URL, not a PDF, too large, arXiv lock, refresh already running) SHALL be tool errors with a message.

#### Scenario: Agent adds a project-page paper with a PDF
- **WHEN** an external agent with a personal token calls `add_paper` with title "Code Video Model", link "https://code-video-model.github.io", and pdf_url "https://code-video-model.github.io/tech_report.pdf"
- **THEN** the paper SHALL be created in the caller's library, the result SHALL contain its id and `created: true`, and `url_pdf_service` SHALL download the PDF

#### Scenario: Agent uploads a PDF and edits metadata
- **WHEN** an agent calls `upload_paper_pdf` with base64 PDF data for a paper without a PDF and then `update_paper` with an abstract
- **THEN** the paper SHALL get the PDF and the new abstract

#### Scenario: Agent token cannot write
- **WHEN** a Codex run authenticated with an agent token calls `add_paper`
- **THEN** the result SHALL be a tool error and no paper SHALL be created

## ADDED Requirements

### Requirement: Q&A write tool
`add_paper_qa(paper_id, question, answer, model)` SHALL save a completed free Q&A entry owned by the caller on the paper, with server-clock created and completed times and `source` `mcp`. The answer's `model_name` SHALL be the signature `<model> [MCP]`, where the bracket names the channel the answer arrived through, so every Q&A view shows it. It SHALL require a personal token or a service with `write` and return the entry id, result id and in-app link.

#### Scenario: Input limits
- **WHEN** `question` or `answer` is empty, `answer` exceeds 200,000 characters, or `model` exceeds 100 characters
- **THEN** the call SHALL be a tool error and nothing SHALL be saved

#### Scenario: ChatGPT saves an answer
- **WHEN** a service named "ChatGPT" calls `add_paper_qa` with model "gpt-5"
- **THEN** the paper's Q&A SHALL show the answer signed "gpt-5 [MCP]" at the server's current time, owned by the service owner

#### Scenario: Missing model
- **WHEN** `model` is empty
- **THEN** the call SHALL be a tool error and nothing SHALL be saved

#### Scenario: No regeneration with an external model
- **WHEN** the UI shows an answer whose `source` is `mcp`
- **THEN** it SHALL NOT offer to regenerate that answer with its model

### Requirement: Delete tools
`delete_paper(paper_id)` SHALL delete a paper with the same cascade and effects as `DELETE /api/papers/:id`. `delete_qa_answer(result_id)` SHALL soft-delete a Q&A answer with the same rules as `DELETE /api/qa/results/:id` (not while active; free answers only by their owner). They SHALL require a personal token or a service with `delete_papers` or `delete_answers` respectively, and SHALL be annotated destructive.

#### Scenario: Delete own answer
- **WHEN** a service with `delete_answers` deletes an answer the owner wrote through `add_paper_qa`
- **THEN** the answer SHALL be hidden from Q&A views like a web deletion

#### Scenario: Other user's free answer
- **WHEN** `delete_qa_answer` targets another user's free answer
- **THEN** it SHALL be a tool error and nothing SHALL change

### Requirement: Q&A attribution in tools
`get_paper_qa` SHALL include each answer's `source` (`mcp`, or null for site-generated answers).

#### Scenario: Attribution visible to agents
- **WHEN** an agent reads Q&A containing an MCP-added answer
- **THEN** the entry SHALL carry `source` `mcp` and the signed `model_name`

### Requirement: Prefer parsed full text
The MCP initialize instructions and the `read_paper` description SHALL tell agents to read papers through `read_paper` instead of fetching arXiv HTML or PDFs themselves, and to use arXiv or `read_pdf_page` with `image=true` only for tables, figures or layout the text does not capture.

#### Scenario: Agent reads a paper
- **WHEN** a client reads the initialize instructions and tool list
- **THEN** both SHALL direct it to `read_paper` for paper text and reserve arXiv for tables and figures

### Requirement: MCP upload attribution
Media stored through `upload_image` SHALL record how it arrived in `images.uploaded_via` as `<app> [MCP]`: the MCP service name for service URLs (e.g. "ChatGPT [MCP]"), "Paperland [MCP]" for Paperland's own agent runs, "API token [MCP]" for personal tokens and "Topic token [MCP]" for Topic tokens. Website and External API uploads SHALL leave it null. The Images page SHALL show it.

#### Scenario: ChatGPT uploads a figure
- **WHEN** a service named "ChatGPT" calls `upload_image`
- **THEN** the stored image SHALL show "via ChatGPT [MCP]" on the Images page

#### Scenario: Internal Q&A agent uploads a figure
- **WHEN** a Paperland Codex Q&A run uploads an image with its agent token
- **THEN** the image SHALL show "via Paperland [MCP]"

### Requirement: List papers of the site or a Topic
`search_papers(query?, topic_id?, limit?, offset?)` SHALL make `query` optional: without it, papers are listed newest first. Without `topic_id` it covers the site's listed papers. With `topic_id` (which the caller must be able to read; a Topic credential is limited to its Topic) it covers the site papers referenced by that Topic, listed or not. Results SHALL include `total_matches`, `offset` and `next_offset` (null at the end). External references of a Topic remain available through `get_topic`.

#### Scenario: List a Topic's papers
- **WHEN** an agent calls `search_papers` with only `topic_id`
- **THEN** it SHALL receive the site papers referenced by that Topic, newest first, with paging fields

#### Scenario: Topic without access
- **WHEN** the caller cannot read the Topic
- **THEN** the call SHALL be a tool error

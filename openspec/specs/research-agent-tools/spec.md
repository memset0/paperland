# research-agent-tools Specification

## Purpose
Exposes tools over the site's own paper data and over Semantic Scholar, plus an image upload tool for agent-drawn figures, as an MCP server authenticated with the users' API tokens: Deep Research rounds use the owner's Codex agent token with all tools, Codex Q&A runs use the requester's agent token with only the image upload tool, and users can connect other MCP clients with their personal tokens.

## Requirements

### Requirement: MCP endpoint
The backend SHALL expose an MCP server at `POST /mcp` using the Streamable HTTP transport without sessions: each POST carries one JSON-RPC message (or a batch) and is answered with `application/json`. It SHALL support `initialize`, `ping`, `tools/list`, and `tools/call`; notifications SHALL be answered with HTTP 202 and no body; unknown methods SHALL return JSON-RPC error `-32601`. `GET` and `DELETE` on `/mcp` SHALL return 405. The endpoint SHALL be reachable from any origin (including through the production reverse proxy); access is controlled only by the bearer token. It is not part of the External API. Every tool except `upload_image` SHALL be read-only and SHALL declare `readOnlyHint: true`; `upload_image` SHALL declare `readOnlyHint: false`, `destructiveHint: false` and `idempotentHint: true`.

#### Scenario: Tool listing
- **WHEN** a client with a valid token posts `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`
- **THEN** the response SHALL list the site tools, the S2 tools and `upload_image`, each with a name, description, JSON Schema input and its annotations

#### Scenario: Tool error is reported as a tool result
- **WHEN** a tool call fails (e.g. unknown paper id or an S2 outage)
- **THEN** the response SHALL be a successful JSON-RPC result with `isError: true` and a text explanation

### Requirement: MCP authentication with API tokens
Every request to `/mcp` SHALL carry `Authorization: Bearer <token>` where the token is a non-revoked row of `api_tokens` of kind `personal` or `agent` whose owning user exists and is active. Missing, unknown, revoked, or ownerless tokens and tokens of inactive (e.g. pending) accounts SHALL receive HTTP 401. Tools SHALL act with the token owner's identity and visibility. No other token store SHALL be used for `/mcp`.

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

### Requirement: Site paper tools
The MCP server SHALL provide:
- `search_papers(query, limit?)`: listed papers whose title, authors, or abstract contain every whitespace-separated term of `query` (case-insensitive), at most `limit` results (default 10, capped by `agent_tools.search_max_results`). Each result SHALL include the paper id, title, up to five authors, year, venue, S2 paperId and CorpusId, arXiv id, whether readable full text exists, whether the paper is in the caller's personal library, and its in-app link `paperland://paper/<id>`.
- `get_paper(paper_id)`: the paper's title, authors, abstract, year, venue, external ids, tags, source link, in-app link, whether it is in the caller's library, and the full-text source and length when available. It SHALL work for any paper id, listed or not.
- `read_paper(paper_id, offset?, max_chars?)`: the paper's full text chosen by `content_priority` (the same text Q&A uses), returning `text`, `offset`, `total_chars`, `source`, and `next_offset` (null at the end). `max_chars` SHALL default to and be capped by `agent_tools.read_max_chars`. With `outline: true` it SHALL instead return the Markdown headings (level, title, character offset) outside code blocks.
- `get_paper_qa(paper_id, max_chars_per_answer?)`: the Q&A entries of the paper visible to the caller under the existing Q&A sharing rules (template entries and free entries whose owner is the caller or shares Q&A), each with its question, entry type, and its latest done, non-deleted answer (model name, completion time, answer truncated to `max_chars_per_answer`, default and cap `agent_tools.qa_answer_max_chars`), newest first, at most 20 entries.

#### Scenario: Read a long paper in pages
- **WHEN** an agent calls `read_paper` with offset 0 on a paper whose text is 50,000 characters and `read_max_chars` is 20,000
- **THEN** it SHALL receive the first 20,000 characters with `next_offset` 20000 and `total_chars` 50000

#### Scenario: Paper without full text
- **WHEN** `read_paper` is called for a paper with no usable text
- **THEN** the result SHALL be a tool error saying the paper has no full text

#### Scenario: Private Q&A is not exposed
- **WHEN** another user's free Q&A entry exists on the paper and that user does not share Q&A
- **THEN** `get_paper_qa` for the caller SHALL NOT include it

### Requirement: Semantic Scholar tools
The MCP server SHALL provide S2 tools that send every request through the backend's Semantic Scholar client (the configured API key, the shared rate gate, and 429/5xx backoff); the API key SHALL never appear in tool input or output:
- `s2_search(query, year?, limit?)`: S2 relevance search, at most `limit` results (default 10, cap 100).
- `s2_match(title)`: S2 title match; returns the best match or `null` when S2 has none.
- `s2_papers(ids)`: metadata for up to `s2_cache.max_ids_per_request` S2 ids through the S2 paper cache resolver (library first, then cache, then one batched fetch), with each paper's in-app link when it is in the library.
- `s2_citations(id, limit?, offset?)` and `s2_references(id, limit?, offset?)`: one page (default 20, cap 100) of citing or cited papers.
- `s2_get(path, params?)`: a GET passthrough to `https://api.semanticscholar.org<path>`. `path` SHALL start with one of `agent_tools.s2_get_path_prefixes` (default `/graph/v1/`) and SHALL NOT contain `..`, a query string, or characters outside a URL-path safe set; otherwise the call SHALL be rejected without contacting S2. The JSON response SHALL be truncated to `agent_tools.s2_get_max_chars`.
Search, match, citation, and reference results SHALL carry each paper's S2 paperId, CorpusId, title, authors, year, venue, and citation count, and SHALL be merged into the `s2_papers` cache (existing non-empty fields are kept when a result omits them).

#### Scenario: Passthrough outside the allowed prefix
- **WHEN** an agent calls `s2_get` with path `/recommendations/v1/papers`
- **THEN** the call SHALL return a tool error and no request SHALL be sent to S2

#### Scenario: Search results are cached
- **WHEN** `s2_search` returns paper P that was not cached
- **THEN** resolving P's paperId afterwards SHALL be answered from the cache without an S2 request

#### Scenario: Calls share the S2 rate limit
- **WHEN** an agent issues several S2 tool calls while the backend also fetches S2 metadata for a paper
- **THEN** all requests SHALL be spaced by the shared `semantic_scholar_service.rate_limit_interval`

### Requirement: Tools and skill for Deep Research rounds
When `agent_tools.enabled` is true, every Deep Research round run on a Codex model SHALL be given the MCP server `paperland` (URL `agent_tools.base_url` + `/mcp`), authenticated with the session owner's Codex agent token (created on demand if missing), passed to the agent process through its environment and never through the prompt or a configuration file, and SHALL have the repository's skill directory (`agent_tools.skills_dir`, containing the S2 literature-search skill) added as an extra skill root for that agent process only. The thread configuration SHALL pre-approve `upload_image` (`tools.upload_image.approval_mode = "approve"` on the `paperland` server) so it can run under `approvalPolicy: never`. The user's global Codex configuration and skill directories SHALL NOT be modified. When `agent_tools.enabled` is false, rounds SHALL run with web search only, as before.

#### Scenario: Round sees the tools and the skill
- **WHEN** a research round starts with agent tools enabled
- **THEN** the agent SHALL be able to list and call the `paperland` tools and SHALL see the `s2-literature-search` skill

#### Scenario: Round uploads a generated figure
- **WHEN** the agent generates an image with `image_gen` and calls `upload_image` with the saved path
- **THEN** the call SHALL run without an approval prompt and return the image URL

#### Scenario: Global Codex config untouched
- **WHEN** research rounds run with agent tools
- **THEN** `CODEX_HOME/config.toml` and the global skill directories SHALL be unchanged

### Requirement: Agent tools configuration
`config.yml` SHALL support an optional `agent_tools` block with `enabled` (default true), `base_url` (default `http://127.0.0.1:3000`), `search_max_results` (default 20), `read_max_chars` (default 20000), `qa_answer_max_chars` (default 4000), `s2_get_path_prefixes` (default `["/graph/v1/"]`), `s2_get_max_chars` (default 20000), and `skills_dir` (default: the repository's `prompts/skills`). When the block or any key is absent, the defaults SHALL apply.

#### Scenario: Defaults without config
- **WHEN** `config.yml` has no `agent_tools` block
- **THEN** agent tools SHALL be enabled with the defaults above

### Requirement: Image upload tool
The MCP server SHALL provide `upload_image(path? | data?, alt?)` that stores one image in the image host through the same path as user uploads (size limit, MIME whitelist, content-addressed dedup), recording the token's user as uploader, and returns `{ url, markdown, width, height, deduped }` where `url` is `/image/<path>` and `markdown` is `![<alt>](<url>)`. Exactly one of `path` and `data` SHALL be given:
- `path` SHALL be accepted only when the caller authenticated with an agent token, and only if its resolved real path lies inside `<codex_home>/generated_images/` of a configured Codex model; any other path SHALL be a tool error and the file SHALL NOT be read.
- `data` (base64 or a `data:` URL) SHALL be accepted for any valid token. `POST /mcp` SHALL accept request bodies large enough for a base64 image at the image host's `max_size_mb` limit.

#### Scenario: Large base64 upload is not rejected by the body limit
- **WHEN** a client sends `upload_image` with a 3 MB `data` argument
- **THEN** the request SHALL reach the tool (HTTP 200 with a tool result), not fail with 413

#### Scenario: Agent uploads a generated image by path
- **WHEN** a Codex run with an agent token calls `upload_image` with `/root/.codex/generated_images/<thread>/<item>.png`
- **THEN** the image SHALL be stored and the result SHALL contain its `/image/...` URL and Markdown

#### Scenario: Path outside the generated-images directory
- **WHEN** `upload_image` is called with `path: "/etc/passwd"` or a path escaping the directory through `..` or a symlink
- **THEN** the result SHALL be a tool error and nothing SHALL be stored

#### Scenario: Personal token cannot upload by path
- **WHEN** an external MCP client with a personal token calls `upload_image` with a `path`
- **THEN** the result SHALL be a tool error; the same client calling with `data` SHALL succeed

### Requirement: Image tool for Q&A runs
When `agent_tools.enabled` is true, every Q&A run on a Codex app-server model SHALL be given the `paperland` MCP server authenticated with the agent token of the user who requested the run (the Result's `requested_by_user_id`), restricted to `upload_image` through the server's `enabled_tools`, with `upload_image` pre-approved as for research rounds. Runs without a requesting user, on other providers, or with agent tools disabled SHALL run without it, as before.

#### Scenario: Q&A run can upload but not search
- **WHEN** a Q&A run starts on a Codex app-server model for a signed-in requester
- **THEN** the agent SHALL see `upload_image` and SHALL NOT see the other `paperland` tools

### Requirement: Figure instruction
Whenever a run is given `upload_image`, a fixed figure instruction (from `prompts/agent/figures.md`, read on every run) SHALL be appended to its system prompt: draw when asked or when a figure clearly helps, using the built-in image generation; state that the built-in preview and diagram code (e.g. Mermaid) are not shown to the reader; upload each figure with `upload_image` (passing the saved file path) and embed the returned Markdown unchanged; never write local file paths or attachment placeholders into the answer and do not copy files into the workspace. Runs without the tool SHALL NOT receive the instruction.

#### Scenario: Instruction only with the tool
- **WHEN** a Q&A run starts with agent tools disabled
- **THEN** its system prompt SHALL NOT contain the figure instruction

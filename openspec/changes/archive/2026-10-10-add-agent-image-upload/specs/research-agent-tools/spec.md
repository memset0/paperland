## MODIFIED Requirements

### Requirement: MCP endpoint
The backend SHALL expose an MCP server at `POST /mcp` using the Streamable HTTP transport without sessions: each POST carries one JSON-RPC message (or a batch) and is answered with `application/json`. It SHALL support `initialize`, `ping`, `tools/list`, and `tools/call`; notifications SHALL be answered with HTTP 202 and no body; unknown methods SHALL return JSON-RPC error `-32601`. `GET` and `DELETE` on `/mcp` SHALL return 405. The endpoint SHALL be reachable from any origin (including through the production reverse proxy); access is controlled only by the bearer token. It is not part of the External API. Every tool except `upload_image` SHALL be read-only and SHALL declare `readOnlyHint: true`; `upload_image` SHALL declare `readOnlyHint: false`, `destructiveHint: false` and `idempotentHint: true`.

#### Scenario: Tool listing
- **WHEN** a client with a valid token posts `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`
- **THEN** the response SHALL list the site tools, the S2 tools and `upload_image`, each with a name, description, JSON Schema input and its annotations

#### Scenario: Tool error is reported as a tool result
- **WHEN** a tool call fails (e.g. unknown paper id or an S2 outage)
- **THEN** the response SHALL be a successful JSON-RPC result with `isError: true` and a text explanation

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

## ADDED Requirements

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

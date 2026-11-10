## MODIFIED Requirements

### Requirement: MCP authentication with API tokens
Every request to `/mcp` SHALL carry `Authorization: Bearer <token>` where the token is a non-revoked row of `api_tokens` of kind `personal`, `agent` or `topic` whose owning user exists and is active. Topic tokens SHALL additionally require current membership in their bound Topic and enforce its scope. Missing, unknown, revoked, ownerless or inactive-account tokens SHALL receive HTTP 401. Tools SHALL act with the token owner's identity and permitted visibility. No other token store SHALL be used for `/mcp`.

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

## ADDED Requirements

### Requirement: Rich image tool results
The MCP endpoint SHALL preserve tool-supplied image content blocks alongside text metadata. Existing text-only tool responses SHALL retain their current shape and error handling.

#### Scenario: PDF screenshot result
- **WHEN** a PDF tool returns a page screenshot and citation metadata
- **THEN** tools/call SHALL contain both an image content block and a text metadata block

### Requirement: Topic tools respect credential scope
The MCP server SHALL expose Topic discovery, creation, content/history reading, repository instructions, membership and credential management, and explicit entry import as appropriate to the caller. Topic-scoped credentials SHALL not create unrelated Topics or grant themselves membership/edit privileges. Site-run Q&A tool restrictions SHALL remain in force.

#### Scenario: Q&A keeps its configured tools
- **WHEN** a Q&A Codex run connects to MCP
- **THEN** its enabled tools SHALL remain restricted as before while its actual calls are counted for its initiating user

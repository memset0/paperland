# Spec Delta

## MODIFIED Requirements

### Requirement: MCP authentication with API tokens
Every request to `/mcp` SHALL carry `Authorization: Bearer <token>` where the token is either the owner's non-revoked `agent` token (used by Paperland's own Codex runs) or the key of a non-revoked Plugins service (see the mcp-services capability), whose owning user exists and is active. Requests to a service URL `/mcp/s/<key>` SHALL instead be authenticated by the key in the path and SHALL NOT need an Authorization header. Missing, unknown, revoked, ownerless or inactive-account tokens on `/mcp` SHALL receive HTTP 401. Tools SHALL act with the owner's identity and permitted visibility, limited by the service's permissions when a service key is used. No other token kind or store SHALL be used for `/mcp`.

#### Scenario: Missing token
- **WHEN** a request to `/mcp` has no `Authorization` header
- **THEN** the response SHALL be 401

#### Scenario: Personal and agent tokens both work
- **WHEN** a user calls `/mcp` with a key that was a personal token before the conversion, or with their agent token
- **THEN** the request SHALL be served as that user

#### Scenario: Topic credential carries scoped identity
- **WHEN** a member calls `/mcp` with a key that was a Topic token before the conversion
- **THEN** tool calls SHALL use that member's identity with their normal account-wide access and Topic permissions, not a single-Topic scope

#### Scenario: Service URL without header
- **WHEN** a client posts to `/mcp/s/<key>` for a valid service with no Authorization header
- **THEN** it SHALL be served as the service owner

#### Scenario: Service key and agent token both work
- **WHEN** a user calls `/mcp` with one of their service keys, or with their agent token
- **THEN** the request SHALL be served as that user

#### Scenario: Reset agent token value stops working
- **WHEN** a user resets their agent token and the previous value is used on `/mcp`
- **THEN** the response SHALL be 401

#### Scenario: Request through the reverse proxy
- **WHEN** a request with a valid token reaches `/mcp` through the production reverse proxy
- **THEN** it SHALL be served like a direct request

### Requirement: Topic tools respect credential scope
The MCP server SHALL expose Topic discovery, creation, content/history reading, repository instructions, membership management, archive state and explicit entry import, according to the caller's Topic permissions and, for services, the service's permissions. It SHALL NOT expose tools that issue, list, rotate or revoke credentials. Credentials are managed only on the Plugins page. Site-run Q&A tool restrictions SHALL remain in force.

#### Scenario: Q&A keeps its configured tools
- **WHEN** a Q&A Codex run connects to MCP
- **THEN** its enabled tools SHALL remain restricted as before while its actual calls are counted for its initiating user

#### Scenario: No credential tools
- **WHEN** a client lists tools with a service key that has every permission
- **THEN** no `list_topic_tokens`, `create_topic_token`, `rotate_topic_token` or `revoke_topic_token` tool SHALL be listed

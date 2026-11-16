# Spec Delta

## Purpose

Lets each user connect MCP clients that cannot send custom headers, such as ChatGPT, through separate per-application service URLs with their own permissions.

## ADDED Requirements

### Requirement: Per-application MCP services
A signed-in user SHALL be able to create named MCP services (name 1–60 characters, e.g. "ChatGPT") with permissions `write` (default true), `delete_papers` (default false) and `delete_answers` (default false). Creation SHALL return the URL `<origin>/mcp/s/<secret>` once; the secret (≥256 random bits) SHALL be stored only hashed.

#### Scenario: Manage own services only
- **WHEN** a user lists, edits, rotates or revokes services
- **THEN** only their own services SHALL be affected, secrets SHALL never be listed, and a rotated URL SHALL be shown once

#### Scenario: Create a ChatGPT service
- **WHEN** a user creates a service named "ChatGPT" with default permissions
- **THEN** they SHALL receive a service URL once, and the service SHALL be listed with write enabled and both delete permissions disabled

#### Scenario: Rotate the URL
- **WHEN** a user rotates a service and a client then uses the old URL
- **THEN** the old URL SHALL be rejected and the new URL SHALL work with the same name and permissions

#### Scenario: Revoke
- **WHEN** a user revokes a service
- **THEN** its URL SHALL be rejected

### Requirement: Service URL authentication
`POST /mcp/s/<secret>` SHALL serve the same MCP protocol as `/mcp` without an `Authorization` header, acting as the service owner with the service's permissions. Unknown, revoked or rotated secrets, and services whose owner is not active, SHALL receive HTTP 404 with no detail. Other methods on the path SHALL receive 405. Paperland's request logs SHALL NOT contain the secret.

#### Scenario: ChatGPT connects with no authentication
- **WHEN** an MCP client posts `initialize` and `tools/list` to a valid service URL with no Authorization header
- **THEN** it SHALL be served as the owner

#### Scenario: Secret not logged
- **WHEN** a request reaches a service URL
- **THEN** the backend's request log line SHALL show the path with the secret redacted

### Requirement: Service permissions
Read tools SHALL be available to every service. Tools that write (paper write tools, `upload_image`, Topic write and administration tools, `add_paper_qa`) SHALL require `write`. `delete_paper` SHALL require `delete_papers`. `delete_qa_answer` SHALL require `delete_answers`. `tools/list` on a service URL SHALL list only the tools its permissions allow, and a call to any other tool SHALL be a tool error that changes nothing. Permission changes SHALL apply to the next request.

#### Scenario: Read-only service
- **WHEN** a service has `write` disabled
- **THEN** its `tools/list` SHALL contain no write or delete tools and a call to `add_paper` SHALL fail without changes

#### Scenario: Delete permission is separate
- **WHEN** a service has `write` enabled but `delete_papers` disabled
- **THEN** `delete_paper` SHALL NOT be listed and a call to it SHALL fail without deleting

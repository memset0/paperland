# mcp-services Specification

## Purpose
Lets each user connect MCP clients that cannot send custom headers, such as ChatGPT, through separate per-application service URLs with their own permissions.

## Requirements

### Requirement: Per-application MCP services
A signed-in user SHALL be able to create named MCP services (name 1–60 characters, e.g. "ChatGPT") with permissions `write` (default true), `delete_papers` (default false) and `delete_answers` (default false). A service SHALL act as its owner across the whole account, with no restriction to particular Topics. Creation and rotation SHALL return the key once, together with the service URL `<origin>/mcp/s/<key>`. The key (≥256 random bits for new keys) SHALL be stored only hashed. Plugins services SHALL be the only kind of credential a user can create for external apps. The Plugins page SHALL be where they are created and managed.

#### Scenario: Manage own services only
- **WHEN** a user lists, edits, rotates or revokes services
- **THEN** only their own services SHALL be affected, keys SHALL never be listed, and a rotated key SHALL be shown once

#### Scenario: Create a ChatGPT service
- **WHEN** a user creates a service named "ChatGPT" with default permissions
- **THEN** they SHALL receive its key and service URL once, and the service SHALL be listed with write enabled and both delete permissions disabled

#### Scenario: Rotate the URL
- **WHEN** a user rotates a service and a client then uses the old key, in the URL or in a header
- **THEN** the old key SHALL be rejected and the new key SHALL work with the same name and permissions

#### Scenario: Revoke
- **WHEN** a user revokes a service
- **THEN** its key SHALL be rejected everywhere it was accepted

#### Scenario: Connection methods shown with a new key
- **WHEN** the Plugins page shows a newly created or rotated key
- **THEN** it SHALL offer the service URL, the `/mcp` URL with an `Authorization: Bearer <key>` header, and the Topic Git usage (the key as the HTTPS password), each copyable

### Requirement: Service URL authentication
`POST /mcp/s/<key>` SHALL serve the same MCP protocol as `/mcp` without an `Authorization` header, acting as the service owner with the service's permissions. `POST /mcp` with `Authorization: Bearer <key>` SHALL behave identically for the same service, so one service works with either method. Unknown, revoked or rotated keys, and services whose owner is not active, SHALL receive HTTP 404 with no detail on the URL form and 401 on the header form. Other methods on the service path SHALL receive 405. Paperland's request logs SHALL NOT contain the key.

#### Scenario: ChatGPT connects with no authentication
- **WHEN** an MCP client posts `initialize` and `tools/list` to a valid service URL with no Authorization header
- **THEN** it SHALL be served as the owner

#### Scenario: Same service through the header
- **WHEN** a client posts to `/mcp` with `Authorization: Bearer <key>` for a service whose `write` is disabled
- **THEN** it SHALL be served as the owner and its `tools/list` SHALL match the service URL's list

#### Scenario: Secret not logged
- **WHEN** a request reaches a service URL
- **THEN** the backend's request log line SHALL show the path with the key redacted

### Requirement: Service permissions
Read tools SHALL be available to every service. Tools that write (paper write tools, `upload_image`, Topic write and administration tools, `add_paper_qa`) SHALL require `write`. `delete_paper` SHALL require `delete_papers`. `delete_qa_answer` SHALL require `delete_answers`. `tools/list` on a service URL SHALL list only the tools its permissions allow, and a call to any other tool SHALL be a tool error that changes nothing. Permission changes SHALL apply to the next request.

#### Scenario: Read-only service
- **WHEN** a service has `write` disabled
- **THEN** its `tools/list` SHALL contain no write or delete tools and a call to `add_paper` SHALL fail without changes

#### Scenario: Delete permission is separate
- **WHEN** a service has `write` enabled but `delete_papers` disabled
- **THEN** `delete_paper` SHALL NOT be listed and a call to it SHALL fail without deleting

### Requirement: Converted legacy tokens
A one-time data migration SHALL convert every non-revoked `personal` token into a service named "API token <id>" and every non-revoked `topic` token into a service named "Topic token <id>". Both SHALL have `write` enabled and both delete permissions disabled, belong to the same owner, and keep accepting the same key value. Plaintext personal keys SHALL be replaced by their hash. Revoked rows SHALL stay revoked. The conversion SHALL be idempotent.

#### Scenario: Zotero keeps working
- **WHEN** a client that used a personal token calls the External API with the same key after the migration
- **THEN** the request SHALL be served as the owner, and the key SHALL appear on the Plugins page as "API token <id>"

#### Scenario: Old Topic Git remote keeps working
- **WHEN** a Git client pushes with a former Topic token as the password after the migration
- **THEN** the push SHALL be authenticated as the owner through the converted service

### Requirement: Topic Git with a service key
Topic Git over HTTPS SHALL accept a service key as the Basic-auth password (any username) for any Topic the service owner can access. Clone and fetch SHALL require viewer access. Push SHALL require editor access, the service's `write` permission and an unarchived Topic. Each published push SHALL record the service as its credential.

#### Scenario: Read-only service cannot push
- **WHEN** a service with `write` disabled pushes to a Topic its owner can edit
- **THEN** the push SHALL be refused with 403 and nothing SHALL be published

#### Scenario: Topic history names the app
- **WHEN** a version was pushed with the "ChatGPT" service's key
- **THEN** the Topic's version history SHALL show it as pushed by the owner via "ChatGPT"

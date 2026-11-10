# mcp-call-counts Specification

## Purpose

Provide durable aggregate MCP tool-call counts attributed to actual users and optional Topic context across interactive, external-agent and site-run agent activity.

## Requirements

### Requirement: Count tool calls across all origins
Every authenticated attempt to call a known MCP tool SHALL increment that user's per-tool aggregate once, including calls from Q&A Codex runs, legacy Research runs and external agents. Both successful and failed tool calls SHALL count. Protocol initialization, listing, notifications and rejected authentication SHALL NOT count as tool invocations.

#### Scenario: Q&A agent invokes MCP
- **WHEN** Codex running for a user's Q&A invokes an MCP tool
- **THEN** the tool call SHALL be attributed to that initiating user without requiring a Topic

#### Scenario: Batch and failure accounting
- **WHEN** one authenticated JSON-RPC batch attempts three known tools and one tool fails
- **THEN** the user's per-tool aggregates SHALL record three attempts in total

### Requirement: User totals and optional Topic subtotals
Calls with authenticated Topic context SHALL also increment that user/Topic's per-tool subtotal as a subset of the user's total. Attribution SHALL use actual authentication context and SHALL NOT depend on client-declared authors or group counts by credential. Rotating or revoking credentials SHALL NOT reset counts.

#### Scenario: Topic and ordinary calls
- **WHEN** a user invokes the same tool twice through a Topic and once through ordinary Q&A
- **THEN** their tool total SHALL be three and the user/Topic subtotal SHALL be two

### Requirement: Durable zero-based aggregates
Aggregate counts SHALL survive service restarts and concurrent increments. Missing counts SHALL read as zero and historical calls SHALL NOT be invented or backfilled. The initial release SHALL store aggregates only, without a per-request traffic ledger, byte-volume statistics or request-body retention.

#### Scenario: No calls yet
- **WHEN** a user or user/Topic has no recorded calls for a tool
- **THEN** the corresponding count SHALL be zero

#### Scenario: Concurrent calls and credential replacement
- **WHEN** concurrent calls finish and a credential is then replaced
- **THEN** every recorded attempt SHALL remain in the same user and optional Topic aggregates after restart

### Requirement: Private count access
Users SHALL read their own totals and permitted user/Topic subtotals. Counting SHALL NOT expose private research content or another user's global activity through a shared Topic.

#### Scenario: Read shared Topic counts
- **WHEN** a Topic member reads usage through the Topic
- **THEN** they SHALL NOT receive another member's unrelated global MCP counts

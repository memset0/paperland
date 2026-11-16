# Spec Delta

## Purpose

Lets the developer repeatedly check the design of Paperland's MCP tool surface with the same measured inputs, checklist and report format, so results are comparable over time.

## ADDED Requirements

### Requirement: On-demand review procedure
The repository SHALL provide an MCP design review procedure that a coding agent runs whenever the developer asks for it, invoked in Claude Code as `/mcp-review` and referenced from `AGENTS.md` for other agents. The procedure SHALL be read-only toward MCP behavior: it SHALL NOT change tools, descriptions, schemas or permissions. Any finding that needs a behavior change SHALL be presented as a candidate OpenSpec change for the developer to select.

#### Scenario: Developer asks for a review
- **WHEN** the developer invokes `/mcp-review` or asks an agent to check the MCP design
- **THEN** the agent follows the procedure, writes a dated report and summarizes the findings without editing MCP implementation files

#### Scenario: Finding needs a behavior change
- **WHEN** a finding recommends merging, removing or changing a tool
- **THEN** the report lists it as a candidate change and the agent asks the developer which candidates to propose instead of implementing them

### Requirement: Offline measured inventory
The repository SHALL provide an inventory command that serves the real MCP request handler against a disposable local database and reports exactly what clients receive from `initialize` and `tools/list` for each token kind: tool names, descriptions, input schemas, annotations, plus character counts for each tool and the total. The command SHALL NOT read or write the production database, contact external services or need a running server.

#### Scenario: Inventory runs offline
- **WHEN** the inventory command runs on a machine without network access to Semantic Scholar or doc2x
- **THEN** it completes and prints the tool surface and size totals, and the production database is untouched

#### Scenario: Inventory matches the wire format
- **WHEN** a tool's description or schema changes in code
- **THEN** the next inventory output shows the changed text and size without manual edits to the review procedure

### Requirement: Fixed review checklist
Every review SHALL evaluate the same dimensions: redundant or mergeable tools; description quality and size; parameter naming and schema consistency; token-kind and permission boundaries; tool annotations; response size and pagination; error, not-ready and fallback guidance; and compatibility with ChatGPT custom MCP connectors, Claude and Codex clients. Each finding SHALL cite the tools involved and the evidence from the inventory or source.

#### Scenario: Every dimension is reported
- **WHEN** a review finds no problem in a dimension
- **THEN** the report still lists that dimension with "No findings" rather than omitting it

### Requirement: Comparable dated reports
Each review SHALL be saved as `docs/mcp-reviews/YYYY-MM-DD.md` using a fixed structure: inventory summary with totals, findings grouped by checklist dimension with severity and a stable id, candidate changes, and a comparison with the most recent earlier report that marks findings as new, persisting or resolved. A finding that persists SHALL keep its id.

#### Scenario: Second review compares to the first
- **WHEN** a review runs after an earlier report exists
- **THEN** the new report marks each earlier finding as persisting or resolved, keeps ids of persisting findings, and gives the change in total tool count and description size

#### Scenario: Same-day rerun
- **WHEN** a report for today already exists
- **THEN** the review writes a suffixed file (for example `YYYY-MM-DD-2.md`) instead of overwriting it

# Spec Delta

## MODIFIED Requirements

### Requirement: Topic archive tool
The MCP server SHALL provide `set_topic_archived(topic_id, archived)` for the Topic owner using a Plugins service with `write`. It SHALL return the updated Topic summary. `get_topic`, `list_topics` and `list_archived_topics` results SHALL include `archived_at`. `list_topics` SHALL list only Topics that are not archived. `list_archived_topics` SHALL list the archived Topics the caller can read.

#### Scenario: Owner archives through MCP
- **WHEN** the owner's ChatGPT service calls `set_topic_archived` with `archived` true
- **THEN** the Topic SHALL be archived, it SHALL disappear from `list_topics`, and `list_archived_topics` SHALL report it with its `archived_at`

#### Scenario: Topic credential refused
- **WHEN** a read-only service or the internal agent token calls `set_topic_archived`
- **THEN** the call SHALL be a tool error and the state SHALL not change

## ADDED Requirements

### Requirement: Workspace overview on initialize
The `initialize` instructions SHALL end with a per-user workspace overview computed at request time: the caller's readable active Topics (archived excluded, at most 20, with a note when more exist) and the 5 papers most recently added to the caller's paper list. It SHALL name the tools for more: `list_topics`, `list_archived_topics` and `search_papers`.

#### Scenario: ChatGPT connects
- **WHEN** a service whose owner has 4 active Topics, 1 archived Topic and 30 papers in their list sends `initialize`
- **THEN** the instructions SHALL list the 4 active Topics (id, title, page and reference counts, last update) and the 5 most recently added papers (id, title, date added), and SHALL NOT list the archived Topic

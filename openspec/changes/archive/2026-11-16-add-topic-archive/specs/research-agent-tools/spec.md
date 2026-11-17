# Spec Delta

## ADDED Requirements

### Requirement: Topic archive tool
The MCP server SHALL provide `set_topic_archived(topic_id, archived)` for the Topic owner with a personal token or an MCP service with `write`. It SHALL return the updated Topic summary. `list_topics` and `get_topic` results SHALL include `archived_at`. Topic credentials SHALL NOT change the archive state.

#### Scenario: Owner archives through MCP
- **WHEN** the owner's ChatGPT service calls `set_topic_archived` with `archived` true
- **THEN** the Topic SHALL be archived and `list_topics` SHALL report its `archived_at`

#### Scenario: Topic credential refused
- **WHEN** a Topic credential calls `set_topic_archived`
- **THEN** the call SHALL be a tool error and the state SHALL not change

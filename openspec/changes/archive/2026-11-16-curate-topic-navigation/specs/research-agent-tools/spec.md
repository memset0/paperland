## ADDED Requirements

### Requirement: Topic schema discovery
MCP initialize and Topic tool descriptions SHALL direct maintainers to get_topic_schema. That read-only tool SHALL return the current or requested supported schema contract, including reports.yml, global references, frontmatter, workspace rules and migration steps. get_topic SHALL include the selected commit's schema status and applicable contract. Calls SHALL retain existing authentication, scope and counting behavior.

#### Scenario: Agent learns the contract
- **WHEN** a Topic-token client initializes MCP and calls get_topic_schema
- **THEN** it SHALL receive schema v1 examples and legacy migration guidance without another user's private content

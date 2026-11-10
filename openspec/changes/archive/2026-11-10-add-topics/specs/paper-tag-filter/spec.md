## ADDED Requirements

### Requirement: Topic directory filtering
GET /api/papers SHALL accept topic_id and optional topic_node_id, with matching URL-persisted frontend controls. The root SHALL match every linked paper in the current Topic and a directory SHALL match that node and descendants. Filters SHALL combine with existing search, personal-library scope and manual tag filters; inaccessible Topic filters SHALL disclose no data.

#### Scenario: Filter a shared subtree
- **WHEN** a member selects a Topic directory
- **THEN** the paper list SHALL include matching papers in that subtree subject to the other selected filters
- **AND** the URL SHALL preserve the Topic and stable directory IDs

#### Scenario: Filter another user's private Topic
- **WHEN** a non-member supplies its ID to the paper list API
- **THEN** no papers or directory metadata from that Topic SHALL be disclosed

### Requirement: Clickable Topic root badges
Paper list/detail SHALL display accessible Topic root badges separately from editable manual tags. Clicking a root badge SHALL open the paper list filtered to that Topic and allow hierarchical refinement.

#### Scenario: Open a Topic filter from a paper
- **WHEN** a reader clicks a paper's Topic root badge
- **THEN** the paper list SHALL apply that Topic's root filter without selecting every directory badge

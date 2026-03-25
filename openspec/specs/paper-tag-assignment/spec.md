# paper-tag-assignment Specification

## Purpose
Assigning tags to papers via manual add dialog and Internal API, with denormalized tags_json kept in sync.

## Requirements

### Requirement: Manual paper add includes tag selector
The manual paper add dialog SHALL include a tag selector allowing users to choose existing tags or create new ones.

#### Scenario: Select existing tags during manual add
- **WHEN** user adds a paper manually and selects existing tags from the tag selector
- **THEN** the paper is created with those tags associated

#### Scenario: Create new tag during manual add
- **WHEN** user types a new tag name in the tag selector input
- **THEN** the system creates the new tag (with random color) and associates it with the paper

#### Scenario: Add paper without tags
- **WHEN** user adds a paper manually and does not select any tags
- **THEN** the paper is created without any tags

#### Scenario: arXiv import does not prompt for tags
- **WHEN** user adds a paper via arXiv ID
- **THEN** the system does NOT prompt for tag selection

#### Scenario: Corpus ID import does not prompt for tags
- **WHEN** user adds a paper via Corpus ID
- **THEN** the system does NOT prompt for tag selection

### Requirement: Internal API for paper tag operations
The system SHALL provide Internal API endpoints for managing tags on individual papers.

#### Scenario: Get paper tags
- **WHEN** `GET /api/papers/:id/tags` is called
- **THEN** the system returns the paper's tags as array of `{id, name, color}`

#### Scenario: Set paper tags (replace)
- **WHEN** `PUT /api/papers/:id/tags` is called with `{ tags: string[] }`
- **THEN** the system replaces all paper tags, creating new tags as needed, and updates papers.tags_json

#### Scenario: Add/remove paper tags
- **WHEN** `PATCH /api/papers/:id/tags` is called with `{ add?: string[], remove?: string[] }`
- **THEN** the system adds/removes specified tags, creating new tags as needed, and updates papers.tags_json

### Requirement: Paper tags_json stays in sync
The `papers.tags_json` field SHALL always reflect the current state of `paper_tags` for that paper.

#### Scenario: Sync on tag add
- **WHEN** a tag is added to a paper
- **THEN** the paper's tags_json is updated to include the new tag's id and name

#### Scenario: Sync on tag remove
- **WHEN** a tag is removed from a paper
- **THEN** the paper's tags_json is updated to exclude the removed tag

#### Scenario: Sync on tag rename
- **WHEN** a tag is renamed
- **THEN** all papers with that tag have their tags_json updated with the new name

#### Scenario: Sync on tag merge
- **WHEN** two tags are merged
- **THEN** all affected papers have their tags_json updated to reflect the merge

#### Scenario: Sync on tag delete
- **WHEN** a tag is deleted
- **THEN** all papers that had that tag have their tags_json updated to remove it

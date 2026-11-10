# paper-tag-filter Specification

## Purpose
Tag-based filtering of the paper list, including multi-tag AND filtering, URL persistence, clickable tags, and colored badge display.

## Requirements

### Requirement: Paper list supports tag filtering
The paper list page SHALL support filtering papers by one or more tags.

#### Scenario: Filter by single tag
- **WHEN** user selects a tag filter on the paper list page
- **THEN** only papers associated with that tag are displayed

#### Scenario: Filter by multiple tags
- **WHEN** user selects multiple tag filters
- **THEN** only papers associated with ALL selected tags are displayed (AND logic)

#### Scenario: Clear tag filter
- **WHEN** user clears the tag filter
- **THEN** all papers are displayed (respecting other active filters like search)

#### Scenario: Tag filter reflected in URL
- **WHEN** user applies tag filters
- **THEN** the selected tag IDs are stored in URL query parameters (e.g., `?tags=1,2`)

### Requirement: Backend supports tag filter parameter
The `GET /api/papers` endpoint SHALL accept a `tag_ids` query parameter for filtering.

#### Scenario: API filter by tags
- **WHEN** `GET /api/papers?tag_ids=1,2` is called
- **THEN** the system returns only papers that have ALL specified tags

#### Scenario: API no tag filter
- **WHEN** `GET /api/papers` is called without `tag_ids`
- **THEN** the system returns papers without tag filtering (existing behavior)

### Requirement: Paper detail tags are clickable
Tags displayed on the paper detail page SHALL be clickable, navigating to the paper list filtered by that tag.

#### Scenario: Click tag on paper detail
- **WHEN** user clicks a tag on the paper detail page
- **THEN** the system navigates to the paper list page with that tag applied as a filter (e.g., `/?tags=3`)

### Requirement: Tags displayed in paper list
The paper list page SHALL display each paper's tags as colored badges.

#### Scenario: Paper with tags in list
- **WHEN** a paper has tags and is displayed in the paper list
- **THEN** colored tag badges are shown for each tag

#### Scenario: Paper without tags in list
- **WHEN** a paper has no tags and is displayed in the paper list
- **THEN** no tag badges are shown (no empty placeholder)

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

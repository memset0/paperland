## ADDED Requirements

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

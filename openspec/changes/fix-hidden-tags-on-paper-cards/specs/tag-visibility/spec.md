## MODIFIED Requirements

### Requirement: Paper list filters by tag visibility
The paper list page's tag filter bar SHALL only display tags where `visible` is `true`. Additionally, paper cards in the paper list SHALL only display tags where `visible` is `true`.

#### Scenario: Hidden tag not shown in filter bar
- **WHEN** a tag has `visible = false`
- **THEN** the tag SHALL NOT appear in the paper list's tag filter bar

#### Scenario: Visible tag shown in filter bar
- **WHEN** a tag has `visible = true`
- **THEN** the tag SHALL appear in the paper list's tag filter bar

#### Scenario: Hidden tag not shown on paper cards in list
- **WHEN** a paper is assigned a tag with `visible = false`
- **THEN** the tag SHALL NOT be displayed on the paper's card in the paper list view

#### Scenario: Visible tag shown on paper cards
- **WHEN** a paper is assigned a tag with `visible = true`
- **THEN** the tag SHALL be displayed on the paper's card in the paper list view

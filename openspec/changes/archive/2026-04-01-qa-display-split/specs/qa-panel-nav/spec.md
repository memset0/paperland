## MODIFIED Requirements

### Requirement: Sidebar navigation entry list
The sidebar quick-jump navigation SHALL display entries in this order: template QA entries with results first, then all free QA entries. Template QA entries that have no generated results (no results array or empty results) SHALL be excluded from the navigation.

#### Scenario: Template questions with mixed result status
- **WHEN** there are 5 template questions but only 3 have generated results, plus 2 free QA entries
- **THEN** the sidebar shows 5 navigation dots: 3 for completed template questions, then 2 for free questions

#### Scenario: No template questions have results
- **WHEN** no template questions have generated results but free QA entries exist
- **THEN** the sidebar shows only free QA entry dots

#### Scenario: All template questions have results
- **WHEN** all template questions have results and free QA entries also exist
- **THEN** the sidebar shows template entries first, then free entries

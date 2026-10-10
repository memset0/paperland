## MODIFIED Requirements

### Requirement: Frontend sort controls
The paper list page SHALL display sort controls allowing the user to select the sort field and order. The default sort mode SHALL be "Last modified" (`updated_at` desc).

#### Scenario: Sort dropdown displays current mode
- **WHEN** the paper list page is loaded for the first time
- **THEN** a sort control SHALL be visible showing "Last modified" as the default sort mode

#### Scenario: User switches sort mode
- **WHEN** the user selects a different sort mode from the sort control
- **THEN** the paper list SHALL re-fetch with the corresponding `sort_by` and `sort_order=desc` parameters

#### Scenario: Sort persists across pagination
- **WHEN** the user has selected a sort mode and navigates to another page
- **THEN** the same sort parameters SHALL be applied to the paginated request

### Requirement: Both date columns always visible
The paper list table SHALL always display both "Date added" (`created_at`) and "Last modified" (`updated_at`) columns simultaneously.

#### Scenario: Both dates shown in table
- **WHEN** the paper list is displayed
- **THEN** the table SHALL have a "Date added" column showing each paper's `created_at` AND a "Last modified" column showing each paper's `updated_at`

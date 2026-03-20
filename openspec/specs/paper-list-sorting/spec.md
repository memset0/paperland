# paper-list-sorting Specification

## Purpose
Paper list sorting functionality — API sort parameters, frontend sort controls, dynamic date column, and author text truncation.

## Requirements

### Requirement: API sort parameters
The `GET /api/papers` endpoint SHALL accept `sort_by` and `sort_order` query parameters to control result ordering.

#### Scenario: Default sort is created_at descending
- **WHEN** `GET /api/papers` is called without sort parameters
- **THEN** results SHALL be ordered by `created_at` descending (newest first)

#### Scenario: Sort by updated_at descending
- **WHEN** `GET /api/papers?sort_by=updated_at&sort_order=desc` is called
- **THEN** results SHALL be ordered by `updated_at` descending (most recently modified first)

#### Scenario: Sort ascending
- **WHEN** `GET /api/papers?sort_by=created_at&sort_order=asc` is called
- **THEN** results SHALL be ordered by `created_at` ascending (oldest first)

#### Scenario: Invalid sort_by value
- **WHEN** `GET /api/papers?sort_by=invalid_field` is called
- **THEN** the system SHALL fall back to the default sort (`created_at` descending)

### Requirement: Frontend sort controls
The paper list page SHALL display sort controls allowing the user to select the sort field and order.

#### Scenario: Sort dropdown displays current mode
- **WHEN** the paper list page is loaded
- **THEN** a sort control SHALL be visible showing the current sort mode (default: "添加时间" / created_at desc)

#### Scenario: User switches to updated_at sort
- **WHEN** the user selects "最近修改" from the sort control
- **THEN** the paper list SHALL re-fetch with `sort_by=updated_at&sort_order=desc` and display papers ordered by most recently modified first

#### Scenario: Sort persists across pagination
- **WHEN** the user has selected a sort mode and navigates to another page
- **THEN** the same sort parameters SHALL be applied to the paginated request

### Requirement: Date column shows relevant timestamp
The paper list table SHALL display the timestamp corresponding to the current sort mode.

#### Scenario: Sorted by created_at shows creation date
- **WHEN** the paper list is sorted by `created_at`
- **THEN** the date column header SHALL show "添加日期" and display each paper's `created_at`

#### Scenario: Sorted by updated_at shows modification date
- **WHEN** the paper list is sorted by `updated_at`
- **THEN** the date column header SHALL show "修改日期" and display each paper's `updated_at`

### Requirement: Author column text truncation
The author column in the paper list table SHALL truncate long text with an ellipsis instead of wrapping to multiple lines.

#### Scenario: Long author name is truncated
- **WHEN** a paper's formatted author string exceeds the column width
- **THEN** the text SHALL be truncated with an ellipsis (`...`) and the row height SHALL remain consistent with other rows

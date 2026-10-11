# paper-list-sorting Specification

## Purpose
Adds configurable sort options (created_at, updated_at) with sort order to the paper list API and UI, with localStorage persistence and both date columns always visible.

## Requirements

### Requirement: API sort parameters
The `GET /api/papers` endpoint SHALL accept `sort_by` and `sort_order` query parameters to control result ordering.

#### Scenario: Default sort is updated_at descending
- **WHEN** `GET /api/papers` is called without sort parameters
- **THEN** results SHALL be ordered by `updated_at` descending (most recently modified first)

#### Scenario: Sort by created_at descending
- **WHEN** `GET /api/papers?sort_by=created_at&sort_order=desc` is called
- **THEN** results SHALL be ordered by `created_at` descending (newest first)

#### Scenario: Sort ascending
- **WHEN** `GET /api/papers?sort_by=created_at&sort_order=asc` is called
- **THEN** results SHALL be ordered by `created_at` ascending (oldest first)

#### Scenario: Invalid sort_by value
- **WHEN** `GET /api/papers?sort_by=invalid_field` is called
- **THEN** the system SHALL fall back to the default sort (`updated_at` descending)

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

### Requirement: Sort preference persisted in localStorage
The user's sort preference SHALL be persisted in the browser's localStorage so it survives page refreshes and browser restarts.

#### Scenario: Sort preference saved on change
- **WHEN** the user selects a sort mode from the dropdown
- **THEN** the `sort_by` and `sort_order` values SHALL be saved to localStorage keys `paperland_sort_by` and `paperland_sort_order`

#### Scenario: Sort preference restored on load
- **WHEN** the paper list page is loaded and localStorage contains a saved sort preference
- **THEN** the store SHALL initialize with the saved `sort_by` and `sort_order` values

#### Scenario: No saved preference uses default
- **WHEN** the paper list page is loaded and localStorage has no saved sort preference
- **THEN** the store SHALL default to `updated_at` descending

### Requirement: Both date columns always visible
The paper list table SHALL always display both "Date added" (`created_at`) and "Last modified" (`updated_at`) columns simultaneously.

#### Scenario: Both dates shown in table
- **WHEN** the paper list is displayed
- **THEN** the table SHALL have a "Date added" column showing each paper's `created_at` AND a "Last modified" column showing each paper's `updated_at`

### Requirement: Author column text truncation
The author column in the paper list table SHALL truncate long text with an ellipsis instead of wrapping to multiple lines.

#### Scenario: Long author name is truncated
- **WHEN** a paper's formatted author string exceeds the column width
- **THEN** the text SHALL be truncated with an ellipsis (`...`) and the row height SHALL remain consistent with other rows

### Requirement: Sort by library added time
`GET /api/papers` SHALL accept `sort_by=added_at`. For a signed-in caller in the Mine scope it SHALL order results by when the caller added each paper to their library (`sort_order` applies, default descending, ties broken by paper id). For anonymous callers or `scope=all`, `added_at` SHALL fall back to ordering by `created_at`. Every list item SHALL include `added_at`: the ISO time the caller added the paper to their library, or `null` when the paper is not in the caller's library or the caller is anonymous.

#### Scenario: Recently added first
- **WHEN** a signed-in user who added paper 7 today and paper 3 last week calls `GET /api/papers?sort_by=added_at`
- **THEN** paper 7 SHALL come before paper 3, and both items SHALL carry their `added_at` times

#### Scenario: Site-wide scope falls back
- **WHEN** a signed-in user calls `GET /api/papers?scope=all&sort_by=added_at`
- **THEN** results SHALL be ordered by `created_at` descending, and papers outside the user's library SHALL have `added_at: null`

# vuetify-ui Specification

## Purpose
TBD - created by archiving change vuetify-migration. Update Purpose after archive.
## Requirements
### Requirement: Vuetify framework integration
The frontend SHALL use Vuetify 3 as the UI component framework with Material Design Icons.

#### Scenario: Vuetify loaded
- **WHEN** the frontend app starts
- **THEN** Vuetify components and MDI icons SHALL be available globally

### Requirement: Navigation bar
The app SHALL have a Vuetify v-app-bar with the app title and navigation links to all pages.

#### Scenario: Navigation display
- **WHEN** the user loads any page
- **THEN** a top app bar SHALL display with links: 论文管理, Q&A, 服务管理, 设置

### Requirement: Paper list with data table
The paper list page SHALL use v-data-table-server for paginated, searchable paper display.

#### Scenario: Paper list display
- **WHEN** the user visits the paper list page
- **THEN** papers SHALL be displayed in a Vuetify data table with columns for title, authors, arxiv_id, corpus_id, and date

### Requirement: Add paper dialog
Adding a paper SHALL use a v-dialog with tabbed input (arxiv_id / corpus_id / manual).

#### Scenario: Add paper form
- **WHEN** the user clicks the add button
- **THEN** a dialog SHALL open with three tabs for different input methods


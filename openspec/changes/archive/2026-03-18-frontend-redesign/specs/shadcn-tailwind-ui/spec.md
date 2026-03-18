## ADDED Requirements

### Requirement: Tailwind CSS integration
The frontend SHALL use Tailwind CSS for all styling, replacing Vuetify.

#### Scenario: Tailwind loaded
- **WHEN** the frontend starts
- **THEN** Tailwind utility classes SHALL be available and applied

### Requirement: Sidebar navigation
The app SHALL have a left sidebar with icon+label navigation links to all pages, with a collapsible state.

#### Scenario: Navigate via sidebar
- **WHEN** the user clicks a sidebar link
- **THEN** the corresponding page SHALL load in the main content area

### Requirement: Paper list with search and pagination
The paper list SHALL display papers in a clean table with search, pagination, and an add-paper dialog.

#### Scenario: Paper list display
- **WHEN** the user visits /
- **THEN** papers SHALL be displayed in a styled table with hover states

### Requirement: Settings page with token management
The settings page SHALL display API tokens in a table with issue/revoke functionality.

#### Scenario: Token management
- **WHEN** the user visits /settings
- **THEN** tokens SHALL be displayed with status badges and action buttons

### Requirement: Service dashboard with live status
The service dashboard SHALL show service cards and execution history with filters.

#### Scenario: Service monitoring
- **WHEN** the user visits /services
- **THEN** registered services SHALL appear as status cards and execution history SHALL be filterable

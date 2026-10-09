## MODIFIED Requirements

### Requirement: Shared page layout component

The frontend SHALL provide a shared `AppPage` layout component (`packages/frontend/src/components/AppPage.vue`) that all "management" views use as their outermost wrapper. The component SHALL own the page title and the content width so individual views no longer hand-roll their own page header or width wrapper.

`AppPage` SHALL expose:
- a `title` prop (string) for the in-page title, defaulting to the current route's `meta.title`;
- an `icon` prop (component) for the icon shown to the left of the title, defaulting to the current route's `meta.icon`;
- a `full` prop (boolean) selecting full-bleed width when true and a centered constrained width when false (default);
- a `fill` prop (boolean) selecting a full-height internal-scroll layout when true and normal document flow when false (default);
- a default slot for page content;
- an `actions` slot rendered to the right of the title.

#### Scenario: Management view uses AppPage

- **WHEN** a management view (Papers, Research list, Tags, Q&A, Notes, Services, Settings) renders
- **THEN** its outermost element SHALL be `AppPage`
- **AND** the view SHALL NOT render its own page-level width wrapper, `<h1>` title, leading title icon, or description paragraph

#### Scenario: Action controls projected into the header

- **WHEN** a view provides an `actions` slot (e.g. an "Add paper" or "New research" button)
- **THEN** `AppPage` SHALL render those controls right-aligned on the same row as the title

### Requirement: Unified title rendering

`AppPage` SHALL render the page title at a consistent position (top of the content area) and a consistent size (`text-xl font-semibold`) across all pages, preceded by the page's corresponding icon to its left. The icon SHALL default to the current route's `meta.icon` (the same icon the sidebar uses for that page) and SHALL be overridable via an `icon` prop. The title SHALL NOT be accompanied by a description/subtitle paragraph. When no `title` prop is given, the title text SHALL be the current route's English `meta.title` (matching the sidebar label and the browser tab title).

#### Scenario: Title sourced from route meta

- **WHEN** a view renders `AppPage` without a `title` prop on a route whose `meta.title` is `Tags`
- **THEN** the in-page title SHALL read `Tags`

#### Scenario: Corresponding icon to the left of the title

- **WHEN** a management page renders inside `AppPage`
- **THEN** its title SHALL be preceded, on its left, by the icon defined for that route (`meta.icon`)
- **AND** that icon SHALL be the same one the sidebar navigation uses for that page (e.g. `Tag` for Tags, `Telescope` for Research, `FileText` for Papers)

#### Scenario: Consistent title across pages

- **WHEN** the user navigates between management pages
- **THEN** each page's title SHALL appear at the same position with the same font size and weight, each preceded by its corresponding icon
- **AND** no management page SHALL show a description/subtitle line beneath the title

### Requirement: Content width policy

`AppPage` SHALL constrain content to a centered maximum width of `max-w-5xl` (1024px) by default. When the `full` prop is true, `AppPage` SHALL impose no maximum width and let content occupy the full available page width.

#### Scenario: Constrained management page

- **WHEN** a constrained management page (e.g. Tags, Settings, Services, Notes) renders on a wide viewport
- **THEN** its content SHALL be centered and capped at `max-w-5xl`

#### Scenario: Full-width management page

- **WHEN** the Papers page (`/`) renders on a wide viewport
- **THEN** `AppPage` SHALL be used with `full` enabled so the paper table occupies the full page width with no maximum width constraint

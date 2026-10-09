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

- **WHEN** a management view (Papers, Tags, Q&A, Notes, Conferences list, Conference detail, Services, Settings) renders
- **THEN** its outermost element SHALL be `AppPage`
- **AND** the view SHALL NOT render its own page-level width wrapper, `<h1>` title, leading title icon, or description paragraph

#### Scenario: Action controls projected into the header

- **WHEN** a view provides an `actions` slot (e.g. an "Add paper" or "New conference" button)
- **THEN** `AppPage` SHALL render those controls right-aligned on the same row as the title

### Requirement: Content width policy

`AppPage` SHALL constrain content to a centered maximum width of `max-w-5xl` (1024px) by default. When the `full` prop is true, `AppPage` SHALL impose no maximum width and let content occupy the full available page width.

#### Scenario: Constrained management page

- **WHEN** a constrained management page (e.g. Tags, Settings, Services, Notes, Conferences list, Conference detail) renders on a wide viewport
- **THEN** its content SHALL be centered and capped at `max-w-5xl`

#### Scenario: Full-width management page

- **WHEN** the Papers page (`/`) renders on a wide viewport
- **THEN** `AppPage` SHALL be used with `full` enabled so the paper table occupies the full page width with no maximum width constraint

## REMOVED Requirements

### Requirement: Detail pages keep their own layout
**Reason**: 该需求同时约束 Idea Forge 工作区（`/idea-forge/:projectName`），该页面随 Idea Forge 一并移除。
**Migration**: 论文详情部分由新需求 "Paper detail keeps its own layout" 原样承接。

## ADDED Requirements

### Requirement: Paper detail keeps its own layout

Single-entity detail pages SHALL NOT use `AppPage`. Paper detail (`/papers/:id`) SHALL keep its own full-width, self-managed layouts and chrome (e.g. back button, split view), and SHALL NOT display the unified management title bar. Its existing behavior — including PaperDetail's embed and narrow-viewport rendering — SHALL remain unchanged.

#### Scenario: Paper detail is full width with its own chrome

- **WHEN** the user opens a paper detail page on a wide viewport
- **THEN** the page SHALL render full width using its own layout
- **AND** it SHALL NOT show a management-style title bar sourced from route meta
- **AND** its embed-mode and narrow-viewport widths SHALL be unchanged


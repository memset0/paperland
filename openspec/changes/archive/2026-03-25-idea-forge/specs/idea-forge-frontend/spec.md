## ADDED Requirements

### Requirement: Project list page
The system SHALL display a page at `/idea-forge` listing all workspace projects as cards. Each card shows project name, idea count, and paper count. Clicking a card navigates to the project's idea management page.

#### Scenario: View project list
- **WHEN** user navigates to `/idea-forge`
- **THEN** a grid of project cards is displayed, each showing name, idea count, paper count

#### Scenario: Create new project
- **WHEN** user clicks the "New Project" button and enters a project name
- **THEN** a new project is created via the API and appears in the list

#### Scenario: No projects exist
- **WHEN** no projects exist
- **THEN** an empty state with a prompt to create a new project is shown

### Requirement: Navigation entry
The system SHALL add "Idea Forge" to the main sidebar navigation, positioned after existing menu items.

#### Scenario: Navigate to Idea Forge
- **WHEN** user clicks "Idea Forge" in the sidebar
- **THEN** the browser navigates to `/idea-forge`

### Requirement: Three view modes
The system SHALL provide three view modes for the idea management page: inbox, kanban, and list. The active view mode SHALL be stored in the URL query parameter `?view=inbox|kanban|list`. Default view is `inbox`.

#### Scenario: Switch between views
- **WHEN** user clicks a view mode toggle button (inbox/kanban/list)
- **THEN** the URL updates with the new view parameter and the layout changes accordingly

#### Scenario: Default view
- **WHEN** user navigates to `/idea-forge/:projectName` without a `view` param
- **THEN** inbox view is shown by default

### Requirement: Inbox view
The system SHALL display ideas in a two-panel split layout. Left panel shows a scrollable idea list with: idea name, summary (as preview), `my_score` display, `create_time`/`update_time`, and category badge. Right panel shows the selected idea's full detail.

#### Scenario: Select idea in inbox
- **WHEN** user clicks an idea in the left panel list
- **THEN** the right panel displays the selected idea's full content, comment box, and action buttons

#### Scenario: Inbox default filter
- **WHEN** inbox view loads with no explicit filter
- **THEN** ideas are filtered to `category=unreviewed` by default and sorted by `update_time` descending

### Requirement: Idea detail panel
The right panel of inbox view (and the detail opened from kanban) SHALL display:
1. A fixed top section with: editable `my_comment` textarea (starts at 3 rows, auto-grows, max 50% viewport height), score input for `my_score` (0-5), `llm_score` display (read-only), category quick-switch buttons, and a save button
2. A scrollable bottom section with: `summary` (editable inline), idea body content rendered as Markdown (editable), and idea metadata (tags, timestamps)

#### Scenario: Edit comment
- **WHEN** user types in the `my_comment` textarea
- **THEN** the textarea auto-grows up to 50% viewport height and the change is saved on blur or Ctrl+S

#### Scenario: Rate idea
- **WHEN** user clicks a score value (0-5) in the score input
- **THEN** `my_score` is updated and saved immediately via API

#### Scenario: Quick category switch
- **WHEN** user clicks a category button (unreviewed / under-review / validating / archived)
- **THEN** the idea is moved to that category via the move API and the list refreshes

### Requirement: Kanban view
The system SHALL display ideas in a horizontal board with one column per category: `unreviewed`, `under-review`, `validating`, `archived`. Each column contains idea cards showing name, summary, `my_score`, and timestamp.

#### Scenario: View kanban board
- **WHEN** kanban view is active
- **THEN** four columns are displayed, each with its category name as header and idea cards within

#### Scenario: Drag idea between columns
- **WHEN** user drags an idea card from one column to another
- **THEN** the idea is moved to the target category via the move API
- **AND** the card appears in the new column sorted by the current active sort order (default: `update_time`, user-changeable)

#### Scenario: Click idea card in kanban
- **WHEN** user clicks an idea card title in kanban view
- **THEN** the view switches to inbox mode with that idea selected and scrolled to in the list

#### Scenario: Column horizontal scroll
- **WHEN** the total width of all columns exceeds the viewport
- **THEN** the board is horizontally scrollable
- **AND** each column has a minimum width of 280px

### Requirement: List view
The system SHALL display ideas in a flat table with columns: name (with tags displayed below the title in the same column), category, summary (up to 5 lines, truncated with ellipsis), `my_score`, `llm_score`, author, `create_time`, `update_time`. Clicking a row opens the idea detail.

#### Scenario: View idea list
- **WHEN** list view is active
- **THEN** a table of all ideas is displayed with sortable column headers
- **AND** each row's Name column shows the idea title on the first line and tags below it
- **AND** the Summary column displays up to 5 lines of text, truncated if longer

#### Scenario: Click row in list
- **WHEN** user clicks a row
- **THEN** the view switches to inbox mode with that idea selected

### Requirement: Filtering and sorting
All views SHALL support filtering by category (multi-select) and by tag (text match against idea tags). All views SHALL support sorting by `create_time` or `update_time` (ascending/descending). Filters and sort are persisted in URL query params.

#### Scenario: Filter by tag
- **WHEN** user enters a tag in the filter input
- **THEN** only ideas with matching tags are shown across all views

#### Scenario: Filter by category
- **WHEN** user selects one or more categories in the category filter
- **THEN** only ideas in those categories are shown

#### Scenario: Sort by creation time
- **WHEN** user selects "Sort by creation time"
- **THEN** ideas are reordered by `create_time`

### Requirement: Auto-save with conflict detection
The system SHALL auto-save idea content 2 seconds after the last edit. Manual save SHALL be available via Ctrl+S or a save button. If a conflict is detected (content_hash mismatch), the system SHALL display an error notification and NOT overwrite the file.

#### Scenario: Auto-save triggers
- **WHEN** user stops typing for 2 seconds after editing idea body or summary
- **THEN** the system saves the changes to the backend

#### Scenario: Conflict on save
- **WHEN** auto-save or manual save encounters a 409 Conflict response
- **THEN** a prominent error notification is shown: "File has been modified externally. Please reload."
- **AND** the save button changes to a "Reload" button

#### Scenario: Manual save via Ctrl+S
- **WHEN** user presses Ctrl+S while editing
- **THEN** the system immediately saves all pending changes

### Requirement: Score input component
The system SHALL provide a score input component that allows selecting a value from 0 to 5. The component SHALL display as clickable stars (★).

#### Scenario: Set score
- **WHEN** user clicks the 4th star/number
- **THEN** `my_score` is set to 4 and saved immediately

#### Scenario: Clear score
- **WHEN** user clicks the currently selected score
- **THEN** `my_score` is reset to 0

### Requirement: Paper dump trigger from UI
The system SHALL provide a button in the project page to trigger paper dump. The button opens a dialog with two modes: "By Tags" and "Select Papers".

#### Scenario: One-click dump with saved filter
- **WHEN** user clicks "Dump Papers" and the project has a saved `paper_filter` in `project.json`
- **THEN** the "By Tags" tab shows the saved tag names with a one-click dump button
- **AND** clicking the button dumps papers matching the saved tags without further selection

#### Scenario: Edit and save tag filter
- **WHEN** user clicks "Edit" on the saved filter, modifies the tag selection, and clicks "Save filter"
- **THEN** the new tag selection is saved to `project.json` via the config API

#### Scenario: Dump papers by manual tag selection
- **WHEN** user selects tags manually in the "By Tags" tab and clicks dump
- **THEN** the system calls the dump-papers API with selected tag IDs
- **AND** shows a success notification with the number of papers dumped

#### Scenario: Dump papers by direct selection
- **WHEN** user switches to the "Select Papers" tab, checks individual papers via checkboxes, and clicks dump
- **THEN** the system calls the dump-papers API with the selected paper IDs
- **AND** the tab supports search filtering, select all, and clear selection

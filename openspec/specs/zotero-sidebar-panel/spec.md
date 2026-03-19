## ADDED Requirements

### Requirement: Sidebar panel registration
The plugin SHALL register a custom section in Zotero 7's item pane using `Zotero.ItemPaneManager.registerSection()`. The section SHALL be labeled "Paperland" and SHALL occupy the full available panel area.

#### Scenario: Plugin startup registers panel
- **WHEN** Zotero starts and the plugin is loaded
- **THEN** a "Paperland" section appears in the item pane sidebar

#### Scenario: Plugin shutdown unregisters panel
- **WHEN** the plugin is disabled or Zotero shuts down
- **THEN** the "Paperland" section is removed from the item pane

### Requirement: Embedded browser displays paper detail page
The panel SHALL contain an embedded browser element that loads the Paperland paper detail page (`/papers/:id`) for the currently selected Zotero item. The browser SHALL fill the entire panel area.

#### Scenario: Paper exists in Paperland
- **WHEN** the user selects a Zotero item with arXiv ID `arXiv:2603.04948` AND the paper exists in Paperland with internal ID `42`
- **THEN** the embedded browser loads `{host}/papers/42` with Basic Auth credentials

#### Scenario: Paper does not exist yet
- **WHEN** the user selects a Zotero item with arXiv ID `arXiv:2603.04948` AND the paper does not exist in Paperland
- **THEN** the plugin creates the paper via the external API AND then loads the resulting detail page in the embedded browser

### Requirement: Loading state during paper resolution
The panel SHALL display a loading indicator while the paper is being looked up or created via the API.

#### Scenario: Loading state shown during API call
- **WHEN** the plugin is resolving the paper ID from the external API
- **THEN** the panel displays a loading indicator (e.g., spinner or "Loading..." text)

#### Scenario: Loading state cleared after page loads
- **WHEN** the embedded browser finishes loading the paper detail page
- **THEN** the loading indicator is removed

### Requirement: Placeholder when no arXiv paper is selected
The panel SHALL show a placeholder message when the selected Zotero item does not have an arXiv ID or when no item is selected.

#### Scenario: Non-arXiv item selected
- **WHEN** the user selects a Zotero item that has no arXiv ID
- **THEN** the panel displays a placeholder message (e.g., "Select an arXiv paper to view in Paperland")

#### Scenario: No item selected
- **WHEN** no item is selected in the Zotero library
- **THEN** the panel displays the same placeholder message

### Requirement: Reactive item selection
The panel SHALL update automatically when the user selects a different item in the Zotero library. The panel SHALL NOT require manual refresh.

#### Scenario: Switching between two arXiv papers
- **WHEN** the user switches selection from paper A (arXiv:2603.04948) to paper B (arXiv:1706.03762)
- **THEN** the embedded browser navigates to the Paperland detail page for paper B

#### Scenario: Switching from arXiv paper to non-arXiv item
- **WHEN** the user switches from an arXiv paper to a non-arXiv item (e.g., a book)
- **THEN** the panel switches from the embedded page to the placeholder message

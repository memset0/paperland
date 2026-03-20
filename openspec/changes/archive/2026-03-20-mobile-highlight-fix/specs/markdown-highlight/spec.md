## MODIFIED Requirements

### Requirement: Text selection creates highlight
The system SHALL display a floating toolbar when text is selected within a MarkdownContent component, allowing the user to choose a highlight color and optionally add a note. On both desktop and mobile (touch) devices, the system SHALL detect text selection completion via the `selectionchange` event with debouncing, and display the toolbar near the selection.

#### Scenario: Select text and highlight on desktop
- **WHEN** a user selects text within a rendered MarkdownContent component using mouse
- **THEN** a floating toolbar SHALL appear near the selection (below the selected text) with 4 color buttons (yellow, green, blue, pink) within 100ms of selection stabilizing
- **WHEN** the user clicks a color button
- **THEN** the selected text SHALL be highlighted with that color, and a POST request SHALL be sent to create the highlight

#### Scenario: Select text and highlight on mobile (touch device)
- **WHEN** a user selects text within a rendered MarkdownContent component using touch (including Android selection handles)
- **THEN** a floating toolbar SHALL appear near the selection with 4 color buttons (yellow, green, blue, pink) after the selection stabilizes (within 300ms debounce)
- **WHEN** the user taps a color button
- **THEN** the selected text SHALL be highlighted with that color, and a POST request SHALL be sent to create the highlight

#### Scenario: Selection cleared before highlight
- **WHEN** a user selects text and the toolbar is showing, then the selection is cleared (by tapping elsewhere or by the system)
- **THEN** the toolbar SHALL be hidden automatically via `selectionchange` detection

#### Scenario: Select text and add note
- **WHEN** a user selects text and the toolbar is showing
- **THEN** the toolbar SHALL include an option to add a text note before confirming the highlight

#### Scenario: Toolbar viewport boundary clamping
- **WHEN** the selection is near the edge of the screen (especially on narrow mobile viewports)
- **THEN** the toolbar position SHALL be clamped to remain fully visible within the container bounds

### Requirement: Highlight interaction — hover tooltip
On desktop devices, the system SHALL display a tooltip with the highlight's note content when the user hovers over a highlighted text. On touch devices, the tooltip functionality SHALL be integrated into the click/tap menu instead of appearing on hover.

#### Scenario: Hover highlight with note on desktop
- **WHEN** the user hovers over a `<mark>` element that has a note on a non-touch device
- **THEN** a tooltip SHALL appear showing the note text

#### Scenario: Hover highlight without note on desktop
- **WHEN** the user hovers over a `<mark>` element that has no note on a non-touch device
- **THEN** no tooltip SHALL appear

#### Scenario: Tap highlight on touch device
- **WHEN** the user taps on a `<mark>` element on a touch device
- **THEN** the click menu SHALL appear directly (no separate tooltip step), and the menu SHALL display the existing note text if present

### Requirement: Highlight interaction — click menu
The system SHALL display a context menu when the user clicks or taps on a highlighted text, with options to edit note, change color, and delete.

#### Scenario: Click highlight to edit on desktop
- **WHEN** the user clicks on a highlighted `<mark>` element on desktop
- **THEN** a popover menu SHALL appear with options: edit note, change color (4 colors), delete

#### Scenario: Tap highlight to edit on touch device
- **WHEN** the user taps on a highlighted `<mark>` element on a touch device
- **THEN** a popover menu SHALL appear with options: edit note, change color (4 colors), delete
- **AND** the menu SHALL be positioned to remain fully visible within the viewport

#### Scenario: Delete highlight from menu
- **WHEN** the user clicks/taps "delete" in the highlight context menu
- **THEN** the highlight SHALL be removed from the DOM and a DELETE request SHALL be sent to the backend

### Requirement: Popup dismissal on all devices
The system SHALL close all highlight-related popups (toolbar, tooltip, menu) when the user interacts outside of them, on both desktop and touch devices.

#### Scenario: Dismiss popups on desktop
- **WHEN** a popup is showing and the user clicks outside of it on desktop
- **THEN** all highlight popups SHALL be closed

#### Scenario: Dismiss popups on touch device
- **WHEN** a popup is showing and the user taps outside of it on a touch device
- **THEN** all highlight popups SHALL be closed via `touchstart` event detection


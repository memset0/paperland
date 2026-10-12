## MODIFIED Requirements

### Requirement: Conversation view column on the paper page
On the wide (split) paper-detail layout the system SHALL offer three page layouts, chosen from a selector at the top right of the page header: (1) **split** — the original two columns (paper viewer | paper info & Q&A); (2) **paper + conversation** — two columns, the paper viewer on the left and the conversation view on the right, with the paper info & Q&A column split into two extra viewer tabs placed right of the "Note" tab: "Metadata" (the paper info card, citations, notes card, Kimi summary — everything except the Q&A lists) and "Q&A" (the Preset Q&A and User Q&A lists); (3) **three columns** — paper viewer | paper info & Q&A | conversation view. The conversation view SHALL be shown in layouts (2) and (3). Every divider SHALL be draggable. Layout (2) SHALL use the same left/right ratio as layout (1) (dragging either changes both). Layout (3) SHALL keep its own column proportions. The chosen layout and all proportions SHALL be stored as fractions of the page width, remembered across reloads, and restored without the columns being squeezed or overflowing after a reload or a window resize. Opening an answer in the conversation view from layout (1) SHALL switch to the most recently used conversation layout (default: paper + conversation). On the narrow (non-embed) layout signed-in users SHALL get the conversation view as the Ask section of the mobile bottom bar (see `mobile-bottom-bar`), without the layout selector; opening an answer in the conversation view there SHALL switch to that section. Signed-out visitors and the embed layout SHALL NOT get the selector or the conversation view.

#### Scenario: Toggle and resize
- **WHEN** the user picks the three-column layout on a wide screen and drags the conversation divider
- **THEN** a third column appears right of the Q&A column and its width follows the drag

#### Scenario: Paper + conversation layout
- **WHEN** the user picks the paper + conversation layout
- **THEN** the left column shows the viewer tabs plus "Metadata" and "Q&A" tabs after "Note", the right column shows the conversation view, and the divider sits at the same ratio as in the split layout

#### Scenario: Reload keeps proportions
- **WHEN** the user resizes columns in any layout and reloads the page (possibly at a different window width)
- **THEN** the same layout reopens with the same proportions, and no column is pushed off screen or collapsed to nothing

#### Scenario: Revealing a Q&A from the conversation layout
- **WHEN** in the paper + conversation layout the user clicks a QA id in a thread or a node in the Q&A tree while another viewer tab is active
- **THEN** the "Q&A" tab is activated and the entry is revealed

#### Scenario: Narrow screen
- **WHEN** a signed-in user opens the paper page on a phone
- **THEN** no layout selector is offered, the conversation view is the bottom bar's Ask section, and "open in conversation" switches to it

#### Scenario: Embed layout
- **WHEN** the paper page is shown in embed mode
- **THEN** no layout selector, conversation view or "open in conversation" action is offered

### Requirement: One shared question box docked in the view
While the conversation view is shown the inline question box above User Q&A SHALL NOT be shown; the single global question box SHALL be docked at the bottom of the view. Its draft (question text and attachments) SHALL be the same draft used by the inline box and SHALL be kept across tab switches and when the view is shown or hidden. New questions, adding PDF passages or screenshots, and "Follow up" / `#moonlight` actions SHALL all go to this docked box. A follow-up SHALL open in the tab whose thread already ends at that answer; when there is none it SHALL open in a new tab (reusing an empty "new conversation" tab if one is active).

#### Scenario: Draft survives switching
- **WHEN** the user types a question and adds a passage, switches tabs, switches to the split layout
- **THEN** the same text and passage are in the inline box above User Q&A

#### Scenario: Follow-up action while the view is open
- **WHEN** the conversation view is shown and the user clicks "Follow up" (or a `#moonlight` link) under an answer in the Q&A list
- **THEN** the tab ending at that answer becomes active (a new tab when none exists) and the docked box is pre-filled when a suggestion was clicked

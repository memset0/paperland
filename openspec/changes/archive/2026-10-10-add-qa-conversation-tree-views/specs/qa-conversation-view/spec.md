## ADDED Requirements

### Requirement: Conversation view column on the paper page
On the wide (split) paper-detail layout the system SHALL offer three page layouts, chosen from a selector at the top right of the page header: (1) **split** — the original two columns (paper viewer | paper info & Q&A); (2) **paper + conversation** — two columns, the paper viewer on the left and the conversation view on the right, with the paper info & Q&A column split into two extra viewer tabs placed right of the "Note" tab: "Metadata" (the paper info card, citations, notes card, Kimi summary — everything except the Q&A lists) and "Q&A" (the Preset Q&A and User Q&A lists); (3) **three columns** — paper viewer | paper info & Q&A | conversation view. The conversation view SHALL be shown in layouts (2) and (3). Every divider SHALL be draggable. Layout (2) SHALL use the same left/right ratio as layout (1) (dragging either changes both). Layout (3) SHALL keep its own column proportions. The chosen layout and all proportions SHALL be stored as fractions of the page width, remembered across reloads, and restored without the columns being squeezed or overflowing after a reload or a window resize. Opening an answer in the conversation view from layout (1) SHALL switch to the most recently used conversation layout (default: paper + conversation). The narrow/mobile layout and signed-out visitors SHALL NOT get the selector or the conversation view.

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
- **WHEN** the paper page uses the single-column layout
- **THEN** no layout selector, conversation view or "open in conversation" action is offered

### Requirement: Threads are derived from a selected answer
A thread SHALL NOT be stored. Selecting an answer SHALL define a thread consisting of that answer's entry and every ancestor entry along the follow-up chain; for each ancestor the thread SHALL show the specific answer its child continued, and for the selected entry the selected answer. The thread SHALL render as alternating question and answer messages from the root down, showing each question's attached passages/screenshots. An answer that is queued or streaming SHALL be openable and SHALL update live. Ancestors the viewer cannot see or that were deleted SHALL appear as placeholders.

#### Scenario: Open a follow-up's thread
- **WHEN** the user opens answer B2 of follow-up B, whose parent is answer A1 of root question A
- **THEN** the thread shows question A, answer A1, question B, answer B2, in that order

#### Scenario: Open a streaming answer
- **WHEN** the user opens an answer that is still being generated
- **THEN** the thread shows it and its text grows as it streams

### Requirement: Multiple threads as tabs
The conversation view SHALL hold several threads at once as tabs along its top, each labelled by its last question. The user SHALL be able to switch, close, and add a "new conversation" tab (no thread); closing the last tab leaves a blank "new conversation" tab rather than leaving the layout. Opening an answer whose thread is already the tail of an open tab SHALL activate that tab; otherwise it SHALL open a new tab. Open tabs and the active tab SHALL be remembered per user and paper.

#### Scenario: Two threads
- **WHEN** the user opens answers from two different Q&As in the conversation view
- **THEN** two tabs exist and switching tabs switches the displayed thread

#### Scenario: Reload keeps tabs
- **WHEN** the user reloads the paper page with tabs open
- **THEN** the same tabs reopen with the same active tab

### Requirement: One shared question box docked in the view
While the conversation view is open the floating question box SHALL NOT be shown; the single global question box SHALL be docked at the bottom of the view. Its draft (question text and attachments) SHALL be the same draft used by the floating box and SHALL be kept across tab switches and when the view is opened or closed. Adding PDF passages or screenshots, and 追问 / `#moonlight` actions, SHALL target this docked box.

#### Scenario: Draft survives switching
- **WHEN** the user types a question and adds a passage, switches tabs, closes the view and reopens the floating box
- **THEN** the same text and passage are still in the box

#### Scenario: Follow-up action while the view is open
- **WHEN** the conversation view is open and the user clicks 追问 (or a `#moonlight` link) under an answer in the Q&A list
- **THEN** that answer's thread becomes the active tab and the docked box is pre-filled when a suggestion was clicked

### Requirement: Asking inside a thread
In the conversation view the docked box SHALL continue the active tab's last answer as a follow-up; in a "new conversation" tab it SHALL ask a root question. Asking SHALL be disabled, with a hint, while the active thread's last answer is not done. After a successful submission the active tab SHALL show the new question's answer, so the user lands in the thread automatically.

#### Scenario: Follow-up in place
- **WHEN** the active thread ends in a done answer and the user submits a question in the docked box
- **THEN** a follow-up of that answer is created and the tab's thread extends with the new question and its streaming answer

#### Scenario: Last answer still running
- **WHEN** the active thread's last answer is still streaming
- **THEN** submitting is disabled and the box says the answer must finish first

#### Scenario: New conversation
- **WHEN** the user submits in a "new conversation" tab
- **THEN** a root question is created and the tab becomes its thread

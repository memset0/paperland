## MODIFIED Requirements

### Requirement: One shared question box docked in the view
While the conversation view is open the floating question box SHALL NOT be shown; the single global question box SHALL be docked at the bottom of the view. Its draft (question text and attachments) SHALL be the same draft used by the floating box and SHALL be kept across tab switches and when the view is opened or closed. Adding PDF passages or screenshots, and "Follow up" / `#moonlight` actions, SHALL target this docked box.

#### Scenario: Draft survives switching
- **WHEN** the user types a question and adds a passage, switches tabs, closes the view and reopens the floating box
- **THEN** the same text and passage are still in the box

#### Scenario: Follow-up action while the view is open
- **WHEN** the conversation view is open and the user clicks "Follow up" (or a `#moonlight` link) under an answer in the Q&A list
- **THEN** that answer's thread becomes the active tab and the docked box is pre-filled when a suggestion was clicked

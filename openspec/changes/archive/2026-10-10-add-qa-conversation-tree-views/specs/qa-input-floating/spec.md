## ADDED Requirements

### Requirement: Floating panel yields to the conversation view
While the paper-page conversation view is open, the floating question panel SHALL NOT be shown and requests to open the question box SHALL focus the box docked in the conversation view instead. When the view closes, the floating panel SHALL behave as before with the same draft.

#### Scenario: Ask entry while the view is open
- **WHEN** the conversation view is open and the user chooses 提问 or adds a PDF passage to the question box
- **THEN** no floating panel appears; the docked box receives the content

### Requirement: Single-choice model selection
The question panel's model buttons SHALL act as a single choice: exactly one model is selected and clicking another model switches to it. When docked in the narrow conversation column the same single choice SHALL be offered as a compact dropdown instead of a row of buttons.

#### Scenario: Switch model
- **WHEN** the user clicks a different model button in the question panel
- **THEN** that model becomes the only selected one

#### Scenario: Docked dropdown
- **WHEN** the question box is docked in the conversation view
- **THEN** the model is chosen from a dropdown showing the current single selection

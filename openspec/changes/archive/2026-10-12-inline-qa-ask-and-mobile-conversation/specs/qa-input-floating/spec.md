## ADDED Requirements

### Requirement: Inline question box above User Q&A
When the paper page does not show the conversation view (desktop split layout, embed), the question box SHALL be an inline box at the top of the User Q&A card, directly under its header, always visible to signed-in users. There SHALL be no floating question window. Its draft (question text, attachments with their labels, and the answer being followed up) SHALL be kept per user and paper in browser storage, restored after a reload, and cleared after a successful submission; when storage is unavailable the draft starts empty. "Follow up", `#moonlight` links, and PDF "Add to question" SHALL put their content into this box, scroll it into view and focus it. When the conversation view is shown, the inline box SHALL NOT be shown and the same draft SHALL live in the conversation view's docked box.

#### Scenario: Ask from the Q&A column
- **WHEN** a signed-in user on the desktop split layout types a question in the box under the User Q&A header and submits
- **THEN** the question is created and appears in the User Q&A list, and the box is cleared

#### Scenario: Follow up from an answer
- **WHEN** the user clicks "Follow up" under an answer while the conversation view is not shown
- **THEN** the inline box shows the follow-up target, scrolls into view and receives focus

#### Scenario: Add a PDF passage
- **WHEN** the user chooses "Add to question" on a PDF selection while the conversation view is not shown
- **THEN** the passage appears as an attachment in the inline box

#### Scenario: Draft restored after reload
- **WHEN** the user half-types a question, adds an attachment and reloads the page
- **THEN** the inline box shows the same text and attachment with the same label

## MODIFIED Requirements

### Requirement: Integrated panel controls and layout
The question box's top row SHALL show, from left to right, the submit button and the model selection. Between the top row and the input there SHALL be an attachment bar (taking no space without attachments) listing passage and screenshot attachments in the order added, each with a kind icon, its label (e.g. `@Quote1`, `@Image1`), a summary (first words of the passage / screenshot thumbnail) and its page (or page range), each removable; there is no limit on the number of attachments (see `contextual-qa`). The textarea SHALL sit below and take the full width, about 2–3 rows by default, without a native resize grip.

#### Scenario: Top row order
- **WHEN** a signed-in user sees the question box
- **THEN** the top row shows the submit button followed by the "Model" label and the model selection, with no close button

#### Scenario: Full-width input below, two rows by default
- **WHEN** the question box is shown
- **THEN** the input sits below the top row, spans its full width and is about 2–3 rows high

#### Scenario: Input has no native resize grip
- **WHEN** the user looks at the input's bottom-right corner
- **THEN** the textarea offers no native resize grip

#### Scenario: Attachment bar above the input
- **WHEN** the user adds a passage and a screenshot from the PDF via "Add to question"
- **THEN** an attachment bar above the input lists `@Quote1` and `@Image1` and the labels are inserted at the caret

## REMOVED Requirements

### Requirement: On-demand floating panel presentation
**Reason**: The question box is no longer a floating panel opened from an "Ask" button; it is inline above User Q&A or docked in the conversation view.
**Migration**: Use the inline box under the User Q&A header, or the conversation view.

### Requirement: Resize via bottom-right grip
**Reason**: No floating panel to resize; the inline and docked boxes follow their containers.
**Migration**: None.

### Requirement: Move by dragging empty panel areas
**Reason**: No floating panel to move.
**Migration**: None.

### Requirement: Default geometry per layout, not remembered
**Reason**: No floating geometry. Draft persistence moved to "Inline question box above User Q&A".
**Migration**: None.

### Requirement: Mobile fullscreen overlay
**Reason**: Phones ask in the conversation view (bottom-bar Ask section) instead of a full-screen overlay.
**Migration**: Use the Ask section of the mobile bottom bar.

### Requirement: Floating panel yields to the conversation view
**Reason**: There is no floating panel; the inline box yields to the docked box (see "Inline question box above User Q&A").
**Migration**: None.

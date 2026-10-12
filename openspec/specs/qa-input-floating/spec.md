# qa-input-floating Specification

## Purpose
QAInput（给论文提问的输入框）的呈现方式与定位规格。

## Requirements

### Requirement: Responsive behavior consistency
QAInput SHALL 在移动端和桌面端均可正常使用，功能（模型选择、输入、提交）不受定位方式影响。

#### Scenario: Submit works on mobile with fixed positioning
- **WHEN** 用户在移动端的 fixed 提问框中输入问题并提交
- **THEN** 问题正常提交，行为与桌面端一致

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

### Requirement: Submit button shows a text label
提交按钮 SHALL 同时显示图标与文字 "Submit"，而非仅显示图标。

#### Scenario: Submit button content
- **WHEN** 面板表单可用（已登录、可提交）
- **THEN** 提交按钮显示发送图标加 "Submit" 文字

### Requirement: Single-choice model selection
The question panel's model buttons SHALL act as a single choice: exactly one model is selected and clicking another model switches to it. When docked in the narrow conversation column the same single choice SHALL be offered as a compact dropdown instead of a row of buttons.

#### Scenario: Switch model
- **WHEN** the user clicks a different model button in the question panel
- **THEN** that model becomes the only selected one

#### Scenario: Docked dropdown
- **WHEN** the question box is docked in the conversation view
- **THEN** the model is chosen from a dropdown showing the current single selection

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

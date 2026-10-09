# qa-doc2x-content-gate Specification

## Purpose
Keeps Q&A honest about its text source: warn before asking when only the mechanically extracted text is available, and switch to doc2x Markdown silently once it exists.

## Requirements
### Requirement: Q&A prefers doc2x Markdown silently
Q&A context resolution SHALL prefer `contents.doc2x_parsed` over `contents.pdf_parsed` (after `user_input`). Context SHALL be resolved when each Q&A run executes, so any new question, template trigger, or regeneration (including continued or follow-up questions) issued after doc2x parsing completes SHALL use the doc2x Markdown without asking the user.

#### Scenario: Regenerate after doc2x parse
- **WHEN** an answer was generated from `pdf_parsed` and the user regenerates it after `doc2x_parsed` exists
- **THEN** the new run SHALL use `doc2x_parsed` and no confirmation SHALL be shown

#### Scenario: User input still wins
- **WHEN** the paper has `contents.user_input`
- **THEN** Q&A SHALL use `user_input` regardless of doc2x state

### Requirement: Confirm before asking with mechanical text only
When the paper's Q&A source would be `pdf_parsed` while doc2x is enabled, the paper has a PDF, and `contents.doc2x_parsed` does not exist (`qa_needs_confirm` is true), the frontend SHALL show a confirmation stating that the doc2x precise parse has not finished and the answer will be based on mechanically extracted text, before submitting a free question, triggering template Q&A, or regenerating an answer. The request SHALL be sent only after the user confirms.

#### Scenario: Ask during parse
- **WHEN** doc2x parsing is running and the user submits a free question
- **THEN** a confirmation SHALL appear, and the question SHALL be submitted only if the user confirms

#### Scenario: Cancel
- **WHEN** the user cancels the confirmation
- **THEN** no Q&A request SHALL be sent and the typed question SHALL be kept

#### Scenario: No prompt once parsed
- **WHEN** `contents.doc2x_parsed` exists
- **THEN** Q&A requests SHALL be sent without any confirmation

## MODIFIED Requirements

### Requirement: Follow-up questions form a tree
A user SHALL be able to ask a follow-up on any specific answer (Result), either by typing their own question or by activating a model-suggested `#moonlight` follow-up link that pre-fills the question. A follow-up SHALL be a child entry whose inputs include a history input referencing the exact parent Result, and its run SHALL include the ancestor questions and selected answers, read by the backend along the reference chain, as conversation history. The parent answer SHALL be visible to the asker when the follow-up is created.

#### Scenario: User-typed follow-up
- **WHEN** a user clicks "Follow up" under an answer and submits their own question
- **THEN** a child entry SHALL be created referencing that answer, and the run SHALL include the conversation up to that answer

#### Scenario: Suggested follow-up link
- **WHEN** a user clicks a `[💬 question](#moonlight)` link in an answer
- **THEN** the page SHALL NOT navigate; a follow-up input SHALL open pre-filled with the link text for that answer

#### Scenario: Follow-up on another user's shared Q&A
- **WHEN** a user follows up on an answer belonging to another user's Q&A that is visible to them through sharing
- **THEN** the follow-up SHALL be created and owned by the follow-up asker, with visibility governed only by the asker's own `qa` switch

#### Scenario: Parent later unshared
- **WHEN** the parent Q&A's owner later turns off `qa` sharing
- **THEN** the backend SHALL still build the follow-up's prompt from the full ancestor chain regardless of sharing, so runs and regenerations are unaffected
- **AND** viewers who can no longer see the parent SHALL see a "currently not visible" placeholder in place of the history, while the follow-up's own question, inputs, and answers display normally

#### Scenario: Follow-up pins one of several answers
- **WHEN** the parent entry has answers from multiple models and the user follows up on one of them
- **THEN** the child's history SHALL use exactly that answer

### Requirement: PDF entry points for selection and screenshot asking
For an authenticated user viewing a paper PDF, the selection toolbar SHALL offer "Ask" for the current passage, and region capture SHALL offer "Ask about screenshot" alongside copying the screenshot link. Asking directly SHALL NOT prompt for a question: it SHALL submit immediately with the question set to the input's reference token followed by the preset question configured in `config.yml`, and SHALL show the input (passage or thumbnail) with the streamed answer rendered as Markdown with LaTeX in a panel near the selection. Asking directly SHALL show the same doc2x-not-ready confirmation as other Q&A asks before submitting. A passage selection MAY span several pages; its input SHALL then record one page/offset segment per page and present its pages as a range. Anonymous users SHALL NOT see these actions.

#### Scenario: Ask about a selected passage
- **WHEN** an authenticated user selects a paragraph and clicks "Ask"
- **THEN** without asking for any text, a free Q&A entry SHALL be created with that passage as `Quote1` and question `@Quote1 Explain this in detail in an easy-to-understand way, using bullet points.` (the configured preset question), answered by the configured default model only, and its answer SHALL stream into the panel

#### Scenario: Cross-page passage
- **WHEN** an authenticated user selects a paragraph that continues from page 3 onto page 4 and clicks "Ask"
- **THEN** the `Quote1` input SHALL contain the concatenated text with segments for pages 3 and 4, and the model input SHALL label it with pages 3–4

#### Scenario: Direct ask before doc2x parsing finishes
- **WHEN** the paper can currently only use mechanically extracted text and doc2x parsing has not finished
- **THEN** clicking "Ask" SHALL first show the doc2x-not-ready confirmation and SHALL submit only after the user confirms

#### Scenario: Ask about a screenshot
- **WHEN** an authenticated user drags a region in capture mode and chooses "Ask about screenshot"
- **THEN** the region image SHALL be uploaded to the image host and a free Q&A entry with that image input SHALL be created

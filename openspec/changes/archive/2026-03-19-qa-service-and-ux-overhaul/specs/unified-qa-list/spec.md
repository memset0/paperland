## ADDED Requirements

### Requirement: Unified QA list
Free QA entries and Template QA entries SHALL be displayed in a single combined list within one card.

#### Scenario: Display order
- **WHEN** a paper has both free and template QA entries
- **THEN** free QA entries appear above template entries
- **AND** free QA entries are ordered by creation time (newest first)
- **AND** template entries follow the order defined in `config.yml`

### Requirement: Free QA entry collapsible accordion
Each free QA entry SHALL be displayed as a collapsible `<details>` element, consistent with template entries.

#### Scenario: Free QA summary line
- **WHEN** a free QA entry is collapsed
- **THEN** the summary line shows the question text, status icon, and model count badge

#### Scenario: Free QA entry with no result yet
- **WHEN** a free QA question has been submitted but no model has responded yet
- **THEN** the entry is shown with a loading spinner in the summary
- **AND** expanded content shows a spinning animation indicating answers are being generated

### Requirement: Multi-model tab display for results
When a QA entry (free or template) has results from multiple models, the results SHALL be displayed as tabs.

#### Scenario: Tab layout
- **WHEN** a QA entry has results from 2+ models
- **THEN** each model's result is a tab with the model name as tab title
- **AND** a second line below the tab title shows the completion time in human-readable format (e.g. "3分钟前", "刚刚")

#### Scenario: Tab ordering by response speed
- **WHEN** multiple models respond to the same question
- **THEN** tabs are ordered by `completed_at` ascending (fastest response first), unless manually pinned

#### Scenario: Single model result
- **WHEN** a QA entry has only one result
- **THEN** the result is displayed directly without tabs

### Requirement: Pin (置顶) a model result
Users SHALL be able to pin a specific model's result to show it first among the tabs.

#### Scenario: Pin result
- **WHEN** user clicks the pin button on a tab
- **THEN** that tab moves to the first position
- **AND** the pin state is persisted in localStorage

### Requirement: Delete a model result
Users SHALL be able to delete a specific model's result from a QA entry.

#### Scenario: Delete result
- **WHEN** user clicks the delete button on a model result tab
- **THEN** the result is deleted from the database via API
- **AND** the tab is removed from the display
- **AND** if no results remain, the entry shows empty/pending state

### Requirement: Regenerate (重新提问)
Users SHALL be able to re-submit a question to a specific model or all selected models.

#### Scenario: Regenerate when no conflict
- **WHEN** user clicks "重新生成" on a QA entry and no execution for the same model is currently running
- **THEN** the question is re-submitted with the chosen model(s)
- **AND** existing results from the same model are NOT deleted; new result is appended

#### Scenario: Regenerate with running conflict
- **WHEN** user clicks "重新生成" and an execution for the same question+model is currently running
- **THEN** a confirmation dialog appears: "关于「{question}」的 {model_name} 正在生成中，是否需要重新提交？"
- **AND** if user confirms, a new execution is submitted
- **AND** if user cancels, no action is taken

### Requirement: Template QA batch generation (一键生成)
The "一键生成" button SHALL only generate answers for template questions that have zero results.

#### Scenario: Batch generate skips templates with existing answers
- **WHEN** user clicks "一键生成" and template "research-question" already has 1+ results but "related-works" has 0 results
- **THEN** only "related-works" is submitted for generation; "research-question" is skipped

#### Scenario: Batch generate with all templates answered
- **WHEN** all template questions have at least one result
- **THEN** the "一键生成" button is hidden

### Requirement: Template QA results use same tab/interaction model as Free QA
Template QA results SHALL use the same multi-model tab display, pin, delete, and regenerate interactions as Free QA entries.

#### Scenario: Template with multiple model results
- **WHEN** a template QA entry has results from multiple models (e.g. from regenerating with different models)
- **THEN** results are displayed as tabs identical to Free QA (model name + human readable time, pin, delete, regenerate)

### Requirement: Collapsible with localStorage persistence
Each QA entry's open/closed state SHALL persist across page loads via localStorage.

#### Scenario: Collapse state persisted
- **WHEN** user collapses a QA entry and navigates away then returns
- **THEN** the entry remains collapsed

#### Scenario: Expand state persisted
- **WHEN** user expands a QA entry and refreshes the page
- **THEN** the entry remains expanded

#### Scenario: Default state for new entries
- **WHEN** a QA entry has no stored collapse state (first time viewing)
- **THEN** entries with results are expanded by default; entries without results are collapsed

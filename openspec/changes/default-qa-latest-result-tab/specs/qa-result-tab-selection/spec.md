## Purpose

确保一个 QA entry 有多个历史回答时，用户默认看到最终最新一次回答，同时保持手动选择、锚点导航、删除回退和轮询更新的可预测性。

## ADDED Requirements

### Requirement: Latest result is selected initially
When an entry has multiple results, the result with the greatest valid `completed_at` SHALL be active on first render. If timestamps tie or are invalid/equal, the greatest result id SHALL win deterministically.

#### Scenario: Open entry with old and new answers
- **WHEN** an entry first renders with several results
- **THEN** the newest completed answer SHALL be visible without an extra click

#### Scenario: Same completion time
- **WHEN** two results have the same completion time
- **THEN** the result with the greater id SHALL be selected

### Requirement: New results become active without polling churn
When the result id set gains a newly completed result, the view SHALL switch to the newest result. Replacing/reordering the results array with the same id set SHALL preserve a still-valid manual selection.

#### Scenario: Regeneration completes
- **WHEN** polling adds a new result id
- **THEN** the newly latest answer SHALL become active

#### Scenario: Poll returns equivalent results
- **WHEN** polling replaces the array but keeps the same result ids
- **THEN** the viewer's selected historical tab SHALL remain selected

### Requirement: Selection fallback and navigation priority
If the selected result disappears, the view SHALL select the latest remaining result. An explicit `requestedResultId` anchor request SHALL override automatic latest selection whenever that result exists.

#### Scenario: Selected result is deleted
- **WHEN** the current result is removed and others remain
- **THEN** the latest remaining result SHALL become active

#### Scenario: Anchor requests an older result
- **WHEN** navigation requests a valid historical result id
- **THEN** that result SHALL become active even though it is not latest

### Requirement: Newest-first tab order
Without changing pin semantics, unpinned results SHALL be ordered newest-first by completion time and id. Pinning MAY move matching model results ahead visually but SHALL NOT change which result automatic latest selection chooses.

#### Scenario: Unpinned tab list
- **WHEN** no model is pinned
- **THEN** tabs SHALL appear newest to oldest


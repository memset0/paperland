## Purpose

确保 QA 问题在首次调用失败时仍可恢复和重跑，允许同一问题保留多次模型回答，并让每个新结果可精确追踪到统一 Service execution。

## ADDED Requirements

### Requirement: Question persists before execution
The system SHALL persist a QA entry and its question text before submitting external model work to ServiceRunner.

#### Scenario: First free attempt fails
- **WHEN** a newly submitted free question fails before producing a result
- **THEN** its entry SHALL retain the original question, owner, failure state, and retry path

#### Scenario: Failure remains visible
- **WHEN** an entry has failed with no results
- **THEN** paper/feed reads SHALL return the stored entry prompt so the frontend can display and retry it

### Requirement: Prompt source depends on QA type
Every preset run SHALL use the latest configured template text and update the entry prompt before execution. Every free rerun SHALL use the immutable entry prompt, with historical result fallback allowed only to repair a pre-migration legacy entry.

#### Scenario: Preset text changes
- **WHEN** a preset is regenerated after its config text changes
- **THEN** the new run SHALL use the latest text and older results SHALL retain their old prompt snapshots

#### Scenario: Free rerun has no successful result
- **WHEN** a persisted free entry's first attempt failed
- **THEN** rerun SHALL use the entry prompt without requiring a previous result

### Requirement: Repeated runs preserve history
A QA entry SHALL support any number of model runs. A different model or repeated use of the same model SHALL append a new successful result and SHALL NOT overwrite an earlier result.

#### Scenario: Same model runs twice
- **WHEN** the same model successfully runs twice for one entry
- **THEN** two result ids with independent timestamps and answers SHALL remain available

### Requirement: Existing API compatibility
Existing paper QA, feed, generation, regeneration, deletion, and External API full-paper paths SHALL preserve their current envelopes and identifiers while using the persisted entry prompt rules.

#### Scenario: Existing client reads QA
- **WHEN** a current client reads QA after migration
- **THEN** it SHALL continue receiving the established entry/result structure with stored prompt available for user entries


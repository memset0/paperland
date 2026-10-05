## Purpose

在 QA 折叠状态中展示当前用户真实的高亮与笔记引用数量，让阅读进度可见，同时不复制计数或泄露其他用户的私有阅读数据。

## ADDED Requirements

### Requirement: Current-viewer reading counts
Each visible QA entry SHALL expose `highlight_count` and `note_anchor_count` for the current authenticated viewer. Anonymous viewers SHALL receive zero counts. Counts SHALL be derived from authoritative highlight rows and the viewer's current note body rather than mutable cached counters.

#### Scenario: Viewer has both signals
- **WHEN** a viewer has three highlights and two note links targeting an entry
- **THEN** the entry SHALL return `highlight_count=3` and `note_anchor_count=2`

#### Scenario: Another user's reading data
- **WHEN** another user has highlights or note links for the same QA
- **THEN** those private signals SHALL not contribute to the viewer's counts

### Requirement: Compact collapsed indicators
PaperDetail and feed SHALL show compact labeled indicators for non-zero counts without requiring the entry to be expanded. Zero indicators MAY be omitted.

#### Scenario: Collapsed entry has counts
- **WHEN** either count is non-zero
- **THEN** the collapsed header SHALL show “高亮 N” and/or “笔记引用 N”

#### Scenario: Counts change
- **WHEN** the viewer creates/deletes a highlight or adds/removes a note anchor
- **THEN** the next refreshed entry SHALL report and display the new value


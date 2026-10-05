## Purpose

允许每位登录用户为任何可见 QA entry 设置独立、跨设备同步的淡色背景，并在论文详情与 Q&A feed 的折叠和展开状态中一致呈现。

## ADDED Requirements

### Requirement: Supported per-user background palette
The system SHALL support `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, and `red` as persisted QA entry background keys. Null SHALL mean the default background. Values SHALL be viewer-specific and SHALL NOT store arbitrary CSS.

#### Scenario: Set a color
- **WHEN** an authenticated user selects yellow on a visible QA entry
- **THEN** that user's preference SHALL persist as `yellow`

#### Scenario: Set a newly expanded palette color
- **WHEN** an authenticated user selects orange, green, gray, brown, or pink on a visible QA entry
- **THEN** that user's selected semantic key SHALL persist and render with the matching pale treatment

#### Scenario: Reject unsupported color
- **WHEN** a client submits an unsupported key
- **THEN** the API SHALL reject it without changing the prior preference

### Requirement: Preference upsert and clear API
An authenticated user SHALL be able to set or clear their own background preference for a visible entry. Setting SHALL upsert one row; clearing SHALL remove it or equivalently return null. Another user's preference SHALL never be readable or writable.

#### Scenario: Change an existing color
- **WHEN** the same user changes an entry from blue to red
- **THEN** one preference SHALL remain with red

#### Scenario: Clear a color
- **WHEN** the user clears the preference
- **THEN** subsequent QA reads SHALL return null/default for that viewer

#### Scenario: Mark another user's visible QA
- **WHEN** a user can view another user's entry through all scope
- **THEN** they MAY set their own color without modifying the asker's preference

### Requirement: Consistent pale rendering
PaperDetail and feed SHALL apply the selected theme-aware pale color to the whole QA entry in both collapsed and expanded states. Text, badges, focus, hover, and dark-mode readability SHALL remain accessible.

#### Scenario: Expand a colored entry
- **WHEN** a colored collapsed entry is expanded
- **THEN** its header and body SHALL retain a coherent pale background

#### Scenario: Reload the page
- **WHEN** the viewer reloads or uses another device
- **THEN** the saved color SHALL be restored from backend state

# qa-model-persist Specification

## Purpose
Remembers the model chosen in the question box across sessions via localStorage, validating it against the available models and falling back safely when storage is unavailable.

## Requirements
### Requirement: Persist selected models to localStorage
The question box SHALL select exactly one model at a time; choosing another model SHALL replace the selection. The selection SHALL be written to localStorage (key: `paperland_selected_models`, stored as a one-element array) whenever it changes.

#### Scenario: User selects a model and refreshes page
- **WHEN** the user selects model B and reloads the page
- **THEN** the question box restores B as the only selected model

#### Scenario: Picking another model replaces the selection
- **WHEN** model A is selected and the user clicks model B
- **THEN** only B is selected

#### Scenario: Legacy multi-model cache
- **WHEN** localStorage still holds several models from an earlier version
- **THEN** only the first one that is still available stays selected

#### Scenario: User navigates away and returns
- **WHEN** the user selects a model, navigates elsewhere and returns
- **THEN** the selection is unchanged

### Requirement: Validate cached models against available list
系统 SHALL 在获取可用模型列表后，过滤掉 localStorage 中缓存但已不可用的模型。

#### Scenario: Cached model no longer available
- **WHEN** localStorage 中缓存了模型 A、B，但当前可用模型列表只有 B、C
- **THEN** `selectedModels` MUST 更新为 [B]，移除不可用的 A

#### Scenario: All cached models unavailable
- **WHEN** localStorage 中缓存的所有模型都不在可用列表中
- **THEN** 系统 MUST 回退到默认行为——选中可用列表中的第一个模型

### Requirement: Graceful fallback when localStorage unavailable
系统 SHALL 在 localStorage 不可用时（隐私模式等）静默回退到默认行为，不产生错误。

#### Scenario: localStorage throws on access
- **WHEN** 浏览器阻止 localStorage 访问
- **THEN** 系统 MUST 正常工作，使用默认模型选择，无报错

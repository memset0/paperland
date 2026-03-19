## ADDED Requirements

### Requirement: Persist selected models to localStorage
当用户选择或取消选择模型时，系统 SHALL 将当前 `selectedModels` 数组写入 localStorage（key: `paperland_selected_models`）。

#### Scenario: User selects models and refreshes page
- **WHEN** 用户选择了模型 A 和 B，然后刷新页面
- **THEN** 页面加载后 `selectedModels` MUST 自动恢复为 [A, B]

#### Scenario: User navigates away and returns
- **WHEN** 用户在 QA 页面选择了模型后导航到其他页面再返回
- **THEN** 模型选择 MUST 保持不变

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

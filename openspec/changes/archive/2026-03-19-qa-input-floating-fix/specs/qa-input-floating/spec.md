## ADDED Requirements

### Requirement: Mobile fixed bottom positioning
QAInput 组件在移动端（视口宽度 < md breakpoint）SHALL 使用 `fixed` 定位固定在视口底部，不随页面内容滚动。

#### Scenario: Mobile user scrolls QA content
- **WHEN** 用户在移动端浏览 QA 页面并上下滚动内容
- **THEN** 提问框始终固定显示在屏幕底部，不会随内容滚走

#### Scenario: Mobile input does not obscure content
- **WHEN** QAInput 以 fixed 方式固定在底部
- **THEN** QA 内容列表底部 MUST 有足够的 padding 以防止最后的内容被提问框遮挡

### Requirement: Desktop enhanced visual styling
桌面端（视口宽度 >= md breakpoint）QAInput SHALL 保持在内容区域内的 sticky 定位，但增大间距和阴影效果。

#### Scenario: Desktop input has enhanced shadow
- **WHEN** 用户在桌面端查看 QA 页面
- **THEN** 提问框 MUST 显示更重的阴影效果（至少 shadow-2xl 级别），增强浮动层次感

#### Scenario: Desktop input has larger spacing
- **WHEN** 用户在桌面端查看 QA 页面
- **THEN** 提问框与周围内容的间距 MUST 比当前更大（外层 padding 增加）

### Requirement: Responsive behavior consistency
QAInput SHALL 在移动端和桌面端均可正常使用，功能（模型选择、输入、提交）不受定位方式影响。

#### Scenario: Submit works on mobile with fixed positioning
- **WHEN** 用户在移动端的 fixed 提问框中输入问题并提交
- **THEN** 问题正常提交，行为与桌面端一致

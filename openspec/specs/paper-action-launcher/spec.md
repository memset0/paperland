# paper-action-launcher Specification

## Purpose
TBD - created by archiving change refactor-qa-floating-panel. Update Purpose after archive.
## Requirements
### Requirement: Desktop top-right function list
在桌面端（视口宽度 >= md breakpoint）论文详情页，SHALL 在页面**右上角**直接平铺列出所有可用功能的按钮（**不是下拉菜单**，无需先点开再展开）。每个功能按钮 SHALL 显示可识别的图标与名称。当前 SHALL 仅包含"提问"一个功能。

#### Scenario: Functions listed directly on desktop
- **WHEN** 桌面端用户打开论文详情页
- **THEN** 页面右上角直接显示功能按钮列表，当前仅有"提问"按钮，无需先点开任何菜单

#### Scenario: Launcher does not obstruct the content
- **WHEN** 功能入口显示在右上角
- **THEN** 入口不遮挡正文阅读，且不与右侧 QA 导航点条（`QAPanelNav`）位置冲突

### Requirement: Mobile circular floating action button
在移动端（视口宽度 < md breakpoint）论文详情页，SHALL 显示一个**圆形悬浮按钮（FAB）**。点击该按钮 SHALL 弹出功能列表（含当前"提问"及后续新增的其他功能）。从列表中选择某功能即触发该功能。

#### Scenario: Tap FAB to reveal functions
- **WHEN** 移动端用户点击圆形悬浮按钮
- **THEN** 弹出功能列表，当前包含"提问"

#### Scenario: Select a function from the FAB list
- **WHEN** 移动端用户在弹出的功能列表中点击"提问"
- **THEN** 关闭功能列表并打开提问功能（提问浮窗以全屏浮层显示）

### Requirement: Function order follows the page's function order, extensible
功能入口中各功能的排列顺序 SHALL 与论文详情页已有功能区块的顺序一致（引用 → 笔记 → 提问）。入口 SHALL 设计为可扩展，以便后续新增的功能按同一顺序插入。当前仅暴露"提问"一项。

#### Scenario: Single function today
- **WHEN** 当前仅"提问"功能接入入口
- **THEN** 入口（桌面列表与移动 FAB 列表）仅显示"提问"

#### Scenario: Future functions keep page order
- **WHEN** 后续将更多功能接入入口
- **THEN** 它们按论文详情页功能区块顺序（引用 → 笔记 → 提问 → …）排列，而非任意顺序

### Requirement: Launching the QA function opens the QA floating window
从功能入口选择"提问" SHALL 打开提问浮动窗口（桌面端为可拖动浮窗、移动端为全屏浮层）。

#### Scenario: Ask opens the QA window
- **WHEN** 用户（桌面或移动端）通过入口选择"提问"
- **THEN** 提问浮动窗口按当前布局的默认位置与大小弹出


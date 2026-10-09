## MODIFIED Requirements

### Requirement: Integrated panel controls and layout
面板顶部一行 SHALL 自左至右依次为：提交按钮、模型选择、关闭按钮（关闭按钮位于面板右上角，即原提交按钮的位置）。顶部行与输入框之间 SHALL 有一行附件栏（无附件时不占位），按加入顺序列出选段和截图附件，每个显示类别 icon、英文标号（如 `@Quote1`、`@Image1`）、摘要（选段前若干字 / 截图缩略图）和页码（跨页为页码范围），可单独移除；附件数量不设上限（详见 `contextual-qa`）。输入框（textarea）SHALL 位于其下方并占据整行完整宽度，默认显示约 2 行，且自身 SHALL NOT 提供原生缩放手柄（`resize-none`）——改变大小改由面板的缩放手柄完成。

#### Scenario: Top row order
- **WHEN** 面板展开且用户已登录
- **THEN** 顶部一行从左到右为：提交按钮 → "模型"标签与模型选择按钮 → 关闭按钮（右上角）

#### Scenario: Full-width input below, two rows by default
- **WHEN** 面板以默认大小展开
- **THEN** 输入框位于顶部行下方、占据整行完整宽度，默认约 2 行高

#### Scenario: Input has no native resize grip
- **WHEN** 用户查看输入框右下角
- **THEN** 输入框自身不提供原生 resize 手柄；缩放改由面板的缩放手柄完成

#### Scenario: Attachment bar above the input
- **WHEN** 用户从 PDF 把一个选段和一张截图「加入提问框」
- **THEN** 输入框上方出现附件栏，依次显示 `@Quote1` 和 `@Image1` 两个附件，并在光标处插入对应标号

### Requirement: Default geometry per layout, not remembered
面板 SHALL 在每次打开时重新计算默认位置与大小（与"笔记"窗口记忆上次尺寸不同——提问面板 SHALL NOT 持久化或恢复上次的位置/大小）。默认放置在内容区左下角，默认高度约容纳 2 行输入框，默认宽度按当前布局确定：

- 双栏（split-view）布局：默认贴左下角，宽度等于左侧（PDF）栏的当前宽度（沿用现有提问框的计算规则）。
- 单栏布局：默认贴底部，宽度为内容区完整横向宽度。

打开后用户可移动 / 缩放；关闭再打开 SHALL 回到默认几何。

几何不记忆，但**草稿内容**（问题文本、附件及其标号、追问时选定的父回答）SHALL 按「用户 + 论文」保存在浏览器本地存储中，关闭面板或刷新页面后恢复，提交成功后清空；本地存储不可用时按空草稿处理。

#### Scenario: Double-column default position
- **WHEN** 用户在双栏布局页面打开面板
- **THEN** 面板默认贴左下角，宽度等于左侧 PDF 栏的当前宽度

#### Scenario: Single-column default position
- **WHEN** 用户在单栏布局页面打开面板
- **THEN** 面板默认贴底部，宽度为内容区完整横向宽度

#### Scenario: Reopen returns to default
- **WHEN** 用户移动 / 缩放面板后将其关闭，再次打开
- **THEN** 面板回到当前布局对应的默认位置与大小，不沿用上次的位置/大小

#### Scenario: Draft restored while geometry resets
- **WHEN** 用户输入了一半问题并加入一个附件后刷新页面，再打开面板
- **THEN** 面板回到默认位置与大小，问题文本和附件按原标号恢复

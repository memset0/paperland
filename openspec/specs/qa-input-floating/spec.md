# qa-input-floating Specification

## Purpose
QAInput（给论文提问的输入框）的呈现方式与定位规格。

## Requirements

### Requirement: Responsive behavior consistency
QAInput SHALL 在移动端和桌面端均可正常使用，功能（模型选择、输入、提交）不受定位方式影响。

#### Scenario: Submit works on mobile with fixed positioning
- **WHEN** 用户在移动端的 fixed 提问框中输入问题并提交
- **THEN** 问题正常提交，行为与桌面端一致

### Requirement: On-demand floating panel presentation
QAInput 卡片本身 SHALL 作为浮动面板，仅在用户通过功能入口触发"Ask"后弹出，而非常驻显示；默认（页面加载时）不显示，浮于页面内容之上、可关闭。面板 SHALL NOT 被额外的窗口外壳（独立标题栏 / 第二层边框）包裹——浮动面板就是 QAInput 卡片本身（单层，外圈即卡片自身的边框，保持其原有大小），不得出现"窗口套卡片"的双层结构。

#### Scenario: Panel hidden until triggered
- **WHEN** 用户打开论文详情页且未点击"Ask"入口
- **THEN** 提问面板不显示，PDF/内容阅读区不被遮挡

#### Scenario: Open via the action launcher
- **WHEN** 用户点击功能入口中的"Ask"
- **THEN** QAInput 卡片以浮动面板形式弹出（单层卡片，无额外窗口边框）

#### Scenario: Close the panel
- **WHEN** 用户点击面板右上角的关闭按钮
- **THEN** 面板关闭，下次需再次通过入口打开

### Requirement: Integrated panel controls and layout
面板顶部一行 SHALL 自左至右依次为：提交按钮、模型选择、关闭按钮（关闭按钮位于面板右上角，即原提交按钮的位置）。顶部行与输入框之间 SHALL 有一行附件栏（无附件时不占位），按加入顺序列出选段和截图附件，每个显示类别 icon、英文标号（如 `@Quote1`、`@Image1`）、摘要（选段前若干字 / 截图缩略图）和页码（跨页为页码范围），可单独移除；附件数量不设上限（详见 `contextual-qa`）。输入框（textarea）SHALL 位于其下方并占据整行完整宽度，默认显示约 2 行，且自身 SHALL NOT 提供原生缩放手柄（`resize-none`）——改变大小改由面板的缩放手柄完成。

#### Scenario: Top row order
- **WHEN** 面板展开且用户已登录
- **THEN** 顶部一行从左到右为：提交按钮 → "Model" 标签与模型选择按钮 → 关闭按钮（右上角）

#### Scenario: Full-width input below, two rows by default
- **WHEN** 面板以默认大小展开
- **THEN** 输入框位于顶部行下方、占据整行完整宽度，默认约 2 行高

#### Scenario: Input has no native resize grip
- **WHEN** 用户查看输入框右下角
- **THEN** 输入框自身不提供原生 resize 手柄；缩放改由面板的缩放手柄完成

#### Scenario: Attachment bar above the input
- **WHEN** 用户从 PDF 把一个选段和一张截图通过 "Add to question" 加入提问框
- **THEN** 输入框上方出现附件栏，依次显示 `@Quote1` 和 `@Image1` 两个附件，并在光标处插入对应标号

### Requirement: Resize via bottom-right grip
桌面端面板 SHALL 在其右下角提供一个缩放手柄，拖动该手柄改变整个面板的大小（宽与高）。输入框随面板增大而占满更多空间。移动端不提供该手柄（移动端为全屏）。

#### Scenario: Drag the grip to resize the panel
- **WHEN** 桌面端用户按住面板右下角的缩放手柄拖动
- **THEN** 面板的宽/高随指针改变（受最小尺寸约束），输入框填充新增空间

#### Scenario: No resize grip on mobile
- **WHEN** 用户在移动端打开面板
- **THEN** 面板为全屏、不显示缩放手柄

### Requirement: Move by dragging empty panel areas
桌面端用户 SHALL 能通过按住面板上**非输入框、非按钮**的空白区域拖动来移动整个面板的位置；在输入框上拖动不移动面板（用于选中文本），在按钮上按下不移动面板（用于点击）。移动端不支持拖动移动（全屏）。

#### Scenario: Drag a blank area to move
- **WHEN** 桌面端用户按住面板的空白区域（非输入框 / 非按钮）拖动
- **THEN** 整个面板跟随指针移动到新位置

#### Scenario: Dragging the textarea does not move the panel
- **WHEN** 用户在输入框内按下并拖动以选中文本
- **THEN** 面板不移动，正常进行文本选择

#### Scenario: Pressing a button does not move the panel
- **WHEN** 用户在提交 / 模型 / 关闭按钮上按下
- **THEN** 面板不移动，按钮正常响应点击

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

### Requirement: Mobile fullscreen overlay
移动端（视口宽度 < md breakpoint）面板 SHALL 以全屏浮层（inset-0）形式打开。

#### Scenario: Fullscreen on mobile
- **WHEN** 用户在移动端打开面板
- **THEN** 面板以全屏浮层显示，覆盖视口，输入框占据剩余高度

### Requirement: Submit button shows a text label
提交按钮 SHALL 同时显示图标与文字 "Submit"，而非仅显示图标。

#### Scenario: Submit button content
- **WHEN** 面板表单可用（已登录、可提交）
- **THEN** 提交按钮显示发送图标加 "Submit" 文字

### Requirement: Floating panel yields to the conversation view
While the paper-page conversation view is open, the floating question panel SHALL NOT be shown and requests to open the question box SHALL focus the box docked in the conversation view instead. When the view closes, the floating panel SHALL behave as before with the same draft.

#### Scenario: Ask entry while the view is open
- **WHEN** the conversation view is open and the user chooses "Ask" or adds a PDF passage to the question box
- **THEN** no floating panel appears; the docked box receives the content

### Requirement: Single-choice model selection
The question panel's model buttons SHALL act as a single choice: exactly one model is selected and clicking another model switches to it. When docked in the narrow conversation column the same single choice SHALL be offered as a compact dropdown instead of a row of buttons.

#### Scenario: Switch model
- **WHEN** the user clicks a different model button in the question panel
- **THEN** that model becomes the only selected one

#### Scenario: Docked dropdown
- **WHEN** the question box is docked in the conversation view
- **THEN** the model is chosen from a dropdown showing the current single selection

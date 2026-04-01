## ADDED Requirements

### Requirement: Sidebar navigation entry list
The sidebar quick-jump navigation SHALL display entries in this order: template QA entries with results first, then all free QA entries. Template QA entries that have no generated results (no results array or empty results) SHALL be excluded from the navigation.

#### Scenario: Template questions with mixed result status
- **WHEN** there are 5 template questions but only 3 have generated results, plus 2 free QA entries
- **THEN** the sidebar shows 5 navigation dots: 3 for completed template questions, then 2 for free questions

#### Scenario: No template questions have results
- **WHEN** no template questions have generated results but free QA entries exist
- **THEN** the sidebar shows only free QA entry dots

#### Scenario: All template questions have results
- **WHEN** all template questions have results and free QA entries also exist
- **THEN** the sidebar shows template entries first, then free entries

### Requirement: Navigation dot display
导航组件 SHALL 在 PaperDetail 页面以 `position: fixed` 悬浮在视口右侧垂直居中位置，为每个 QA 条目渲染一个小圆点，垂直紧凑排列（gap 2px）。水平位置对齐到右侧滚动面板的右边缘（内缩 6px）。

#### Scenario: Dots rendered for all QA entries
- **WHEN** PaperDetail 页面加载完成且存在 QA 条目
- **THEN** 视口右侧固定位置显示与导航条目数量相同的小圆点

#### Scenario: No dots when no QA entries
- **WHEN** 论文没有任何 QA 条目
- **THEN** 导航组件不显示

#### Scenario: Fixed position independent of scroll
- **WHEN** 用户滚动页面到任意位置
- **THEN** 导航圆点始终固定在视口右侧，不随内容滚动

### Requirement: Active dot highlighting
导航组件 SHALL 区分三种状态的圆点：当前活跃（indigo 色 + 放大）、视口内可见（中灰色）、不可见（浅灰色）。

#### Scenario: Scroll to a QA panel
- **WHEN** 用户滚动右侧面板，使某个 QA 条目面板进入视口
- **THEN** 该条目对应的导航圆点变为中灰色（visible 状态）

#### Scenario: Multiple panels visible
- **WHEN** 多个 QA 面板同时在视口中可见
- **THEN** 最靠近顶部的面板的导航圆点为 indigo 色（active 状态），其余可见面板为中灰色

#### Scenario: Click immediately highlights
- **WHEN** 用户点击某个导航项
- **THEN** 该项立即变为 active 高亮，无需等待滚动完成

### Requirement: Hover expansion
导航组件 SHALL 在鼠标 hover 时从小圆点列向左展开为带标题的面板（最大宽度 ~260px）。热区通过 `::before` 伪元素向左扩展 40px，确保鼠标容易触发。Hover 检测不依赖 touch device 检测（避免触屏笔记本误判）。

#### Scenario: Mouse enters navigation area
- **WHEN** 鼠标移入导航组件热区（含 40px 扩展区域）
- **THEN** 组件从圆点列平滑过渡展开为 ~260px 宽的面板，每个圆点变为对应 QA 条目的问题标题（单行，超出截断省略）

#### Scenario: Mouse leaves navigation area
- **WHEN** 鼠标移出导航组件区域
- **THEN** 组件平滑收回为小圆点列

#### Scenario: No twitching on hover edge
- **WHEN** 鼠标在热区边缘触发展开
- **THEN** 展开后热区不缩小（`::before` 尺寸不变），避免反复展开/收起的抽搐

### Requirement: Transparency and non-obstruction
未展开的导航组件 SHALL 具有半透明效果，不影响底层文字的阅读和鼠标选中。

#### Scenario: Text selection through collapsed nav
- **WHEN** 导航组件处于未展开状态，用户尝试选中导航下方的文字
- **THEN** 鼠标事件穿透导航组件（外层 `pointer-events: none`），文字可正常选中（圆点本身除外）

#### Scenario: Visual transparency
- **WHEN** 导航组件处于未展开状态
- **THEN** 组件整体具有半透明效果（opacity 约 0.5），不严重遮挡底层内容

### Requirement: Click to scroll and expand
点击导航项 SHALL 立即高亮该项，平滑滚动到对应的 QA 面板，若该面板处于折叠状态则自动展开。点击后导航面板不自动收起，仅鼠标移出时收起。

#### Scenario: Click on collapsed panel's nav item
- **WHEN** 用户点击某个导航项（圆点或展开后的标题），且对应 QA 面板处于折叠状态
- **THEN** 该导航项立即高亮，面板自动展开（open），并平滑滚动到该面板的起始位置

#### Scenario: Click on expanded panel's nav item
- **WHEN** 用户点击某个导航项，且对应 QA 面板已经展开
- **THEN** 该导航项立即高亮，平滑滚动到该面板的起始位置

#### Scenario: Nav panel stays open after click
- **WHEN** 用户点击导航项完成跳转
- **THEN** 展开的导航面板保持展开状态，直到鼠标移出区域

### Requirement: Mobile touch support
导航组件 SHALL 在移动端/触屏设备上通过点击触发展开/收起，点击外部区域收起。

#### Scenario: Tap on collapsed nav on mobile
- **WHEN** 用户在触屏设备上点击导航组件的圆点区域
- **THEN** 导航组件展开显示标题列表

#### Scenario: Tap on nav item on mobile
- **WHEN** 用户在触屏设备上点击展开后的某个导航项标题
- **THEN** 滚动到对应面板并展开（同桌面端行为）

#### Scenario: Tap outside to collapse on mobile
- **WHEN** 导航组件处于展开状态，用户点击导航组件外部区域
- **THEN** 导航组件收起为小圆点列

### Requirement: Narrow screen support
导航组件 SHALL 在窄屏模式（<900px 单列布局）下同样显示和工作。

#### Scenario: Narrow screen display
- **WHEN** 视口宽度 < 900px（PaperDetail 切换为单列布局）
- **THEN** 导航组件仍然显示在内容区域的右边缘，行为不变

### Requirement: Dynamic entry updates
导航组件 SHALL 响应 QA 条目的增减变化，实时更新圆点数量和标题。

#### Scenario: New QA entry added
- **WHEN** 用户提交新的自由提问
- **THEN** 导航组件自动增加对应的圆点/标题项

#### Scenario: QA entry removed
- **WHEN** QA 条目被删除
- **THEN** 导航组件自动移除对应的圆点/标题项

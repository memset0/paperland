## Context

PaperDetail 页面右侧面板包含论文信息、Kimi 摘要和 QA 列表。当 QA 条目较多时（模板问题 + 自由提问可达 10+ 条），用户需要大量滚动才能找到特定问题。当前没有任何快速导航手段。

现有结构：
- `PaperDetail.vue` — 页面容器，宽屏左 PDF 右内容
- `QAList.vue` — 渲染所有 QA 条目（`<details>` 折叠面板），通过 `unifiedEntries` computed 提供条目列表
- 右侧面板是一个带 `overflow-y-auto` 的 div，独立于页面滚动

## Goals / Non-Goals

**Goals:**
- 提供右侧悬浮小圆点导航，hover 展开显示问题标题
- 高亮当前可见区域对应的条目（三级状态：active / visible / default）
- 点击导航项：立即高亮 + 滚动到目标 + 自动展开折叠
- 宽屏和窄屏均可用
- 半透明、不遮挡内容

**Non-Goals:**
- 不导航 Kimi 摘要和论文信息区块
- 不支持拖拽重排 QA 条目
- 不在 QAPage（独立问答页）显示

## Decisions

### 1. 独立组件 `QAPanelNav.vue`

将导航栏实现为独立组件，由 PaperDetail 引入。放在滚动容器内但在内容 div 之外（不参与内容流）。

**为什么不放在 QAList 内部**：导航需要固定定位，放在 QAList 内会增加耦合。独立组件更清晰。

### 2. 通过 props 传入条目数据，不依赖 store

组件接收 `entries: Array<{ key: string; title: string }>` 和 `scrollContainer: HTMLElement | null` 作为 props，由 PaperDetail 从 qaStore 中派生。这样导航组件是纯展示组件。

### 3. Scroll spy 使用 IntersectionObserver

用 `IntersectionObserver` 监听每个 QA 条目面板的可见性。实现为 `useScrollSpy` composable，返回 `activeIndex`（最靠近顶部的可见元素）和 `visibleIndices`（所有可见元素索引集合）。额外暴露 `setActive(index)` 方法供点击时立即覆盖。

### 4. 定位策略：`position: fixed` + JS 计算

导航栏使用 `position: fixed`，通过 ResizeObserver + scroll 事件监听滚动容器的 `getBoundingClientRect()`，动态计算 `right` 值对齐到容器右边缘（内缩 6px）。高度固定为 `100vh`，`top: 0`，不受 appbar 显示/隐藏影响。

**为什么不用 `position: sticky`**：sticky 在内容流中，滚动到底部时无法保持固定；会跟随内容滚动。

### 5. 展开/折叠使用 JS 状态 + CSS transition

- 未展开：宽度 16px（仅显示圆点），`opacity: 0.5`，外层 `pointer-events: none`，内层 nav-track `pointer-events: auto`
- 展开：`mouseenter` 事件触发（不依赖 isTouchDevice 检测，避免触屏笔记本误判），宽度过渡到 260px，`opacity: 1`
- 热区：`::before` 伪元素向左扩展 40px、上下各 8px、右 8px，展开后尺寸不变（避免抽搐）
- 按钮 `position: relative; z-index: 1` 确保在伪元素之上可点击

### 6. 点击行为

1. 立即调用 `setActive(index)` 高亮点击项
2. 找到对应 `<details>` 元素（通过 `data-qa-entry` 属性），若折叠则展开并更新 localStorage
3. `scrollIntoView({ behavior: 'smooth', block: 'start' })`
4. 点击后不自动收起导航面板，仅 mouseleave 时收起

### 7. 移动端

- `@touchstart` 事件切换展开/收起
- 点击外部区域时通过 document click listener 收起
- 点击导航项后不自动收起

## Risks / Trade-offs

- **[遮挡内容]** → 未展开时 `pointer-events: none` + opacity 0.5，底层文字可选中
- **[触屏笔记本]** → 不使用 isTouchDevice 检测来 gate hover，避免误判
- **[热区抽搐]** → `::before` 展开后不缩小，热区始终一致
- **[QA 条目动态变化]** → watch entries.length + nextTick 重新绑定 IntersectionObserver
- **[性能]** → fixed 定位需要 scroll 事件监听 updateRect，使用 passive listener

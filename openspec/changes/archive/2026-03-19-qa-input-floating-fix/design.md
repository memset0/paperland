## Context

QAPage 采用 flex 列布局，QA 内容区域使用 `overflow-y-auto` 实现内部滚动。QAInput 组件当前使用 `sticky bottom-0` 定位。问题在于：移动端浏览器对 `sticky` 在嵌套滚动容器中的支持不一致，导致提问框无法固定在视口底部。桌面端双栏布局下，提问框的阴影（`shadow-lg`）和间距（`p-3`）偏小，缺乏浮动层次感。

## Goals / Non-Goals

**Goals:**
- 移动端：提问框始终固定在视口底部，不随内容滚动
- 桌面端：增大提问框间距和阴影，提升视觉层次
- 保持响应式适配，两端体验各自最优

**Non-Goals:**
- 不改变提问框的功能逻辑（模型选择、提交等）
- 不调整 QAPage 的整体页面结构

## Decisions

### 1. 使用 `fixed` 定位替代 `sticky`

**选择**: 在 QAInput 组件中使用 `fixed bottom-0` 定位，使其固定在视口底部。

**理由**: `sticky` 定位依赖最近滚动祖先容器，在 QAPage 中父容器 `overflow-y-auto` 创建了独立滚动上下文，`sticky` 只相对该容器生效，而非视口。`fixed` 定位相对视口生效，直接解决问题。

**替代方案**: 重构页面布局让 QAInput 脱离滚动容器 → 改动更大，且影响现有布局结构。

### 2. 响应式样式策略

**选择**: 使用 Tailwind 响应式前缀区分移动端和桌面端样式：
- 移动端：`fixed bottom-0 left-0 right-0`，全宽贴底
- 桌面端（`md:` 以上）：维持在内容区内的定位，但加大 padding 和 shadow

**理由**: QAPage 桌面端有侧边栏，fixed 全宽会覆盖侧边栏。因此桌面端保持在内容流中用 `sticky`，移动端用 `fixed`。

### 3. 桌面端阴影与间距增强

**选择**:
- 阴影从 `shadow-lg` 升级为 `shadow-2xl`，并添加额外的 ring 或 border 效果
- 外层 padding 从 `p-3` 增加到 `p-4` 或 `p-5`
- 内部卡片增加更多 padding

**理由**: 用户明确要求更大间距和更重阴影以增强浮动感。

## Risks / Trade-offs

- **[移动端底部遮挡]** → fixed 定位的提问框会遮挡底部内容。通过在 QAList 区域添加足够的 `pb-*`（底部 padding）来补偿。
- **[桌面端 sticky 在滚动容器中]** → 桌面端继续使用 sticky，需确认其在当前布局中正常工作。如果也有问题，可考虑也改为 fixed 并限制宽度。

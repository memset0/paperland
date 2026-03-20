## Why

PaperDetail 页面的双栏布局拖动分隔条体验差：快速拖动时光标脱离分隔条导致完全不跟手，分隔条视觉上偏粗，且无法快速折叠/展开左侧面板。需要重写拖动逻辑并增加折叠功能以提升交互体验。

## What Changes

- **重写拖动逻辑**：使用 `pointer events` + `setPointerCapture` 替代当前 mousemove 方案，确保快速拖动时光标始终被捕获，不会丢失跟踪
- **缩窄分隔条**：从当前 `w-1.5`（6px）缩小到 2px 可见宽度，保留足够的隐形点击热区
- **新增折叠/展开按钮**：在分隔条垂直居中位置放置一个 icon button，点击后左侧面板折叠至隐藏；折叠后按钮停留在屏幕左侧中间位置，再次点击恢复左侧面板
- **折叠动画**：折叠/展开过程使用 CSS transition 实现平滑过渡

## Capabilities

### New Capabilities
- `panel-collapse`: 左侧面板折叠/展开功能，包含 toggle 按钮和过渡动画

### Modified Capabilities
- `pdf-split-view`: 拖动逻辑重写为 pointer capture 方式，分隔条视觉变窄

## Impact

- `packages/frontend/src/views/PaperDetail.vue` — 主要改动文件，拖动逻辑和模板重写
- 无后端改动、无 API 变化、无数据库变化
- 无新依赖

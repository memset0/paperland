## Why

QA 页面的浮动提问框在移动端没有正确"浮动"——它跟随内容滚动而非固定在屏幕底部，导致用户需要滚动到页面最底才能输入问题。桌面端双栏布局下提问框的间距过小、阴影太轻，视觉上缺乏层次感。

## What Changes

- **移动端固定定位**：将 QAInput 从 `sticky` 改为 `fixed` 定位（或在移动端使用 `fixed`），使其始终固定在视口底部，不随内容滚动消失。
- **桌面端样式增强**：增大提问框与周围内容的间距（padding/margin），加重阴影效果（shadow），使浮动感更强，视觉层次更明显。
- **响应式适配**：确保移动端和桌面端各自有合适的布局和样式表现。

## Capabilities

### New Capabilities

- `qa-input-floating`: QA 提问框的浮动定位与响应式样式——移动端 fixed 底部定位，桌面端增强间距与阴影

### Modified Capabilities

## Impact

- `packages/frontend/src/components/QAInput.vue` — 定位方式与样式调整
- `packages/frontend/src/views/QAPage.vue` — 可能需要调整布局结构以配合 fixed 定位（如底部留白）

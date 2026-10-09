## Why

PDF 划线翻译目前在选区稳定 500ms 后自动触发：用户只是想选中/复制文本时也会弹出翻译浮层并消耗模型调用，干扰阅读且在部分交互下表现不稳定。改为显式按需触发，让翻译只在用户真正需要时发生。

## What Changes

- **BREAKING（交互）**：移除「稳定选区 500ms 自动翻译」。选区落定后不再自动调用翻译 API。
- 选区落定后，在选区**下方**显示一个浮动选区工具栏（视觉上与 Markdown 划线高亮工具栏一致）：登录用户可见「翻译」按钮，有 `paperId` 时保留既有「复制选区链接」按钮。
- 点击「翻译」后才以当前选区 identity 发起 cache-first 流式翻译；翻译浮层仍居中显示在选区**上方**（空间不足时在下方并避开工具栏），面板内容、流式渲染、复制翻译、重试、关闭、Escape、滚动重定位、zoom/切换失效等行为保持不变。
- 选中不同文本时，旧翻译浮层关闭（不再保留到新选区稳定后替换），新选区只显示工具栏，需再次点击才翻译。
- 匿名用户不显示「翻译」按钮，不调用 API。

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `pdfjs-viewer`: 「Stable PDF text selection triggers translation」改为按钮触发；「Selection translation lifecycle follows the native selection」中新选区替换旧浮层的规则相应调整；「Selection translation coexists with PDF selection tools and authentication」改为工具栏内共存。

## Impact

- `packages/frontend/src/components/PdfViewer.vue`：选区按钮改为工具栏、去掉自动 intent timer、新增点击翻译入口。
- `packages/frontend/src/lib/pdf-selection-translation.ts`（及其测试）：`StableSelectionIntent` 不再使用，移除；`decideOutsidePanelSelection` 语义调整或移除。
- `docs/frontend-architecture.md`：更新 PDF 选区翻译说明。
- 无后端/API/配置变更。

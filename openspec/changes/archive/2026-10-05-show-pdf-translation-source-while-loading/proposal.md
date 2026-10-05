## Why

PDF 划词翻译浮层在等待首个译文增量时只显示“加载翻译”，既占用空间又让用户暂时看不到正在翻译的具体内容。用已选原文作为等待态内容，可以立即建立选区与浮层之间的上下文，同时不伪造译文或改变流式请求时序。

## What Changes

- PDF 划词翻译请求已开始、但尚未收到任何译文文本时，在结果区域显示该次稳定选区的原文。
- 移除该等待态中的“加载翻译”提示文本；连接/加载状态仍通过现有标题状态与视觉指示表达。
- 收到首个译文增量或缓存结果后，原文立即由真实译文替换，后续继续沿用现有流式展示行为。
- 失败态、重试、复制、选区生命周期、翻译 API、缓存和 provider 行为保持不变。
- 同步更新 `docs/frontend-architecture.md`、`docs/external-api.md` 与 `docs/tech-stack.md`，说明本次仅调整 Internal UI 的等待态内容。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdfjs-viewer`: 调整选区翻译浮层在首个译文文本到达前的展示要求，改为显示所选原文而非加载提示文本。

## Impact

- 前端：`packages/frontend/src/components/PdfViewer.vue` 的选择翻译面板 scoped-slot 等待态。
- 测试：PDF 选区翻译组件/渲染测试，使用模拟 SSE，不调用真实翻译 provider。
- API、缓存、数据库、配置和依赖：无变化。
- 文档：按仓库约定同步三份 `docs/` 架构/API/技术栈文档。

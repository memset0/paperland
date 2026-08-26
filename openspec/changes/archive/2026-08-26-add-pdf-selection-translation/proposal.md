## Why

Paperland 的 pdf.js text layer 已支持原生文本选择，但阅读英文论文时，用户仍需复制选区并切换到其它翻译入口。现在已有缓存优先且支持真实流式输出的翻译 API 与 `StreamingTranslationText`，可以把稳定选区直接变成就地翻译体验。

## What Changes

- 在 `PdfViewer` 监听单页 text layer 的有效文本选区；选区内容及 offset 范围连续 **500ms** 未变化后，才认为用户表达了翻译意图并启动一次请求。
- 复用现有选区捕获结果（page、`ts/te`、text 与 DOM Range rect），不改变 pdf.js 的原生选择、复制或现有「复制选区链接」行为。
- 对登录用户，稳定选区自动挂载 `StreamingTranslationText`，调用现有 `POST /api/translate/stream`；缓存命中立即显示，真实 provider delta 按现有逐 delta 绘制语义渐进展示。
- 在选区上方优先展示轻量翻译浮层；上方空间不足时放到下方，并在 PDF viewer 可视范围内做水平/垂直 clamp。浮层包含 Translation 标题、等待/流式/完成/错误状态与纯文本译文。
- 普通外部点击、无归属的选区折叠、离开 PDF text layer、切换论文/PDF、进入截图模式或组件卸载时，取消 500ms timer、终止未完成请求并关闭旧浮层；新有效选区则让旧浮层保留到新 identity 稳定 500ms 后再替换，旧请求的晚到事件不得覆盖新选区。
- 浮层交互 SHALL NOT 因焦点转移产生的临时 `selectionchange`/collapsed selection 而关闭：在面板内按下、复制译文或滚动内容时保留当前浮层并尽量恢复 source Range；Escape、显式关闭或之后点击面板外可以收起面板而不删除翻译缓存。
- 匿名用户选中文本时保持现有原生选区和复制行为，不自动调用登录保护的翻译 API，也不弹出登录框消耗阅读流。
- 同步更新 `docs/frontend-architecture.md`、`docs/external-api.md` 与 `docs/tech-stack.md`；External API 与数据库 schema 不变。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdfjs-viewer`: 增加 500ms 稳定选区判定、缓存优先流式翻译浮层、位置碰撞处理、取消/防 stale 生命周期、登录门禁及与现有选区链接/截图模式的共存行为。

## Impact

- 前端：`packages/frontend/src/components/PdfViewer.vue` 的选区状态与浮层模板/CSS；复用 `StreamingTranslationText.vue`、auth store 与现有 selection offset 工具。
- 后端/API：无新端点；继续使用已登录 Internal API `POST /api/translate/stream` 和全局 `translations` cache。
- 数据库：无迁移；同一选中文本沿用内容 hash 缓存。
- 测试：新增纯选区稳定控制器/定位 helper fixtures、组件构建与 headless PDF text-layer 交互验证；不得调用真实付费模型。
- 文档：三份项目要求的 `docs/` 文件同步说明该功能仅属于 Internal UI/API。

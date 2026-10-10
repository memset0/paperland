## Why

前端界面中英文混杂：侧边栏、页面标题和部分新功能已是英文，但大量按钮、提示、toast、确认框、placeholder 仍是中文（`packages/frontend/src` 下约 428 行、35 个文件）。统一为英文让界面一致，也符合"功能 / 管理页 UI 用英文"的既定偏好。

## What Changes

- 将前端所有面向用户的中文文案改为英文：模板文字、placeholder、`title` / `aria-label` / tooltip、toast、`confirm` / `alert`、错误提示、选项数组中的 label、空状态、相对时间、页面标题。
- 统一排版：Sentence case（专有名词照常大写），进行时统一用 `…`，「」改为英文双引号，全角冒号改为 `: `，确认框用完整问句。
- 统一术语（见 design.md 词汇表），例如 自由提问 → "Free question"、加入提问框 → "Add to question"、追问 → "Follow up"、幻觉翻译（hjfy.top 站点名）→ "hjfy.top"。
- 同步更新现有 spec 中规定了中文 UI 文案的 requirement，以及 `docs/` 中引用的界面文案。
- 在 `AGENTS.md` 的 Key Conventions 中写明：今后前端 UI 文案一律用英文，并沿用本次的排版与术语约定。
- 不改：代码注释、解析 `papers_cool_summary` 用的正则（需匹配中文全角冒号）、单元测试夹具、后端返回的错误信息、发给模型的 prompt、用户内容本身。

## Capabilities

### New Capabilities
- `ui-language`: 前端界面文案语言（英文）与排版约定。

### Modified Capabilities
- 规定了具体中文 UI 文案的现有能力（如 `qa-input-floating`、`qa-panel-nav`、`paper-viewer-modes`、`pdfjs-viewer`、`paper-action-launcher`、`page-title` 等），其 requirement 中的文案改为英文；具体列表以 `specs/` 下的 delta 为准。

## Impact

- 前端：`packages/frontend/src` 下 35 个文件的字符串，无逻辑变化、无 API 变化。
- Specs：上述能力的 delta。
- 文档：`docs/frontend-architecture.md` 等文档中引用的界面文案；`AGENTS.md`（新增 UI 英文约定）。

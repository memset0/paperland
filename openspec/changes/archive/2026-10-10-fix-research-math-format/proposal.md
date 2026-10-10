## Why

Deep Research 报告里的数学公式经常显示成原样文本：research system prompt 没有公式规则，而 Codex 习惯写 `\(...\)` / `\[...\]`，前端的 `@traptitech/markdown-it-katex` 实际上只识别 `$` / `$$`（主 spec 声称原生支持 `\(...\)`，与实现不符）。另外 comment / description 写在 paperlist JSON 里，`\frac`、`\theta`、`\nabla`、`\beta` 会被当成合法的 JSON 转义（`\f`、`\t`、`\n`、`\b`）悄悄损坏。

## What Changes

- research system prompt（`prompts/system/research.md`）新增规则：
  - 公式：沿用 QA 的规则——所有数学用 LaTeX，行内 `$...$`，重要公式 `$$...$$` 单独成行；明确禁止 `\(...\)` 与 `\[...\]`。
  - JSON 转义：paperlist JSON 字符串里的 LaTeX 反斜杠必须写成 `\\`（如 `\\frac`），并说明 `\f`/`\t`/`\n`/`\b`/`\r` 会被悄悄解析错。
  - 在库论文链接：沿用 QA 的 `[📄 short title](paperland://paper/<id>)` 规则，用于 `<paper_list>` 中标了 `in_library` 的论文。
- 研究回合输入 `<paper_list>` 中，已在论文库的论文带 `in_library="paperland://paper/<id>"` 属性（来自 S2 解析结果的 `library_paper_id`）。
- 前端渲染规则不变：不做 `\(...\)` / `\[...\]` 转换，写错的定界符在页面上保持可见，便于发现。主 spec `markdown-math-rendering` 中声称插件原生支持这两种写法的需求与实际不符，改为明确「只渲染 `$` / `$$`」。
- 文档：`docs/frontend-architecture.md`（定界符表改为只列 `$` / `$$` 并说明原因）、`docs/tech-stack.md` 同步；`docs/external-api.md` 无变化。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `deep-research`: 回合输入为在库论文提供站内链接；system prompt 增加公式格式、JSON 转义与在库论文链接规则。
- `markdown-math-rendering`: 删除与实现不符的 `\(...\)` / `\[...\]` 渲染需求，明确只有 `$` / `$$` 会渲染为公式。

## Impact

- **Backend**：`prompts/system/research.md`；`services/research_list.ts`（`renderListForPrompt` 输出 `in_library`）及其测试。
- **Frontend**：无代码改动。
- 无数据库、API 变更。

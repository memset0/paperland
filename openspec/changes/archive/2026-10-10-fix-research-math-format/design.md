## Context

- `lib/markdown-renderer.ts` 是前端唯一的 Markdown 渲染入口（`markdown-it` + `@traptitech/markdown-it-katex`），实测只识别 `$` / `$$`；`\(x\)` 渲染成 `(x)`（反斜杠被当作 Markdown 转义吃掉），而主 spec 声称原生支持。
- research 回合的 `<paper_list>` 由 `research_list.ts` 的 `renderListForPrompt` 生成，S2 解析结果里已有 `library_paper_id`，但没有输出。
- QA prompt（`paper-qa.md`）已有公式与 `📄 paperland://` 在库链接规则，可直接沿用措辞。

## Decisions

- **不改前端渲染**（按用户要求）：曾考虑渲染前把 `\(...\)` / `\[...\]` 转成 `$` / `$$`，但这会掩盖模型的格式错误。保持只渲染 `$` / `$$`，写错时页面上直接可见，靠 prompt 约束模型写正确格式；spec 改为如实描述这一行为。
- **`in_library` 只对已核实的论文输出**，值用 `paperland://paper/<library_paper_id>`，与 QA `<references>` 的写法一致。
- **prompt 规则措辞直接取自 QA**，额外加两条 research 特有的：禁止 `\(` / `\[`；JSON 字符串里的反斜杠必须转义。

## Risks / Trade-offs

- [模型仍可能偶尔写 `\(...\)`，此时公式显示为原样文本] → 这是刻意保留的可见性；prompt 已明确禁止，发现后可在下一轮要求修正。

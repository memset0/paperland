## Context

`MarkdownContent.vue` 目前是纯渲染组件（`marked.parse()` → `v-html`），用于 QA 回答和 Papers.cool 摘要。用户希望在这些渲染内容上支持文本高亮标注，并持久化到后端。

核心挑战：在 markdown 渲染后的 HTML DOM 中可靠地标记文本位置，使其跨刷新可还原。

## Goals / Non-Goals

**Goals:**
- 任何 MarkdownContent 实例上选中文本 → 创建高亮（支持多色 + 可选笔记）
- 高亮持久化到后端 SQLite，刷新后自动还原
- 每页只发一次 GET 请求获取所有高亮数据
- KaTeX 公式作为原子单元处理
- 跨段落高亮支持

**Non-Goals:**
- 重叠高亮（假设高亮不会重叠）
- 高亮公式内部的部分内容
- 协作/多用户高亮（单用户场景）
- 高亮导出/分享
- 孤儿高亮数据清理（后续优化）

## Decisions

### Decision 1: 内容标识方案 — pathname + content_hash

**Choice**: 用 `pathname`（不含 hostname）+ `content_hash`（MD5，去除所有空白字符后计算）作为高亮的定位键。

**Rationale**: 通用且解耦——不依赖 `qa_result_id` 等业务 ID，任何使用 MarkdownContent 的场景都自动支持。同一页面内 content_hash 不会重复（用户确认）。内容变化时 hash 自动变更，旧高亮自然失效，无需特殊处理。

**Alternative considered**: 用 `qa_result_id` / `paper_id` 等业务 ID 作为外键——耦合业务模型，每新增一个 MarkdownContent 使用场景都需要改数据模型。

### Decision 2: 文本偏移量类型 — 渲染后纯文本偏移

**Choice**: 存储渲染后纯文本（`textContent`）中的 start/end offset，而非 markdown 源文本偏移。

**Rationale**: 用户在渲染后的 HTML 中选中文本，直接获取渲染文本偏移最简单。还原时通过 DOM text node 遍历定位并包裹 `<mark>`。避免了 markdown 语法字符（`**`、`$` 等）导致的源文本↔渲染文本偏移不匹配问题。

**Alternative considered**: markdown 源文本偏移——需要复杂的双向映射，插入 `<mark>` 到 markdown 源文本可能破坏语法解析。

### Decision 3: 高亮渲染方式 — DOM 后处理

**Choice**: 先用 `innerHTML` 设置 markdown 渲染结果，然后遍历 DOM text nodes 按偏移量用 Range API 包裹 `<mark>` 元素。

**Rationale**: 与 `v-html` 的工作方式兼容。高亮应用在 markdown 渲染之后，不会干扰 markdown/KaTeX 解析。跨段落高亮自然拆成多个 `<mark>` 片段。

**实现要点**:
1. 用 `ref` 获取容器 DOM
2. `watch` content 变化 → 设置 `innerHTML` = `marked.parse(content)`
3. `nextTick` 后遍历 text nodes，跳过 KaTeX 内部节点（将 `.katex` 元素视为原子单元）
4. 按 offset 用 `Range` + `surroundContents` 或节点分割包裹 `<mark>`

### Decision 4: KaTeX 原子化处理

**Choice**: 计算文本偏移时，将每个 `.katex` / `.katex-display` 元素视为一个原子文本块（用其 `textContent` 计算偏移长度，但不进入其子节点）。如果高亮边界落在 KaTeX 内部，自动扩展到整个公式。

**Rationale**: KaTeX 渲染出的 DOM 极其复杂（多层嵌套 span），在其内部插入 `<mark>` 会破坏公式布局。将公式作为原子单元是最安全的处理方式。

### Decision 5: API 设计 — 按 pathname 批量查询

**Choice**: `GET /api/highlights?pathname=/papers/42` 一次返回该页面所有 content_hash 的高亮数据。增删改为单条操作。

**Rationale**: 每页只需一次额外请求。前端按 content_hash 分组后分发给各 MarkdownContent 实例。

**数据结构**:
```typescript
// GET 响应
{ data: Highlight[] }

// Highlight
{
  id: number
  pathname: string
  content_hash: string
  start_offset: number
  end_offset: number
  text: string
  color: 'yellow' | 'green' | 'blue' | 'pink'
  note: string | null
  created_at: string
}
```

### Decision 6: 前端 MD5 库

**Choice**: 使用 `ts-md5` 或 `spark-md5`（轻量，纯 JS，无 native 依赖）。

**Rationale**: MD5 用于内容指纹，非安全用途，不需要 crypto-grade 哈希。这些库体积小（<10KB），无需 Web Crypto API（不支持 MD5）。

### Decision 7: 选中文本 UI 交互

**Choice**:
- 选中文本后：显示浮动工具栏（4 个颜色按钮 + 可选笔记输入）
- 悬停已有高亮：Tooltip 显示笔记内容
- 点击已有高亮：弹出菜单（编辑笔记 / 修改颜色 / 删除）

### Decision 8: 空内容保护

**Choice**: 如果 MarkdownContent 的 content prop 为空字符串，阻止高亮操作并显示错误提示（用于开发调试）。

## Risks / Trade-offs

- **[Risk] 偏移量漂移** — 如果 markdown 渲染库升级改变了输出 HTML 结构，text node 顺序可能变化，导致偏移量错位 → Mitigation: 高亮记录中存储 `text` 字段用于验证，如果偏移量处的文本不匹配则跳过渲染该高亮（静默降级）
- **[Risk] KaTeX textContent 不稳定** — KaTeX 版本更新可能改变公式的 textContent 输出 → Mitigation: 同上，用 text 字段验证
- **[Risk] 孤儿数据积累** — content hash 变化后旧高亮成为孤儿 → Mitigation: MVP 不处理，后续可加定期清理
- **[Risk] 大量高亮的性能** — 单个 MarkdownContent 有大量高亮时 DOM 操作可能变慢 → Mitigation: 实际使用中单篇回答的高亮数量有限，暂不优化

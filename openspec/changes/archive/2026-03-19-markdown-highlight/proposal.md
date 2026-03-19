## Why

论文阅读过程中，用户需要对 QA 回答和摘要中的关键文本进行标注。目前 MarkdownContent 组件只做纯渲染，无法标记重要内容。添加高亮功能让用户能在任何 markdown 渲染内容上选中文本并持久化标注，刷新后自动还原。

## What Changes

- **新增 `highlights` 数据表**：存储高亮记录，以 `pathname` + `content_hash`（MD5，去空白）定位内容
- **新增高亮 CRUD API**：
  - `GET /api/highlights?pathname=...` — 一次请求返回页面所有高亮
  - `POST /api/highlights` — 新增高亮
  - `PUT /api/highlights/:id` — 修改颜色/笔记
  - `DELETE /api/highlights/:id` — 删除高亮
- **升级 MarkdownContent 组件**：
  - 支持文本选中后弹出操作栏（选择颜色、添加笔记）
  - 渲染后通过 DOM text node 遍历应用 `<mark>` 高亮
  - 悬停高亮显示 Tooltip 笔记，点击高亮弹出编辑/删除菜单
  - KaTeX 数学公式作为原子单元处理（部分选中 → 扩展为整个公式）
  - 跨段落高亮支持（拆成多个 `<mark>` 片段，共享 `data-highlight-id`）
- **新增页面级高亮数据加载**：页面打开时按 `pathname` 一次请求获取所有高亮数据
- **空内容保护**：对空内容的 MarkdownContent 阻止高亮并弹出错误提示

## Capabilities

### New Capabilities
- `markdown-highlight`: 文本高亮标注系统 — 数据模型、CRUD API、前端选中/渲染/管理交互

### Modified Capabilities
- `markdown-math-rendering`: KaTeX 公式在高亮时作为原子单元处理（部分选中自动扩展为整个公式）

## Impact

- **数据库**：新增 `highlights` 表 + Drizzle migration
- **后端 API**：新增 `/api/highlights` 路由（4 个端点）
- **前端组件**：`MarkdownContent.vue` 从纯渲染组件升级为交互式组件（需要 DOM 操作 + 事件监听）
- **前端依赖**：新增 MD5 哈希库（如 `ts-md5` 或 `spark-md5`）
- **共享类型**：`packages/shared` 新增 Highlight 相关类型定义
- **不涉及**：不影响现有 QA 提交/渲染流程，不影响 Papers.cool 抓取逻辑

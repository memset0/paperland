## Context

论文详情页（PaperDetail.vue）目前只有查看功能。后端 API 只有 GET/POST 端点，无 PUT/DELETE。数据库外键未设置 ON DELETE CASCADE，需要在应用层实现级联删除。highlights 表通过 pathname（而非 paper_id FK）关联论文。

## Goals / Non-Goals

**Goals:**
- 在论文详情页提供编辑和删除功能
- arXiv 导入论文的标题和作者不可编辑
- 编辑内容时使用等宽字体纯文本编辑器
- 删除前需用户输入论文内部 ID 确认
- 级联删除所有关联数据（QA、服务记录、标签、高亮）
- 内部 API 和外部 API 同时支持

**Non-Goals:**
- Markdown 编辑器
- 批量编辑/批量删除
- 论文软删除（归档）功能
- 编辑 abstract、metadata 等自动获取的字段

## Decisions

### 1. 应用层级联删除（而非数据库 CASCADE 约束）

在删除 API handler 中用事务手动删除所有关联表记录，而不是修改数据库外键约束添加 ON DELETE CASCADE。

**理由**：现有数据库已有大量数据和迁移历史。SQLite 修改外键约束需要重建表，风险高。应用层事务删除同样保证原子性，且更显式可控。

**删除顺序**（在单个事务中）：
1. qa_results（通过 qa_entries.paper_id 关联）
2. qa_entries（by paper_id）
3. service_executions（by paper_id）
4. paper_tags（by paper_id）
5. highlights（by pathname LIKE pattern，pathname 包含 paper 的 PDF 路径）
6. papers（by id）

### 2. 编辑 API 使用 PATCH 语义

使用 `PATCH /api/papers/:id` 而非 PUT，只更新请求中提供的字段。请求体中未出现的字段保持不变。

**理由**：更灵活，前端可以只发送修改了的字段，避免覆盖并发更新。

### 3. arXiv 论文编辑限制在后端强制执行

后端检查论文是否有 arxiv_id：如果有，则拒绝修改 title 和 authors 字段，返回 400 错误。前端同时在 UI 层面锁定这些字段（disabled 状态）。

**理由**：双重保障，后端校验确保即使绕过前端（如通过外部 API）也无法修改权威来源数据。

### 4. 内容编辑统一走 contents.user_input

编辑论文内容时，无论论文来源如何，都写入 contents 的 `user_input` 字段。这与创建论文时手动输入内容的行为一致。

### 5. 删除确认使用模态对话框 + ID 输入

弹出对话框展示论文标题和 ID，要求用户手动输入论文内部 ID（数字）才能确认删除。类似 GitHub 删除仓库需输入仓库名的设计。

### 6. 前端编辑模式用内联表单

在论文详情页增加"编辑"按钮，点击后切换为编辑模式：标题、作者、链接变为输入框，内容区域变为等宽字体的 textarea。有"保存"和"取消"按钮。不使用独立的编辑页面。

**理由**：内联编辑减少页面跳转，用户体验更流畅。

## Risks / Trade-offs

- **[highlights 关联]** highlights 表没有 paper_id 外键，通过 pathname 关联。删除时需要根据论文的 pdf_path 匹配。如果论文没有 PDF，则无需删除 highlights。→ 通过 pdf_path 构造 LIKE 查询解决。
- **[并发编辑]** 没有乐观锁机制，两人同时编辑可能覆盖。→ 当前为个人使用工具，暂不处理。
- **[ID 不复用]** SQLite autoincrement 本身就不复用 ID，无需额外处理。删除后重新添加同一论文自然获得新 ID。

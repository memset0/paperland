## Context

Paperland 已有 `tags` 和 `paper_tags` 表（多对多关系），以及 External API 的 PUT/PATCH 标签端点。但缺少：标签颜色、前端管理界面、Internal API 标签路由、论文列表筛选、冗余存储。本设计在现有基础上扩展，实现完整的标签管理功能。

当前状态：
- DB: `tags(id, name)` + `paper_tags(paper_id, tag_id)` 已存在
- External API: `PUT/PATCH /external-api/v1/papers/:id/tags` 已存在
- Frontend: PaperDetail 中有简单的标签显示（紫色圆角标签，无颜色区分）
- Shared types: `Tag { id, name }` 已定义

## Goals / Non-Goals

**Goals:**
- 完整的标签生命周期管理（创建、重命名/合并、删除、颜色设置）
- 论文按标签筛选和标签点击导航
- Zotero 标签同步（通过 External API）
- 前端标签颜色缓存机制避免重复请求
- 手动添加论文时的标签选择体验

**Non-Goals:**
- 标签层级/分类（flat tags only）
- 标签搜索的全文检索优化
- 批量给多篇论文打标签
- arXiv/Corpus ID 导入时自动打标签
- 标签导入/导出功能

## Decisions

### 1. 标签颜色存储：tags 表新增 color 字段

**选择**: `tags` 表增加 `color TEXT NOT NULL DEFAULT ''` 字段，存储 hex 色值（如 `#6366f1`）。创建标签时从预设调色板随机分配。

**替代方案**: 单独的 tag_settings 表 → 过度设计，标签属性少，直接加字段更简洁。

### 2. 论文标签冗余存储：papers 表新增 tags_json 字段

**选择**: `papers` 表增加 `tags_json TEXT` 字段，存储 `[{"id":1,"name":"ML"}]` JSON。每次标签变更时同步更新此字段。

**理由**: 避免论文列表页大量 JOIN 查询；前端渲染论文列表时直接使用，无需额外请求。标签颜色不存入此字段（通过独立的颜色缓存接口获取）。

**替代方案**: 仅用 paper_tags JOIN 查询 → 论文多时性能差；完全反范式（不用 paper_tags）→ 丧失关系查询能力。

### 3. 前端标签颜色缓存策略

**选择**: tags Pinia store 中维护 `colorMap: Record<number, string>`，调用 `GET /api/tags` 获取全量标签（含颜色），页面加载时请求一次。在标签管理页面修改颜色后主动刷新 store。

**理由**: 标签数量通常不大（<1000），全量缓存简单高效。避免每个标签组件单独请求。

### 4. 标签重命名合并策略

**选择**: 重命名时如果目标名称已存在，将源标签的所有关联论文迁移到目标标签，然后删除源标签。需前端二次确认。

**实现**: 后端 `PATCH /api/tags/:id`，如果 `name` 冲突返回 `409 Conflict` 并携带目标标签信息，前端展示确认对话框后调用 `POST /api/tags/:id/merge` 执行合并。

### 5. Internal API 路由设计

新增路由文件 `packages/backend/src/api/tags.ts`：
- `GET /api/tags` — 全量标签列表（含 color、关联论文数）
- `PATCH /api/tags/:id` — 重命名、修改颜色
- `DELETE /api/tags/:id` — 删除标签（级联清理 paper_tags + 更新 papers.tags_json）
- `POST /api/tags/:id/merge` — 合并标签到目标
- `GET /api/papers/:id/tags` — 获取论文标签
- `PUT /api/papers/:id/tags` — 设置论文标签
- `PATCH /api/papers/:id/tags` — 增删论文标签

### 6. 标签 ID 编号

**选择**: 使用 SQLite 自增 `id`（已有）。标签的 "数字编号" 就是 `id`，不单独维护。

### 7. 前端标签管理页面

侧边栏新增 Tag 图标入口 → `/tags` 路由 → `TagManagement.vue`：
- 标签列表（名称、颜色预览、关联论文数）
- 内联编辑重命名
- 颜色选择器（预设色板 + 自定义）
- 删除按钮 + 确认对话框

### 8. 论文列表标签筛选

PaperList.vue 增加标签筛选栏，支持多标签 AND 筛选。后端 `GET /api/papers` 增加 `tag_ids` 查询参数。URL query params 驱动筛选状态，便于标签点击跳转。

## Risks / Trade-offs

- **tags_json 冗余一致性** → 所有标签变更操作（增删改、合并、删除标签）都必须同步更新受影响论文的 tags_json。封装为统一的 helper 函数确保一致性。
- **标签合并不可逆** → 前端明确的二次确认 UI，后端日志记录合并操作。
- **颜色缓存过期** → 仅当用户在标签管理页修改颜色时才过期，其他用户需刷新页面才能看到新颜色（单用户系统可接受）。
- **迁移兼容性** → 新增字段均有默认值，现有数据的 tags_json 需通过迁移脚本从 paper_tags 回填。

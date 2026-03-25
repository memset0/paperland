## Why

论文管理系统需要标签功能来帮助用户分类和检索论文。当前虽然数据库中已有 `tags` 和 `paper_tags` 表，以及 External API 的基本标签操作端点，但缺少：前端标签管理界面、标签颜色系统、论文列表按标签筛选、Zotero 标签同步、以及手动添加论文时的标签选择。这些功能是用户组织大量论文的核心需求。

## What Changes

- **新增标签管理页面**：侧边栏新增入口，页面支持重命名标签（同名自动合并需确认）、删除标签（需确认）、修改标签颜色
- **标签颜色系统**：每个标签分配随机主题色，存储在 `tags` 表新增 `color` 字段；前端通过缓存机制一次请求所有标签颜色，页面内缓存、刷新时更新
- **论文列表标签筛选**：PaperList 页面支持按标签过滤论文
- **论文详情标签展示**：PaperDetail 页面显示标签（带颜色），点击标签跳转到筛选后的论文列表
- **论文数据标签冗余存储**：papers 表新增 `tags_json` 字段，存储 `[{id, name}]` JSON 便于检索和渲染
- **手动添加论文时选择标签**：manual 添加模式弹出标签选择器（可创建新标签），arXiv/Corpus ID 导入不自动添加标签
- **Internal API 标签管理端点**：新增 `/api/tags` CRUD 路由（列表、重命名、删除、颜色修改）及 `/api/papers/:id/tags` 路由
- **External API 标签同步增强**：Zotero 插件通过现有 `PATCH /external-api/v1/papers/:id/tags` 同步标签，自动创建不存在的标签

## Capabilities

### New Capabilities
- `tag-management`: 标签管理页面 — 重命名（同名合并确认）、删除（确认）、颜色设置
- `tag-color-system`: 标签颜色分配、存储、前端缓存机制
- `paper-tag-filter`: 论文列表按标签筛选、论文详情标签点击跳转
- `paper-tag-assignment`: 手动添加论文时的标签选择/创建、论文标签的增删改

### Modified Capabilities
- `database-schema`: 新增 `tags.color` 字段、`papers.tags_json` 冗余字段
- `zotero-paper-lookup`: Zotero 插件通过 External API 同步标签

## Impact

- **Backend**: 新增 `/api/tags` 路由文件、修改 DB schema（迁移）、修改 papers API 返回标签颜色信息
- **Frontend**: 新增 TagManagement.vue 页面、TagSelector 组件、修改 PaperList/PaperDetail/App.vue、新增 tags Pinia store
- **Shared**: 扩展 Tag 类型增加 color 字段、新增标签相关 API 类型
- **External API**: 现有标签端点增强（自动创建标签时分配颜色）
- **Database**: 需要新的 Drizzle 迁移

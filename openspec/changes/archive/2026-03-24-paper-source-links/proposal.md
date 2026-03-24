## Why

论文列表中的 "arXiv ID" 列功能单一，只能显示 arXiv 论文的 ID。对于非 arXiv 来源的论文（如博客文章、会议网站等），没有任何来源信息展示。用户需要一个统一的"来源"列，能够以可点击标签的形式展示论文的原始链接，支持 arXiv 和任意 URL 来源。

## What Changes

- **新增 `link` 字段**：在 papers 表中添加 `link` 列，存储论文的原始来源 URL
- **arXiv 论文自动生成链接**：有 arxiv_id 的论文自动设置 link 为 `https://arxiv.org/abs/{arxiv_id}`
- **已有数据回填**：为数据库中已存在的有 arxiv_id 但无 link 的论文补充链接
- **前端"arXiv ID"列改为"来源"列**：
  - arXiv 论文：红色标签，显示 `arxiv:2306.13649`，点击跳转 arXiv abs 页面
  - 其他 URL 来源：灰色标签，显示域名（如 `mem.ac`），点击跳转原始链接
  - 无来源：显示 `-`
- **手动创建论文时支持设置链接**：在 Manual Input 创建模式中增加 link 输入框
- **API 创建论文时支持 link 参数**：内部 API 和外部 API 均支持传入 link

## Capabilities

### New Capabilities
- `paper-source-link`: 论文来源链接功能 — 包括 link 字段的存储、自动生成、数据回填、前端来源标签展示

### Modified Capabilities
- `database-schema`: 新增 papers 表的 `link` 列

## Impact

- **数据库**：papers 表新增 `link` 列（nullable text），需要 migration
- **后端 API**：`POST /api/papers` 和 `POST /external-api/v1/papers` 需支持 link 参数
- **后端服务**：arxiv_service 执行后需自动设置 link
- **共享类型**：Paper 类型需新增 link 字段
- **前端**：PaperList.vue 列显示改造，创建表单增加 link 输入
- **Zotero 插件**：可选 — 未来可从 Zotero item URL 提取 link

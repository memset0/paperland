## Why

读一篇论文时,常会找到一些对理解它有帮助的外部资源——别人的博客解读、作者的项目主页、相关讨论帖等。目前这些只能记在脑子里或散落在别处,没有地方挂到论文上。我们需要让用户为每篇论文维护一个**手动添加的参考链接列表**,把这些外部资源沉淀在论文详情页里。

## What Changes

- **新增"参考链接"能力**:每个用户可以为每篇论文维护一份**私有**的参考链接列表(与笔记、标签一致,按 `(user_id, paper_id)` 私有,互不可见)。
- **每条链接包含三个字段**:`title`(标题,必填)、`url`(链接,必填)、`description`(描述,**可选**)。列表按添加顺序(`created_at`)展示。
- **完整的增删改查**:用户可以新增链接、编辑已有链接、删除链接;匿名访问只读且返回空列表(沿用笔记的处理方式)。
- **论文详情页新增"参考链接"区块**:在右侧信息栏(标签区块附近)展示链接列表,标题作为可点击的超链接(新标签页打开),描述作为次要说明文字;提供添加/编辑/删除的内联交互。
- **数据层新增 `paper_reference_links` 表**:per-user 子表,外键关联 `users` 与 `papers`,随论文删除一并清理。

## Capabilities

### New Capabilities
- `paper-reference-links`: 每个用户为每篇论文维护一份私有的参考链接列表(标题 + 链接 + 可选描述),支持新增/编辑/删除/列出;匿名只读返回空;论文详情页提供展示与编辑入口。

### Modified Capabilities
<!-- 无:本变更只新增一个独立能力,不改动任何现有 spec 的需求。 -->

## Impact

- **Database**:新增 `paper_reference_links` 表(`id`、`user_id` FK、`paper_id` FK、`title`、`url`、`description` 可空、`created_at`、`updated_at`);新增 Drizzle migration(下一个序号 `0016`);在 `(paper_id, user_id)` 上建索引。
- **Backend**:`db/schema.ts` 新增表定义;新增 `api/reference_links.ts` 路由文件(`GET /api/papers/:id/reference-links`、`POST /api/papers/:id/reference-links`、`PATCH /api/reference-links/:id`、`DELETE /api/reference-links/:id`),写操作经 `requireUser`、带 owner 校验与 URL/标题校验;在 `index.ts` 注册路由。
- **Shared**:`packages/shared/src/types.ts` 新增 `PaperReferenceLink` 接口(snake_case 字段)。
- **Frontend**:`api/client.ts` 新增 `referenceLinksApi`(getForPaper/create/update/remove);新增 `components/ReferenceLinksSection.vue` 区块组件;`views/PaperDetail.vue` 在信息栏接入该区块。
- **Reused**:沿用标签的"编辑态 ref + 保存后刷新"交互模式、笔记的"匿名只读返回空"与 owner 校验模式、`api.{get,post,patch,delete}` 客户端封装。
- **Docs**:更新 `docs/frontend-architecture.md`(参考链接区块)、`docs/tech-stack.md`(`paper_reference_links` 表)。External API 不暴露,`docs/external-api.md` 无需改动。

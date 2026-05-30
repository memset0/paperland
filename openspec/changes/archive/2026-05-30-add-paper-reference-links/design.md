## Context

论文详情页右侧信息栏已经承载了标签(per-user)、笔记入口等"挂在论文上的用户数据"。本变更新增同类的一种:**参考链接**——用户手动收集的、指向论文之外资源(博客解读、项目主页、讨论帖等)的链接列表。

现有可复用的模式:

- **per-user 子表**:`notes`、用户标签关联均以 `(user_id, paper_id)` 私有,外键引用 `users`/`papers`,`created_at`/`updated_at` 为 ISO 8601 文本。
- **CRUD 路由**:`api/notes.ts` 用 `POST /api/papers/:id/notes` 建、`PATCH /api/notes/:id` 改、`DELETE /api/notes/:id` 删,写操作 `{ preHandler: requireUser }` 且做 owner 校验;读操作匿名时返回空集合。
- **前端编辑态**:`PaperDetail.vue` 的标签区块用 `isEditingX` ref + 保存后 `fetchPaper` 刷新;`api/client.ts` 暴露 `api.{get,post,patch,delete}` 与按资源分组的 `xxxApi`。

约束:snake_case 贯穿 DB/API/JSON;SQLite + Drizzle(`bun:sqlite`);migration 由 `drizzle-kit generate` 生成,下一个序号 `0016`。

## Goals / Non-Goals

**Goals:**

- 用户能为每篇论文新增/编辑/删除/查看一份**私有**参考链接列表。
- 每条链接含 `title`(必填)、`url`(必填)、`description`(可选)。
- 列表稳定按添加顺序展示(`created_at` 升序,id 兜底)。
- 复用现有 per-user 子表 + CRUD + 编辑态模式,保持一致性,零新依赖。
- 匿名访问只读、返回空列表,不报错(对齐笔记)。

**Non-Goals:**

- **不做拖拽排序**:MVP 仅按添加顺序;手动重排留待将来(如需再加 `sort_order`)。
- **不做链接元数据抓取**:不抓取目标页面的标题/favicon/Open Graph,标题完全由用户填写。
- **不在 External API 暴露**:参考链接是站内私有数据,不进 `/external-api/*`(Zotero 等)。
- **不做全局/共享链接**:本变更确定为 per-user 私有(见决策);全局共享不在范围内。
- **不校验链接可达性**:只做格式校验,不发请求探活。

## Decisions

### 决策 1:per-user 私有,而非全局共享

参考链接与笔记、标签一样按 `(user_id, paper_id)` 私有。

- **理由**:与站内既有"用户挂在论文上的数据"模型一致;auth 支持多用户,私有避免互相覆盖;用户诉求是"我自己添加/维护"。
- **取舍**:博客链接本身偏"客观资源",全局共享理论上能减少重复录入。但全局会引入"谁能编辑/删除他人录入"的权限问题,且与现有 per-user 模型不一致。选私有,schema 与权限都最简单、最一致。
- **实现**:表含 `user_id` 外键;所有查询都带 `user_id` 过滤;写操作校验 `link.user_id === request.user.id`。

### 决策 2:独立子表 `paper_reference_links`,而非塞进 papers 的 JSON 列

新建一张表,而不是往 `papers.metadata` 之类的 JSON 字段塞数组。

- **理由**:需要 per-user 私有(JSON 列是全局的,无法 per-user);需要逐条增删改与独立 id;子表是现成、可索引、可随论文级联清理的模式。
- **Schema**:

  ```ts
  export const paperReferenceLinks = sqliteTable('paper_reference_links', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id').notNull().references(() => users.id),
    paper_id: integer('paper_id').notNull().references(() => papers.id),
    title: text('title').notNull(),
    url: text('url').notNull(),
    description: text('description'),            // 可空
    created_at: text('created_at').notNull(),    // ISO 8601
    updated_at: text('updated_at').notNull(),
  }, (table) => [
    index('idx_paper_reference_links_paper_user').on(table.paper_id, table.user_id),
  ])
  ```

- **排序**:查询 `ORDER BY created_at ASC, id ASC`。

### 决策 3:REST 形态对齐 notes

- `GET /api/papers/:id/reference-links` — 列出当前用户在该论文下的链接;匿名 → `{ data: [] }`。
- `POST /api/papers/:id/reference-links` — 建,body `{ title, url, description? }`,`requireUser`,返回 `201 { data: link }`。
- `PATCH /api/reference-links/:id` — 改,body 任意子集 `{ title?, url?, description? }`,`requireUser` + owner 校验,返回 `{ data: link }`。
- `DELETE /api/reference-links/:id` — 删,`requireUser` + owner 校验,返回 `{ success: true }`。

集合路由挂在 `/api/papers/:id/...`,单条操作路由挂在 `/api/reference-links/:id`,与 notes(`/api/papers/:id/notes` + `/api/notes/:id`)一致。响应统一包一层 `{ data }`(对齐 notes)。

### 决策 4:校验规则

- `url`:必填,trim 后非空;必须能被 `new URL()` 解析且协议为 `http`/`https`(拒绝 `javascript:` 等)。非法 → `400`。
- `title`:必填,trim 后非空;限长(如 ≤ 200 字符)。空 → `400`。
- `description`:可选;`null`/缺省/空串都视为无描述(存 `null`);限长(如 ≤ 1000 字符)。
- `PATCH` 只更新出现的字段;`title`/`url` 若出现则同样校验非空与格式;同时刷新 `updated_at`。
- owner:`PATCH`/`DELETE` 命中的记录若不属于当前用户或不存在 → `404`(不泄露存在性)。

### 决策 5:前端区块独立成组件

新增 `components/ReferenceLinksSection.vue`,接受 `paperId`,内部用 `referenceLinksApi` 自取自管;`PaperDetail.vue` 在标签区块附近引入。

- **理由**:链接区块自带列表 + 内联增删改表单,逻辑量比标签大,独立组件比内联进 `PaperDetail.vue` 更清晰;也便于复用。
- **展示**:每条 = 标题(`<a :href="url" target="_blank" rel="noopener noreferrer">`)+ 可选描述(次要灰字);末尾"添加链接"按钮展开内联表单(title/url/description 三个输入)。每条 hover 出现编辑/删除。
- **状态**:组件内 `links` ref + `loading`/编辑态 ref;增删改后就地更新或重新 `getForPaper` 刷新。无需新建 Pinia store(数据局限于当前论文页)。
- **文案语言**:区块标题用中文"参考链接",对齐相邻的"标签"区块(注:笔记区块按既有约定用英文 Notes/Walkthrough,本区块不属于笔记体系,故随中文信息栏)。

## Risks / Trade-offs

- **无排序能力** → 按 `created_at` 升序展示,语义稳定;将来要重排再加 `sort_order` 列与拖拽,不影响现有数据。
- **标题必填可能略繁** → 用户每条都要填标题(仅 description 可选,依用户明确要求)。若日后嫌烦可放宽为"标题缺省时回退显示 url",改动仅在校验层与展示层,数据兼容。
- **URL 协议白名单** → 仅放行 `http/https`,可能挡掉个别合法 scheme;但能防 `javascript:`/`data:` 等 XSS 向量,前端再加 `rel="noopener noreferrer"`,取安全优先。
- **级联清理** → 论文删除路径需一并删除其 `paper_reference_links`(与现有子表清理一致);若论文删除是软删/不存在,则随外键约束与现状保持一致。

## Migration Plan

1. 在 `db/schema.ts` 增表定义。
2. `cd packages/backend && bunx drizzle-kit generate` 生成 `0016_*.sql`(纯新增表 + 索引,无破坏性变更,无需回填)。
3. 部署后旧数据不受影响(新表为空);回滚即 drop 该表,论文及其它数据无依赖。

## Open Questions

- 暂无。(per-user / 字段 / description 可选 均已与用户确认。)

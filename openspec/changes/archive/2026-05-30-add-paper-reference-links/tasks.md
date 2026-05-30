## 1. 数据层

- [x] 1.1 在 `packages/backend/src/db/schema.ts` 新增 `paperReferenceLinks` 表(`id` PK 自增、`user_id` FK→users、`paper_id` FK→papers、`title` text notNull、`url` text notNull、`description` text 可空、`created_at`/`updated_at` text notNull),并在 `(paper_id, user_id)` 建索引。
- [x] 1.2 运行 `cd packages/backend && bunx drizzle-kit generate` 生成 migration `0016_*.sql`,确认仅为"建表 + 索引"无破坏性变更,提交生成的 `.sql` 与 `meta/` 快照。

## 2. 共享类型

- [x] 2.1 在 `packages/shared/src/types.ts` 新增 `PaperReferenceLink` 接口:`{ id: number; user_id: number; paper_id: number; title: string; url: string; description: string | null; created_at: string; updated_at: string }`(snake_case 字段)。

## 3. 后端 API

- [x] 3.1 新增 `packages/backend/src/api/reference_links.ts`,导出 `async function referenceLinksRoutes(app: FastifyInstance)`,并在 `packages/backend/src/index.ts` 注册。
- [x] 3.2 实现 `GET /api/papers/:id/reference-links`:返回当前用户在该论文下的链接,按 `created_at ASC, id ASC` 排序,响应 `{ data: PaperReferenceLink[] }`;匿名(无 user)返回 `{ data: [] }`。
- [x] 3.3 实现 `POST /api/papers/:id/reference-links`(`preHandler: requireUser`):校验 `title`(trim 非空、限长)、`url`(可被 `new URL()` 解析且 scheme 为 http/https)、`description`(可选,空→null、限长);插入并返回 `201 { data: link }`,非法输入返回 `400`。
- [x] 3.4 实现 `PATCH /api/reference-links/:id`(`preHandler: requireUser`):owner 校验(非本人或不存在→`404`),仅更新出现的字段,对出现的 `title`/`url` 复用同一校验,刷新 `updated_at`,返回 `{ data: link }`。
- [x] 3.5 实现 `DELETE /api/reference-links/:id`(`preHandler: requireUser`):owner 校验(→`404`),删除并返回 `{ success: true }`。
- [x] 3.6 在论文删除路径中级联清理该论文的 `paper_reference_links`(对齐其它 per-user 子表的清理方式)。

## 4. 前端 API 客户端

- [x] 4.1 在 `packages/frontend/src/api/client.ts` 新增 `referenceLinksApi`:`getForPaper(paperId)`(失败/匿名兜底返回 `{ data: [] }`)、`create(paperId, { title, url, description? })`、`update(id, { title?, url?, description? })`、`remove(id)`,复用 `api.{get,post,patch,delete}`。

## 5. 前端 UI

- [x] 5.1 新增 `packages/frontend/src/components/ReferenceLinksSection.vue`:接受 `paperId` prop,挂载时 `getForPaper` 拉取并维护 `links` 列表;渲染区块标题"参考链接"。
- [x] 5.2 列表项渲染:标题为 `<a :href="url" target="_blank" rel="noopener noreferrer">{{ title }}</a>`;有 `description` 时在标题下方以次要灰字展示;每项 hover 显示编辑/删除按钮。
- [x] 5.3 添加/编辑内联表单:title、url、description(可选)三个输入 + 保存/取消;前端做最小校验(title/url 非空),保存调用 `create`/`update` 后就地刷新列表;删除调用 `remove` 后就地移除。
- [x] 5.4 在 `packages/frontend/src/views/PaperDetail.vue` 信息栏(标签区块附近)引入 `ReferenceLinksSection`,传入当前 `paperId`(宽屏 split view 与窄屏 single column 两处均接入)。

## 6. 文档

- [x] 6.1 更新 `docs/frontend-architecture.md`:描述论文详情页"参考链接"区块及其交互。
- [x] 6.2 更新 `docs/tech-stack.md`:在数据表清单中加入 `paper_reference_links`(per-user 子表)。

## 7. 验证

- [x] 7.1 后端针对 `reference_links` 路由补充单元测试(创建/校验失败/owner 校验 404/匿名只读返回空/排序),`bun test packages/backend/src/api/reference_links.test.ts` 全部通过(12 项,不触发外部 API)。
- [x] 7.2 验证:后端行为经路由级 inject 测试覆盖;迁移在真实库副本上干净应用(表 + 索引齐备、可查询);前端 `vue-tsc` 对改动文件零类型错误。注:真实浏览器点击需 dev server 重载后由用户在论文详情页确认(共享运行实例为其他 agent 所有,未强制重启)。

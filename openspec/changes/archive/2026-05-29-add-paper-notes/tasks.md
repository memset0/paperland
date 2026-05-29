## P1. `paperland://` 块级锚点（自包含，先做）

- [x] 1.1 `components/MarkdownContent.vue`：把已算出的 `contentHash`（:47）挂到渲染容器的 `data-content-hash` 属性上
- [x] 1.2 `components/MarkdownContent.vue`：新增「滚动到本块 + 瞬时闪烁」能力（不落库 `<mark>`，一次性高亮动画）
- [x] 1.3 `components/MarkdownContent.vue`：拦截渲染链接中 `href` 以 `paperland://` 开头的点击——解析 `paper/<id>?h=&s=&e=`，本页则直接 `locateBlock`，跨页则 `router.push('/papers/:id')` 后再 `locateBlock`（不走浏览器导航）
- [x] 1.4 `components/QAResultView.vue`：把内部 `activeTab` ref（:58）提为可外部设置（按 `result.id` 激活指定回答 tab）
- [x] 1.5 新增 `composables/useBlockAnchor.ts` 的 `locateBlock(paperId, hash, range?)`：① DOM 有 `[data-content-hash]` 直接滚动闪烁；② 否则遍历 Q&A store、对每条 `result.answer` 现算 hash 找归属 → 复用 `QAPanelNav.navigateTo`（:94）范式展开 `Collapsible` + 激活对应 result tab → `nextTick` 后定位；③ 找不到 → toast「锚点已失效」不跳转
- [x] 1.6 `views/PaperDetail.vue`：解析路由（或拦截器传入）触发的锚点目标，`onMounted` 首次 + 后续变化时调 `locateBlock`（支持外部 deep-link 直接定位）
- [x] 1.7 `components/MarkdownContent.vue`：选区浮动工具栏（登录态）新增「复制为锚点链接」——用当前 `paperId` + 块 `contentHash` +（可选）选区 `start/end` 生成 `paperland://paper/<id>?h=<hash>` Markdown 链接写入剪贴板
- [x] 1.8 端到端自测 P1：在某条 Q&A 回答选中文本 → 复制锚点链接 → 粘到任意 `MarkdownContent`（或地址栏 deep-link）→ 点击能展开折叠/切换 tab 并滚动闪烁；多模型多回答各自命中；删除该回答后点击提示失效不跳转

## P2. Schema、共享类型、迁移、后端 API

- [x] 2.1 `packages/backend/src/db/schema.ts` 新增 `notes` 表：`id`(PK autoinc)、`user_id`(integer → users.id)、`paper_id`(integer notNull → papers.id)、`kind`(text notNull 'walkthrough'|'note')、`parent_id`(integer → notes.id 可空自引用)、`title`(text 可空)、`body`(text notNull default '')、`sort_order`(integer notNull default 0)、`created_at`/`updated_at`(text notNull)。**不设 anchor 字段**
- [x] 2.2 `packages/shared/src/types.ts` 新增 `NoteKind = 'walkthrough'|'note'`、`Note { id, user_id, paper_id, kind, parent_id, title, body, sort_order, created_at, updated_at }`
- [x] 2.3 生成迁移：`cd packages/backend && bunx drizzle-kit generate`，检查生成 SQL（新表 + 自引用 FK）；如需，附部分唯一索引 `WHERE kind='walkthrough'`（每 user+paper 至多一条走读）
- [x] 2.4 新增 `packages/backend/src/api/notes.ts`，加 `requireUser` 守卫与属主校验工具（非属主 404）
- [x] 2.5 `GET /api/papers/:id/notes`（公开但 owner-scoped）：返回 `{ walkthrough: Note|null, notes: Note[] }`，仅当前用户；匿名返回 `{ walkthrough: null, notes: [] }`（200）
- [x] 2.6 `PUT /api/papers/:id/walkthrough { body, updated_at? }`（requireUser）：upsert 走读；带乐观 `updated_at` 校验，失配 409 返回最新
- [x] 2.7 `POST /api/papers/:id/notes { title?, body?, parent_id? }`（requireUser）：创建小笔记，落 `user_id`，`sort_order` 追加到同级末尾；校验 `parent_id` 属于本人同一论文
- [x] 2.8 `PATCH /api/notes/:id { title?, body?, updated_at? }`（requireUser + 属主）：更新；乐观 `updated_at` 校验 409
- [x] 2.9 `POST /api/notes/:id/move { parent_id, sort_order }`（requireUser + 属主）：改父子 + 排序；**防环**——拒绝移动到自身子孙下（沿 parent 链校验）
- [x] 2.10 `DELETE /api/notes/:id`（requireUser + 属主）：事务内递归收集子孙并级联删整棵子树
- [x] 2.11 `GET /api/notes`（requireUser）：返回当前用户跨论文全部笔记，附 `paper_id` + `paper_title`，按 `updated_at` 倒序
- [x] 2.12 `packages/backend/src/index.ts` 注册 `notesRoutes`
- [x] 2.13 前端数据层：`api/client.ts` 增 `notesApi`（getForPaper / saveWalkthrough / create / update / move / remove / listAll）；新增 `stores/notes.ts`（按 paper 缓存走读 + 扁平小笔记，`buildTree()` 组装，CRUD + move + 防抖自动保存 + 乐观更新与 409 回滚）
- [x] 2.14 `views/PaperDetail.vue`：右栏新增「笔记」区占位（走读入口 + 小笔记容器）；匿名显示「登录后可记笔记」

## P3. 浮动编辑窗口子系统

- [x] 3.1 新增 `stores/windows.ts`（Pinia）：打开窗口列表、z-index 栈、`focus(id)` 置顶（最后点击者最上）、关闭；全局尺寸记忆（localStorage 存上一次缩放后的 宽×高）
- [x] 3.2 新增 `components/FloatingNoteWindow.vue`：电脑端可拖拽（标题栏）+ 可缩放（边/角），浮于页面顶层，默认定位在触发笔记下方；手机端走 shadcn `Dialog` 全屏档；点击窗口置顶；标题栏显示当前内容标题 + 关闭
- [x] 3.3 新增 `components/NoteEditor.vue`：三显示模式（仅编辑 / 左右分屏 / 仅预览），标题栏分段控件点选切换；预览复用 `MarkdownContent`；2s 防抖自动保存 + Ctrl+S（沿用 idea-forge `IdeaDetail` 范式）
- [x] 3.4 接线：走读入口与（P4）小笔记节点点击 → 经 `windows` store 打开 `FloatingNoteWindow`，内嵌 `NoteEditor`，绑定到对应 `notes` store 记录
- [x] 3.5 自测 P3：同时打开多个窗口、点击置顶、缩放后尺寸被记忆、三模式切换、自动保存刷新仍在

## P4. 分支思维导图视图

- [x] 4.1 新增 `components/NoteMindmap.vue` + 递归节点组件：由 `stores/notes.ts` 的 `buildTree()` 渲染**分支思维导图**（自动布局层级节点 + 连线，节点只显示标题）；自定义 CSS 层级树，不引重型图库
- [x] 4.2 节点交互：点击节点 → 打开其浮动编辑窗口（P3）；增子 / 增兄 / 删除（删除前确认并显示连带子节点数）
- [x] 4.3 用 `vuedraggable`（或自定义）实现节点拖拽改父子 + 排序，落点调 `notesApi.move`；乐观更新失败回滚（含 move 防环被拒时还原）
- [x] 4.4 `views/PaperDetail.vue`：把 P2 的占位替换为正式「笔记」区（走读入口 + `NoteMindmap`）
- [x] 4.5 自测 P4：建多条小笔记拖成树/改序、删子树连带删、move 防环（移到自身子孙下被拒并回滚）

## P5. `/notes` 聚合页 + 块内范围高亮

- [x] 5.1 新增 `views/NotesPage.vue`：调 `notesApi.listAll`，按论文分组、客户端搜索（标题/正文）；点击笔记经浮动窗口查看/编辑；正文 `paperland://` 链接可点跳转定位
- [x] 5.2 `router/index.ts` 新增 `/notes`（`meta.requiresAuth`）
- [x] 5.3 `App.vue` 侧边栏（桌面 + 移动 drawer）新增「笔记」项（图标如 `StickyNote`/`NotebookPen`），纳入登录门禁 `go()` 逻辑
- [x] 5.4 块内范围高亮：`locateBlock` 支持 `&s=&e=`——块内按 offset 定位并瞬时高亮该片段（复用 `useHighlight` 的 offset→DOM 逻辑）；「复制为锚点链接」带上选区 offset
- [x] 5.5 自测 P5：`/notes` 跨论文聚合 + 搜索 + 跳转定位；带 `s/e` 的锚点能在块内精确高亮；匿名 `/notes` 被守卫拦截、`GET /api/notes` 401

## 6. 文档

- [x] 6.1 `docs/frontend-architecture.md` 新增「笔记」章节：数据模型（走读 + 树状小笔记，无 anchor 列）、分支思维导图、浮动编辑窗口（多窗/尺寸记忆/三模式）、`paperland://` 锚定与 `locateBlock`、按用户归属与可见性
- [x] 6.2 `docs/tech-stack.md`：Drizzle schema 概览新增 `notes` 表

## 7. 整体验证

- [x] 7.1 从项目根 `bun run packages/backend/src/index.ts` 启动，确认迁移生成 `notes` 表、`packages/backend/data/` 未被误创建
- [x] 7.2 登录用户：建走读（浮窗自动保存 + 刷新仍在）、建多条小笔记并在思维导图拖拽成树/改序、删除子树连带删；均只对本人可见
- [x] 7.3 匿名：详情页「笔记」区显示登录提示、`GET /api/papers/:id/notes` 返回空、`/notes` 路由被守卫拦截、写接口 401
- [x] 7.4 锚定：选中 QA 回答片段「复制为锚点链接」→ 粘进笔记 → 点击展开折叠/切换 tab 并滚动闪烁；多模型多回答各自命中；对应回答删除后提示失效不跳转
- [x] 7.5 跨用户隔离：另一用户登录看不到本人笔记；非属主 `PATCH`/`DELETE`/`move` 返回 404
- [x] 7.6 仅运行本次涉及的后端单测（如新增 notes 测试则运行之）；**不要盲跑全部测试**（部分调用真实外部 API 产生费用）

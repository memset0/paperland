## Why

读论文时，用户需要一块属于自己的记录空间：既要能写一篇完整的「走读（walkthrough）」长文，也要能随手记很多碎片小笔记，并把这些小笔记按层级组织成「思维导图状」的结构，还能把笔记里的某处通过链接锚定到论文某页、或某条 Q&A 回答里的具体片段。当前 Paperland 只有「高亮 + 单条高亮备注」，没有面向整篇论文的笔记能力。鉴权改动已为按用户私有的数据预留了归属模型（`user_id`），现在落地笔记功能正当其时。

## What Changes

- 新增 **per-user、per-paper 的笔记体系**，分两类：
  - **走读 walkthrough**：每个用户对每篇论文至多一篇大的、线性结构的 Markdown 长文。
  - **小笔记 note**：每篇论文下可建任意多条小笔记，每条是独立的 Markdown 文档；通过 `parent_id` 自引用形成**树**，并以**分支思维导图**视图（节点只显示标题、点击展开）呈现，可拖拽改父子与排序。
- **锚定 = 正文内联 Markdown 链接（`paperland://` 协议）**：在任意笔记正文里写形如 `paperland://paper/<id>?h=<content_hash>` 的链接即可锚定。点击 → 跳到该论文页 → 定位并瞬时闪烁对应的 `MarkdownContent` 块（论文页 / 某条 Q&A 回答）。
  - 锚定基于**块的 `content_hash`**（复用现有高亮的块指纹），**不依赖问题/回答的 id 或下标**；`content_hash` 具体对应哪条回答由**前端在数据里现算反查**。这样多模型多次回答、重新生成、重新排序都不会让锚点跑偏。
  - `h` 省略 = 仅跳论文页；可选 `&s=<start>&e=<end>` 表示块内文本范围（P1 先做整块定位，范围高亮后续阶段）。
  - 选区浮动工具栏（即现有高亮工具栏）新增「**复制为锚点链接**」：选中一段 Q&A / Markdown 文本即生成对应 `paperland://` 链接，粘进任意笔记正文即可。
- **浮动编辑窗口**：走读与小笔记**都**在浮动窗口里做 Markdown 编辑——手机端点击编辑弹出全屏窗口；电脑端弹出可自由拖拽、可缩放的浮动小窗（默认在该笔记下方、浮于页面顶层）。窗口尺寸全局记忆、可多窗并存（最后点击者置顶）、有三种显示模式（仅编辑 / 左右分屏 / 仅预览）。
- **两个入口**：论文详情页新增**「笔记」区**（走读入口 + 小笔记思维导图）；新增独立 **`/notes` 页**，跨论文聚合展示当前用户的全部笔记，可搜索、可跳转到对应论文。
- **按用户私有**：笔记只能本人查看与编辑（owner-scoped 读、登录后写、匿名看不到），与 free Q&A / 高亮一致。`/notes` 页与「笔记」区对未登录用户提示登录。
- **侧边栏**新增「笔记」入口（与其它受限项一样登录后可用）。

## Capabilities

### New Capabilities
- `markdown-anchors`: `paperland://` 锚点链接协议 + 基于 `content_hash` 的块寻址；`MarkdownContent` 暴露 `data-content-hash` 并拦截 `paperland://` 链接；`locateBlock(paperId, hash)` 定位逻辑——DOM 命中直接滚动闪烁，未命中则在 Q&A store 现算 hash 反查归属、展开其 Collapsible 并激活对应 result tab 后再定位；锚点失效（对应回答已删）则优雅降级不跳转。
- `paper-notes`: 笔记数据模型（walkthrough + 树状小笔记，`parent_id` 自引用 + `sort_order`）、后端 owner-scoped notes API（含子树级联删、move 防环）、论文详情页「笔记」入口、按用户归属与访问控制。
- `note-editor-window`: 浮动 Markdown 编辑窗口子系统——手机全屏 / 电脑可拖拽可缩放浮窗、全局尺寸记忆、多窗叠放（最后点击置顶）、三种显示模式（仅编辑 / 分屏 / 仅预览）、标题栏显示当前内容标题；走读与小笔记复用，逻辑全在前端。
- `note-mindmap`: 小笔记的分支思维导图视图——节点只显示标题，点击节点打开其浮动编辑窗口，拖拽改父子与排序（落点调 move 端点）。
- `notes-page`: 独立 `/notes` 聚合页——登录后展示当前用户跨论文的全部笔记（走读 + 小笔记），支持搜索、点击经浮动窗口查看/编辑并跳转到论文。

### Modified Capabilities
- `markdown-highlight`: 选区浮动工具栏新增「复制为锚点链接」动作，从当前选区的论文 + 块 `content_hash`（+ 可选 offset）生成 `paperland://` 链接。
- `responsive-nav`: 侧边栏新增「笔记」导航项，遵循既有登录门禁（未登录显示但点击提示登录）。

## Impact

- **Database / schema**：新增 `notes` 表（`id`、`user_id`→users.id、`paper_id`→papers.id、`kind` 'walkthrough'|'note'、`parent_id`→notes.id 自引用可空、`title` 可空、`body` Markdown、`sort_order`、`created_at`、`updated_at`）；**不设结构化 anchor 字段——锚点以 `paperland://` 链接形式存在于 `body` 内**；每 (user, paper) 至多一条 `walkthrough`；新增 Drizzle migration。
- **Backend**：新增 `api/notes.ts`（`GET /api/papers/:id/notes`、`PUT /api/papers/:id/walkthrough`、`POST /api/papers/:id/notes`、`PATCH /api/notes/:id`、`POST /api/notes/:id/move`、`DELETE /api/notes/:id` 子树级联、`GET /api/notes`）；全部 owner-scoped + `requireUser`；`index.ts` 注册路由；`shared/src/types.ts` 增 `Note` / `NoteKind` 类型。锚定纯前端，无需后端字段。
- **Frontend**：
  - 锚点（P1）：`MarkdownContent.vue` 加 `data-content-hash` + 滚动闪烁能力 + `paperland://` 链接拦截；新增 `composables/useBlockAnchor.ts`（`locateBlock`）；`QAResultView.vue` 把 `activeTab` 提为可外部设置；`views/PaperDetail.vue` 监听 `route` 并处理初次/后续锚点跳转。
  - 数据层：新增 `api/client.ts` 的 `notesApi`、`stores/notes.ts`（按 paper 缓存走读 + 扁平小笔记，`buildTree()` 组装，CRUD + move + 防抖自动保存 + 409 回滚）。
  - 编辑窗口：新增 `components/FloatingNoteWindow.vue` + `stores/windows.ts`（多窗管理 / z-index 栈 / 尺寸记忆）+ `components/NoteEditor.vue`（三模式 + 自动保存 + Ctrl+S，预览复用 `MarkdownContent`）。
  - 视图：新增 `components/NoteMindmap.vue` 及递归节点组件、`views/NotesPage.vue`；`router/index.ts` 增 `/notes`（requiresAuth）；`App.vue` 侧边栏增「笔记」项；`views/PaperDetail.vue` 嵌入「笔记」区。
- **Docs**：更新 `docs/frontend-architecture.md`（新增「笔记」章节：数据模型、思维导图、浮动编辑窗口、`paperland://` 锚定与 `locateBlock`、归属可见性）、`docs/tech-stack.md`（`notes` 表）。
- **复用**：`MarkdownContent`（渲染 + 数学 + 块 `content_hash`）、`useHighlight`（选区 offset）、`QAPanelNav.navigateTo` 的展开+滚动范式、idea-forge 自动保存范式、auth 的 owner-scoped 读写与 `requireUser` 守卫。

## Phasing

实现按以下阶段推进（详见 tasks.md）：

- **P1 — `paperland://` 块级锚点**：`data-content-hash` + `locateBlock` + 链接拦截 + 选区「复制为锚点链接」。自包含、可独立验收，与笔记数据模型解耦。
- **P2 — 笔记数据模型与 API**：`notes` 表 + owner-scoped 后端 + 详情页入口。
- **P3 — 浮动编辑窗口**：窗口组件 + windows store + 尺寸记忆 + 多窗叠放 + 三模式。
- **P4 — 分支思维导图视图**：节点视图 + 点击开窗 + 拖拽改父子。
- **P5 — `/notes` 聚合页 + 块内 `s`/`e` 范围高亮**。

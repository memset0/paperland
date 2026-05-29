## Context

Paperland 现有「文本高亮」（`highlights` 表 + `MarkdownContent.vue` + `composables/useHighlight.ts`）：在任意 `MarkdownContent` 渲染块上，用渲染后纯文本的 `start/end offset` + 该块 `content_hash`（`MarkdownContent.vue:47`，MD5(去空白)）+ 页面 `pathname` 定位一段文本并包 `<mark>`。idea-forge 的 `IdeaDetail.vue` 提供了「Markdown 编辑/预览 + 防抖自动保存 + Ctrl+S」范式。鉴权改动已落地按用户私有数据的归属模型（`user_id` 外键 + owner-scoped 读 + `requireUser` 守卫 + 匿名读返回空）。

Q&A 的真实渲染：一个问题 `qa_entries` 对应多条 `qa_results`（每模型一条，每次重新生成又新增一条，各有独立 id）。前端 `QAList.vue` 把每个问题包在**默认折叠**的 `Collapsible`（状态存 localStorage）里；多条回答时 `QAResultView.vue:68` 渲染成 **Tabs**（tab key = `qa_result.id`），**只有激活 tab 的 `MarkdownContent` 在 DOM 中**。论文正文在详情页是 **PDF / iframe**（`PaperViewerPanel.vue`），不是 `MarkdownContent`。`QAPanelNav.vue:94` 的 `navigateTo` 已实现「找到 `[data-qa-entry]` → 关闭则 click 展开 → scrollIntoView」。

本功能要做的是**面向整篇论文的笔记**：每篇论文一篇大走读 + 一棵小笔记树（以分支思维导图呈现），笔记正文里可用 `paperland://` 内联链接锚定到论文页或某条 Q&A 回答片段；走读与小笔记都在浮动窗口里编辑；按用户私有；有论文详情页入口与独立 `/notes` 页。

用户已确认的关键设计：
- 锚定 = **正文内联 `paperland://` 链接**，基于**块 `content_hash`**（不是 entry/result 的 id 或下标），`s`/`e` 可选，hash 归属由前端现算反查。
- 小笔记树用**分支思维导图**视图（非缩进大纲、也非自由画布）。
- 走读与小笔记**都**在**浮动编辑窗口**里编辑，点击节点开窗。

## Goals / Non-Goals

**Goals:**
- 每 (用户, 论文) 一篇 walkthrough（线性 Markdown 长文）+ 任意多条小笔记，小笔记经 `parent_id` 成树，可拖拽改父子与排序。
- 笔记正文内联 `paperland://` 链接锚定到论文页 / 某条 Q&A 回答的 `MarkdownContent` 块，点击跳转并瞬时闪烁定位；锚定基于 `content_hash`，对多模型/重生成/重排序稳健。
- 走读与小笔记在浮动 Markdown 编辑窗口中编辑（手机全屏 / 电脑可拖拽可缩放浮窗、尺寸记忆、多窗叠放、三模式）。
- 小笔记以分支思维导图视图呈现，点击节点开编辑窗口。
- 论文详情页「笔记」入口 + 独立 `/notes` 聚合页；防抖自动保存；预览复用 `MarkdownContent`。
- 笔记按用户私有：owner-scoped 读、登录后写、匿名不可见，路由/入口登录门禁。

**Non-Goals:**
- 不做**自由画布**思维导图（自由摆放 + 缩放无限画布）；分支思维导图是自动布局的层级树视图。
- 不锚定 PDF / iframe 内的论文正文坐标（无法可靠 DOM 定位）；锚定面仅限 `MarkdownContent` 渲染的文本（Q&A 回答、摘要/FAQ 等 Markdown 块、以及笔记自身）。
- 不做笔记的多人协作 / 共享 / 版本历史。
- 不把笔记接入 Q&A 上下文或全文检索（`/notes` 页内的客户端搜索除外）。
- 不做富文本 / 所见即所得编辑器，仅 Markdown 源码 + 预览。
- P1 锚点先做**整块定位**；块内 `s`/`e` 范围高亮放到 P5。

## Decisions

### D1. 单表 `notes` + `kind` 判别 + `parent_id` 自引用树（无 anchor 字段）
一张表承载两类笔记：
```
notes(
  id            PK autoinc
  user_id       → users.id        -- 属主
  paper_id      → papers.id
  kind          'walkthrough' | 'note'
  parent_id     → notes.id, nullable   -- 仅 kind='note' 使用；walkthrough 与顶层小笔记为 null
  title         text, nullable    -- 小笔记节点标题；walkthrough 不用
  body          text, default ''  -- Markdown 正文；锚点以 paperland:// 链接形式内联于此
  sort_order    integer default 0 -- 同级排序
  created_at, updated_at text
)
```
- **不设结构化 `anchor` 字段**：锚点是正文里的 `paperland://` Markdown 链接，一条笔记可含任意多个锚点（见 D2），无需额外列。
- 每 (user_id, paper_id) **至多一条** `kind='walkthrough'`：应用层 get-or-create 保证；可加部分唯一索引 `WHERE kind='walkthrough'` 兜底。
- 小笔记森林：`parent_id IS NULL` 为顶层节点；`sort_order` 定同级次序。
- **为何单表**：walkthrough 与小笔记同属"某用户对某论文的笔记"，共享归属/查询/级联；`kind` 区分渲染与约束。

### D2. 锚定 = `paperland://` 内联链接 + `content_hash` 块寻址（前端反查）
锚点不落库为结构化字段，而是写在笔记正文里的自定义协议 Markdown 链接：
```
仅跳论文页:     paperland://paper/<paperId>
块级定位:       paperland://paper/<paperId>?h=<content_hash>
块内范围定位:   paperland://paper/<paperId>?h=<content_hash>&s=<start>&e=<end>
```
- **基于 `content_hash` 而非 entry/result 的 id 或下标**。理由：`content_hash` 是「这段答案文本」的指纹——多模型 = 多个不同 hash，互不混淆；重新生成 = 新建一行新文本新 hash，旧 hash 仍指向旧那条答案（只要还在）；重排序 tab 也不影响。这从根本上避免了「按下标/id 定位却找不到」的脆弱性。
- **`content_hash` 对应哪条回答由前端现算反查**：跳转时遍历该论文的 Q&A store，对每条 `result.answer` 现算 hash（算法同 `MarkdownContent.vue:47`）来确定归属，无需把身份写进链接、也无需后端字段。
- **`MarkdownContent` 拦截 `paperland://` 链接**：渲染出的 `<a href="paperland://...">` 由点击处理器解析（而非浏览器导航）——必要时 `router.push` 到目标论文页，再调 `locateBlock`。
- **`locateBlock(paperId, hash)`**（见 D2a）。
- **为何用链接而非结构化列**：一条笔记天然可引用多处出处；锚点随正文一起编辑/复制；预览即可点击；与「Markdown 文档」心智一致。

### D2a. `locateBlock(paperId, hash)` 定位流程
每个 `MarkdownContent` 容器渲染时挂 `data-content-hash`（值即 `MarkdownContent.vue:47` 已算出的 hash）。定位：
1. **DOM 命中**：页面已有 `[data-content-hash="<hash>"]` → 直接 `scrollIntoView` + 瞬时闪烁。覆盖走读、摘要/FAQ、已展开的 Q&A、其它笔记预览。
2. **未命中（多半被折叠或在未激活 tab）**：遍历 Q&A store，对每条 `result.answer` 现算 hash 找到归属 entry/result → 复用 `QAPanelNav.navigateTo`（`QAPanelNav.vue:94`）的范式展开该 entry 的 `Collapsible` → 激活该 `result` 的 Tab → `nextTick` 后再按 `data-content-hash` 定位 → 滚动 + 闪烁。
3. **仍找不到**：对应回答已被删除 → 优雅降级：toast「锚点已失效」，不跳转（与高亮 `content_hash` 失配时的静默跳过一致）。
- **闪烁** = 瞬时高亮，不落库 `<mark>`（区别于持久高亮）。
- **Tab 激活**：需把 `QAResultView.vue:58` 内部的 `activeTab` ref 提为可外部设置（按 `result.id` 激活）。
- **`s`/`e`**：P1 忽略、整块闪烁；P5 用其在块内按 offset 定位高亮（复用 `useHighlight` 的 offset→DOM 逻辑）。
- **冲突边界**：若两条回答文本完全相同（同 hash），任取已可见/第一条；属罕见无害情形。

### D3. 走读用 upsert，小笔记用显式 CRUD
- `PUT /api/papers/:id/walkthrough { body }`：不存在则建（kind='walkthrough'），存在则更新——便于自动保存无需先拿 id。
- 小笔记：`POST /api/papers/:id/notes`、`PATCH /api/notes/:id`、`POST /api/notes/:id/move`、`DELETE /api/notes/:id`。
- `GET /api/papers/:id/notes` → `{ walkthrough: Note|null, notes: Note[] }`（小笔记返回扁平数组带 `parent_id`+`sort_order`，由前端建树）。
- 冲突：`updated_at` 乐观校验（PATCH/PUT 带客户端已知 `updated_at`，不匹配则 409 + 最新内容，前端提示「已在别处修改」）。

### D4. 树语义在后端，分支思维导图在前端
- **数据/API（`paper-notes`）**：前端从扁平 `notes` 按 `parent_id`/`sort_order` 建树；`POST /api/notes/:id/move { parent_id, sort_order }` 改父子+排序，后端**防环**（拒绝移动到自身子孙下，沿 parent 链校验）；`DELETE` 事务内递归收集子孙、级联删整棵子树。
- **视图（`note-mindmap`）**：小笔记以**分支思维导图**呈现——自动布局的层级节点图（节点为框、父子用连线），**节点只显示标题**；点击节点 → 打开其浮动编辑窗口（D5）；拖拽节点改父子/排序 → 落点调 `move`，乐观更新失败回滚。
- **为何分支视图而非缩进大纲**：用户偏好「思维导图」观感。布局用自定义 CSS 层级树（或轻量布局），**不是**可自由拖放的无限画布（见 Non-Goals）。
- **删除**：删除前确认对话框，显示将连带删除的子节点数。

### D5. 浮动 Markdown 编辑窗口（走读与小笔记通用）
走读与小笔记都不在卡片内联编辑，而是在浮动窗口里编辑：
- **组件 `FloatingNoteWindow.vue`**：标题栏（显示当前内容标题 + 三模式切换 + 关闭）；内部 `NoteEditor`；编辑沿用 idea-forge 的防抖自动保存 + Ctrl+S，预览复用 `MarkdownContent`。
- **端形态**：手机端点击编辑 → **全屏窗口**（可用 shadcn `Dialog` 全屏档）；电脑端 → **可自由拖拽移动、可缩放**的浮动小窗，默认出现在该笔记下方、浮于页面顶层。
- **三种显示模式**：仅编辑器 / 左右分屏（编辑+预览）/ 仅预览；标题栏一个三档分段控件点选切换；**所有显示逻辑均在前端**。
- **尺寸记忆**：窗口有默认宽高；localStorage **全局记忆**上一次缩放后的 宽×高（非按笔记），新窗口按此尺寸打开。
- **多窗管理 `stores/windows.ts`**：页面可同时存在多个浮动窗口；维护 z-index 栈，**最后被点击的窗口置顶**。
- **为何独立子系统**：走读、小笔记、`/notes` 页都复用同一套编辑窗口；自由拖拽+缩放+多窗叠放无现成组件，需新写一个轻量 `FloatingWindow` + 一个 windows store。

### D6. 独立 `/notes` 聚合页
- `GET /api/notes` → 当前用户全部笔记（含 walkthrough 与小笔记），附 `paper_id` + `paper_title`，按论文分组、按 `updated_at` 排序。
- 页面按论文分组列出，客户端搜索（标题/正文）；点击笔记经浮动窗口查看/编辑，并可跳转到 `/papers/:id`（正文里的 `paperland://` 锚点链接照常可点）。
- 登录门禁：`/notes` 路由 `meta.requiresAuth`；后端 `requireUser`。

### D7. 访问控制（沿用 auth 模型）
- owner-scoped 读：`GET /api/papers/:id/notes`、`GET /api/notes` 仅返回 `user_id = 当前用户` 的行；匿名返回空（HTTP 200，不 401）。
- 写：`PUT/POST/PATCH/DELETE` 一律 `requireUser` + 属主校验（非属主 404）。
- 详情页「笔记」区：匿名显示「登录后可记笔记」占位；`/notes` 路由守卫拦截匿名。

## Risks / Trade-offs

- **锚点对应回答被删 → 失效** → Mitigation：`locateBlock` 找不到 hash 时优雅降级（toast 提示、不跳转），笔记本身不丢；与高亮一致。
- **两条回答文本完全相同 → 同 hash 二义** → 罕见；取已可见/第一条，无副作用。
- **浮动窗口子系统复杂度（拖拽/缩放/多窗/尺寸记忆）** → Mitigation：手写一个隔离的 `FloatingWindow` + windows store，先做核心交互，动效后补；手机端直接走全屏 `Dialog` 降复杂度。
- **分支思维导图布局成本** → Mitigation：自定义 CSS 层级树即可满足，避免引重型图库；个人规模无需虚拟化。
- **拖拽改父子造成环 / 不一致** → Mitigation：move 端点服务端防环；前端乐观更新失败回滚。
- **子树删除误删大量内容** → Mitigation：删除前确认，显示连带子节点数。
- **自动保存与多标签页并发** → Mitigation：`updated_at` 乐观锁 409 提示；单用户低频冲突可接受。
- **「论文正文」锚定面有限** → 详情页正文是 PDF/iframe，无法锚定；锚定面为 `MarkdownContent`（Q&A 回答 / 摘要 / FAQ / 笔记自身）。已写入 Non-Goals。

## Migration Plan

纯增量：
1. `db/schema.ts` 增 `notes` 表（无 anchor 列）→ `cd packages/backend && bunx drizzle-kit generate`。
2. 后端：`api/notes.ts` + `index.ts` 注册；`shared` 增 `Note` / `NoteKind`。
3. 前端按阶段：P1 锚点（`MarkdownContent` `data-content-hash` + `locateBlock` + 链接拦截 + 选区「复制为锚点链接」）→ P2 notes store + 详情页入口 → P3 浮动编辑窗口 → P4 思维导图视图 → P5 `/notes` 页 + 块内范围高亮。
4. docs 更新。
无破坏性改动、无数据回填（新表）。回滚 = 移除路由/表/前端入口；`notes` 表保留无害。锚点为纯前端约定，回滚仅失去 `paperland://` 链接的可点击行为（链接文本仍在）。

## Open Questions

- 走读是否需要目录（TOC）/ 是否也以一个思维导图根节点呈现？暂不做，走读为纯线性 Markdown 长文，单独入口开窗编辑。
- `/notes` 页是否需要按标签/论文进一步筛选与排序切换？v1 先做分组 + 客户端搜索，余量后加。
- 是否允许把小笔记跨论文移动？v1 限定在同一论文内的树操作。
- 三模式切换是否需要键盘快捷键、分屏比例是否可调？v1 仅点选切换、固定 50/50，后续可加。
- `paperland://` 是否扩展到非论文目标（如 `paperland://note/<id>` 直接打开某条笔记）？预留 `paper/` 这层路径，暂只实现 `paper/`。

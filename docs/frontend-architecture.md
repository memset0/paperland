# Paperland 前端功能架构

## 概述

Paperland 是一个论文管理网站。核心功能包括论文管理、数据抓取服务管理、以及基于大模型的论文 Q&A。

数据库使用 SQLite。全站配置统一在 `config.yml` 中管理。

## UI 技术栈

- **框架**：Vue 3 + Vite，状态管理 Pinia，路由 vue-router
- **样式**：Tailwind CSS v4（CSS-first 配置，`@tailwindcss/vite` 接管编译），无 `tailwind.config.js`、无 `postcss.config.js`
- **主题**：OKLCH CSS 变量定义在 `src/assets/main.css` 的 `:root` / `.dark` 块；`@theme inline { ... }` 把变量映射为 Tailwind token（`bg-background` / `text-foreground` / `bg-primary` 等）
- **组件库**：[shadcn-vue](https://shadcn-vue.com) —— 通过 `bunx shadcn-vue@latest add <name>` 把组件代码下载到 `src/components/ui/`（代码即资产，可直接编辑）。底层无样式原语来自 [reka-ui](https://reka-ui.com)（前身 radix-vue）
- **图标**：`@lucide/vue`（`Github` brand 图标因商标原因被 lucide v1 下架，App.vue 用 inline SVG 替代）
- **Favicon / 品牌图标**：`packages/frontend/public/favicon.svg`（Vite 把 `public/` 原样拷到 `dist/` 根）——**主题色文档图标**（`#0069A8` = `--primary = oklch(0.5 0.134 242.749)`，竖版页面铺满画布高度/保持竖版比例不拉伸/水平居中，右上折角 dog-ear `#004F7E`，文档内 3 条**白色文字线镂空**）置于**透明背景**，与「论文管理」的 `FileText` 母题一致；`index.html` 以 `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` 引用。颜色硬编码自 `--primary`（favicon 独立渲染、无法用 CSS 变量），**改主题色需重生成 favicon**。仅 SVG（常青浏览器 + Safari ≥16.4）；本机无 SVG→PNG 工具时未生成 `apple-touch-icon.png` 等光栅回退
- **字体**：`Noto Sans Variable`（正文）+ `Noto Sans Mono Variable`（等宽），通过 `@fontsource-variable` 加载
- **Toast 通知**：`vue-sonner`（`<Toaster>` 在 `App.vue` 根挂一次；调用 `import { toast } from 'vue-sonner'` 触发）；项目内通过 `lib/error-bus.ts` 的 `dispatchApiError` 包装

### 组件迁移约定

- 所有 button / input / textarea / dialog / sheet / select / tabs / badge / card / popover / tooltip / dropdown-menu / table / alert / scroll-area / sonner / command / checkbox / label / collapsible 都来自 `@/components/ui/*`
- 折叠 disclosure 用 `<Collapsible>` 而非 HTML `<details>`；展开状态用 reactive `openMap`（如 `Record<string, boolean>`）管理
- 单个 `.vue` 文件中的 Tailwind utility **主要承担布局**（grid/flex/spacing/responsive），不再用 utility 模仿按钮 / 输入框 / 卡片视觉
- 颜色用语义 token：`bg-primary`、`text-muted-foreground`、`text-destructive` 等。**不**使用 `text-indigo-600`、`bg-emerald-50` 之类的具体色阶
- Tag 显示统一走 `<Badge variant="secondary">`，不再使用每标签自定义颜色（`tagsStore.getTagColor` 后端仍然保留，前端展示层暂不渲染）
- idea-forge 的类别映射（`IDEA_CATEGORIES` / `IDEA_CATEGORY_LABELS` / `IDEA_CATEGORY_VARIANT`）集中在 `src/lib/idea-categories.ts`，组件统一从这里导入

---

## 全局导航结构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Paperland                                                                    │
├────────┬─────────────┬──────┬─────┬───────┬────────────┬──────────┬──────────┤
│ Papers │ Conferences │ Tags │ Q&A │ Notes │ Idea Forge │ Services │ Settings │
└────────┴─────────────┴──────┴─────┴───────┴────────────┴──────────┴──────────┘
```

### 页面标题（浏览器标签）

每个页面根据内容设置浏览器标签标题，统一格式 `{页面标题} · Paperland`，无标题时回退为 `Paperland`。`index.html` 的静态 `<title>Paperland</title>` 仅作首屏 / 兜底。

- **静态标题**：在 `router/index.ts` 各路由的 `meta.title` 声明（与侧边栏语义一致）：Papers `/`、Conferences `/conferences`、Tags `/tags`、Q&A `/qa`、Idea Forge `/idea-forge`、Services `/services`、Settings `/settings`；详情类路由先用占位标题（Paper Detail `/papers/:id`、Conference Detail `/conferences/:id`）。`router.afterEach` 守卫在每次导航时同步 `document.title = formatTitle(to.meta.title)`。
- **动态标题**：内容驱动的页面在视图内用 `composables/usePageTitle.ts` 的 `usePageTitle(() => …)`（基于 `@vueuse/core` 的 `useTitle`）响应式覆盖占位——论文详情用论文标题（加载前显示「Paper Detail」），Idea Forge 项目页用项目名。守卫先于视图执行，故占位标题在数据就绪后被组件覆盖；离开页面时视图作用域销毁停止 watcher，由目标页守卫重置标题。
- **格式来源**：`formatTitle(name?)` 是格式与 ` · Paperland` 后缀的唯一来源，守卫与各视图共用。新增路由只需补 `meta.title`（缺省则回退 `Paperland`）。

### 响应式 / 移动端布局

断点统一以 Tailwind `md`（768px）为界，`App.vue` 用 `isMobile = window.innerWidth < 768` 切换全局外壳：

- **外壳**：桌面端（≥ md）左侧 52px 图标侧边栏；移动端（< md）顶部 `fixed` navbar + 汉堡抽屉（`Sheet`），主内容加 `pt-12` 避让 navbar。
- **侧边栏导航为真实链接（支持新标签页 + 门禁）**：桌面图标栏与移动抽屉的导航项均用 `Button as-child` 包一个 `<a :href>`，`href` 由 `navHref(item)` 给出——当前用户**可访问**的项取 `router.resolve(item.path).href`，**受限项**（未登录的需登录项、非管理员的管理员项）返回 `undefined`（即不渲染 `href`）。点击经 `onNavClick(e, item)`：可访问项 + 修饰键（⌘/Ctrl/Shift/Alt）时直接 `return` 交给浏览器原生「在新标签页打开」（中键由原生 `<a>` 处理）；否则 `preventDefault` 后跑登录/管理员门禁，通过则关抽屉并 `router.push`。受限项无 `href`，故修饰键/中键不开新标签页，普通点击仍触发门禁提示——门禁逻辑不变。
- **侧边栏无按压位移**：共享 `Button` 基类带全局 `active:not-aria-[haspopup]:translate-y-px`（按下整体下移 1px）。侧边栏 `<aside>` 与抽屉 `SheetContent` 在容器层用 `[&_button]:active:translate-y-0! [&_a]:active:translate-y-0!` 覆盖，**仅**取消侧边栏内按钮/链接的按压位移；基类不动，应用内其余按钮保留该效果。
- **全局横向溢出兜底**：`<main>` 为 `overflow-y-auto overflow-x-hidden`——内容区**永不**整页横向滚动；真正需要横向滚动的内容（数据表、代码块 `<pre>`、看板）各自包在带 `overflow-x-auto` 的内部滚动容器里，不受影响。新增布局若可能超宽，应自带内部滚动容器或在移动端折行/堆叠，**不要**依赖整页横向滚动。
- **列表表格**：移动端用 `hidden md:table-cell` 隐藏次要列（如作者、添加/修改日期），只保留关键列（标题 + 来源），避免窄屏出现横向滚动。
- **工具栏**：搜索 + 下拉等控件行用 `flex flex-wrap`，搜索框移动端 `w-full`（独占一行）、桌面端 `md:flex-1`。
- **Markdown 正文**（`MarkdownContent.vue`）：容器 `overflow-wrap: anywhere`，行内 `code` / 长链接 `word-break`，防止长 URL / 标识符撑宽正文（代码块仍保留 `white-space: pre` + 自身横向滚动）。
- **双栏 / master-detail 降级**：`PaperDetail` 宽屏 split view 在 < 900px 降级为单栏；idea-forge `InboxView` 移动端由左右双栏改为纵向堆叠（列表 `w-full` + `max-h-[45vh]`，详情在下）。
- **PaperDetail 根高度**：用 `h-full`（贴合 `main` 内容盒高度）而非 `h-screen`，以正确扣除移动端 navbar 的 `pt-12`，避免 100vh + 48px 造成的纵向溢出与双滚动条。
- **QAPanelNav**：滚动定位条（scroll-spy 竖向小圆点）是桌面悬浮态交互，< 768px 直接 `display: none`，避免在窄屏右缘压住正文。

### 页面布局（`AppPage` 统一管理页布局）

各「XX 管理」页通过共享组件 `components/AppPage.vue` 统一页面标题与内容宽度，不再各自手写页头 / 宽度容器：

- **标题**：固定置于内容区顶部，统一 `text-xl font-semibold`，左侧带**对应图标**、**无描述副标题**。标题文字默认取 `route.meta.title`（英文，与侧边栏标签、浏览器标签一致），可用 `title` prop 覆盖。
- **标题图标**：默认取 `route.meta.icon`（在 `router/index.ts` 为每个管理路由声明，与侧边栏导航图标一致：Papers→FileText、Conferences→CalendarDays、Tags→Tag、Q&A→MessageSquare、Notes→NotebookPen、Idea Forge→Lightbulb、Services→Activity、Settings→Settings），可用 `icon` prop 覆盖。图标只在 `meta` 里定义一处，避免与侧边栏图标漂移。
- **宽度**：默认居中收窄 `mx-auto max-w-5xl`；传 `full` 则全宽、无最大宽度限制。
- **`fill` 模式**：用于自管内部滚动的页面（如 Q&A）——外层 `h-full flex flex-col`，标题头 `shrink-0` 不随滚动，内容区为 `flex-1 min-h-0 overflow-hidden`，页面内部的 `overflow-y-auto` 子元素照常滚动。非 `fill` 时页面随 `<main>` 整体滚动。
- **操作按钮**：经 `#actions` 具名插槽渲染在标题右侧（如「添加论文」「新建会议」「New Project」、服务管理「回填 S2」、会议详情「刷新 / 解析 / 导入」）。

各路由归类：

- **全宽（`full`）**：论文管理 `/`（表格需要整页宽）。
- **收窄管理布局（`max-w-5xl`）**：`/tags`、`/qa`（`fill`）、`/notes`、`/conferences`、`/conferences/:id`（标题固定为 `Conferences`，会议名 + 返回按钮置于内容区）、`/services`、`/settings`、`/idea-forge`。
- **不使用 `AppPage`（保留自有全宽布局与 chrome）**：论文详情 `/papers/:id`、Idea 工作区 `/idea-forge/:projectName`——顶部不显示管理标题栏；`PaperDetail` 的 embed / 窄屏宽度（见 embed-mode）保持不变。

> 标题「随滚动固定」（sticky header）暂未实现，仍维持滚动后标题滑出视口的现状。

---

## 一、论文管理

### 1.1 论文列表页

- 展示所有已添加的论文
- 每条记录显示：标题、标签（彩色徽章）、作者、来源（link）、引用指标（Cited / Refs）、日期
  - **标签列**：使用 `TagBadge` 组件（`components/TagBadge.vue`），根据标签颜色渲染彩色圆角徽章
  - **引用指标列**：两个独立列 `Cited` / `Refs`，各用 `CountCell` 组件（`components/CountCell.vue`）渲染一个数字。`Cited`（被引用数）取 `metadata.citation_count`，`Refs`（引用数）取 `metadata.reference_count ?? metadata.references?.length`（旧数据回退到 references 数组长度）。已知值（含 `0`）用 `toLocaleString()` 千分位显示，未富化时显示中性占位符 `–`（区分「未知」与「确为 0」）。两列均 `hidden md:table-cell`（窄屏隐藏）
  - **来源列**：使用 `SourceTag` 组件（`components/SourceTag.vue`），根据 `arxiv_id` 与 `link` 显示可点击的来源标签
    - arXiv 论文：只要 `arxiv_id` 存在就显示红色标签，格式 `arxiv:{id}`，链接由 id 派生（`arxiv.org/abs/{id}`），**不依赖** `link` 字段（会议导入论文经 S2 解析出 `arxiv_id` 但 `link` 为空，OpenReview 链接另存于 `conference_papers`）
    - 其他来源：若 `link` 为非 arXiv 链接则额外显示灰色标签，显示域名（如 `mem.ac`），点击跳转原始链接
    - 无来源：显示 `-`
- **搜索**：按 title 和 abstract（arxiv 抓取的摘要字段）进行模糊匹配
- **标签筛选**：支持按标签过滤论文（多标签 AND 逻辑），筛选状态反映在 URL query `?tags=1,2`。筛选栏仅显示 `visible=true` 的标签，隐藏标签可通过标签管理页面切换可见性
- **排序**：支持按「添加时间」(`created_at`) 和「最近修改」(`updated_at`) 排序，通过搜索栏旁的下拉菜单切换。日期列标题和内容随排序模式动态变化。
- **修改时间追踪**：论文的 `updated_at` 字段在以下操作时自动更新：Free QA 提问、Template QA 触发/重新生成、QA 重新生成、高亮标注创建/编辑/删除。
- **分页**：支持分页浏览，每页条数可配置

### 1.2 添加论文（三种方式）

#### 方式一：通过 arxiv_id 创建

- 用户输入 arxiv_id
- 系统查找是否已有匹配论文
  - 已存在 → 绑定（补充缺失 id）
  - 不存在 → 创建新记录
- 自动触发依赖 arxiv_id 的 fetch services

#### 方式二：通过 corpus_id 创建

- 用户输入 corpus_id
- 系统查找是否已有匹配论文
  - 已存在 → 绑定（补充缺失 id）
  - 不存在 → 创建新记录
- 仅凭 corpus_id 添加的论文保持该 id，**不再**自动反查 arxiv_id（单 id 即保留）；如需进入 arxiv PDF/解析链请补充 arxiv_id
- 自动触发依赖 arxiv_id 的 fetch services（若该论文有 arxiv_id）

#### 方式三：手动输入创建

- 用户输入：
  - title（标题）
  - content（文章内容文本，作为 Q&A 的文本来源）
  - authors（作者）
  - link（来源链接，可选）
  - tags（标签，可选）— 使用 `TagSelector` 组件，支持搜索已有标签或创建新标签
- arXiv / Corpus ID 导入不提示选择标签
- 创建完成后询问用户是否要执行模板提问

```
添加论文流程:

用户选择添加方式
    │
    ├── arxiv_id ─────┐
    ├── corpus_id ────┤
    └── 手动输入 ──────┤
                      ▼
              ┌──────────────┐
              │ 查找已有论文  │
              └──────┬───────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
          新建论文     绑定已有论文
              │         (补充 id)
              └──────┬──────┘
                     ▼
          ┌─────────────────────┐
          │ via arxiv/corpus:   │
          │   自动触发 fetch     │
          │                     │
          │ via 手动输入:        │
          │   询问是否跑模板提问  │
          └─────────────────────┘
```

### 1.3 论文编辑与删除

#### 编辑论文

论文详情页信息卡片右上角有编辑按钮（铅笔图标），点击进入编辑模式：

- **标题**：文本输入框（arXiv 论文禁用）
- **作者**：逗号分隔的文本输入框（arXiv 论文禁用）
- **来源链接**：文本输入框（所有论文均可编辑）
- **内容 (User Input)**：等宽字体 (`font-mono`) 的多行文本框，编辑 `contents.user_input` 字段

arXiv 导入的论文标题和作者字段显示为禁用状态（灰色背景），后端也会拒绝修改。

编辑完成后点击「保存」，仅发送有变更的字段（PATCH 语义），点击「取消」丢弃所有修改。

#### 标签编辑

标签区域标题旁有编辑按钮（铅笔图标），点击进入标签编辑模式：

- 使用 `TagSelector` 组件，预填当前论文标签
- 支持搜索已有标签、创建新标签、移除已选标签
- 保存调用 `PUT /api/papers/:id/tags` 全量替换
- 保存后自动刷新论文详情和标签颜色缓存
- 无标签时显示 "+ 添加标签" 按钮直接进入编辑模式
- 宽屏 split view 和窄屏 single column 两处均支持编辑

#### 参考链接

信息卡片中（标签区块下方）有「参考链接」区块（`components/ReferenceLinksSection.vue`），用于挂载论文之外的外部资源（博客解读、项目主页、讨论帖等）。**按 用户×论文 私有**（与笔记/标签一致，匿名只读返回空）。

- 每条链接含 `title`（标题，必填）、`url`（链接，必填）、`description`（描述，可选）；标题渲染为超链接，`target="_blank" rel="noopener noreferrer"` 新标签页打开，描述作为次要灰字显示在标题下方
- 列表按添加顺序（`created_at` 升序）展示；每条 hover 显示编辑 / 删除按钮
- 标题旁「+」按钮（无链接时为 "+ 添加链接"）展开内联表单（标题 / 链接 / 描述三个输入），增删改后就地刷新，不整页刷新
- 组件自取自管（`referenceLinksApi`：`getForPaper` / `create` / `update` / `remove`），无需 Pinia store；宽屏 split view 与窄屏 single column 两处均渲染
- 后端 `GET|POST /api/papers/:id/reference-links`、`PATCH|DELETE /api/reference-links/:id`，写操作经 `requireUser` + owner 校验，`url` 仅放行 http/https

#### 删除论文

论文详情页信息卡片右上角有删除按钮（垃圾桶图标），点击弹出确认对话框：

- 显示论文标题和内部 ID
- 警告文案：说明所有 Q&A 条目、回答结果、服务执行记录、标签和高亮标注将被永久删除
- 需要用户手动输入论文的数字 ID 才能启用删除按钮（类似 GitHub 删除仓库的确认机制）
- 确认删除后，后端在事务中级联删除所有关联数据，前端跳转回论文列表页
- 删除后 ID 不复用（SQLite autoincrement 行为）

### 1.4 论文详情页（桌面端双栏布局）

```
┌─────────────────────────────────────────────────────────────────────┐
│  论文详情页                                                          │
├─────────────────────────────┬───────────────────────────────────────┤
│  [PDF 原文] [幻觉翻译]      │                                       │
│  ─────────────────────────  │   信息 & Q&A 区                       │
│                             │                                       │
│  ┌───────────────────────┐  │  标题 / 作者 / 标签(可编辑) / arxiv_id │
│  │                       │  │                                       │
│  │   Multi-mode Viewer   │  │  ┌── Kimi 自动摘要 ──────────────┐   │
│  │                       │  │  │  (papers.cool 外部内容)         │   │
│  │  - PDF 原文 (iframe)  │  │  └────────────────────────────────┘   │
│  │  - 幻觉翻译 (hjfy.top)│  │  ┌── Template Q&A ──────────────┐   │
│  │                       │  │  │  模板提问结果...                │   │
│  │  Tab 切换查看模式       │  │  └────────────────────────────────┘   │
│  │                       │  │  ┌── Free Q&A ───────────────────┐   │
│  │                       │  │  │  自由提问历史记录...             │   │
│  │                       │  │  └────────────────────────────────┘   │
│  │                       │  │  (右上角「提问」入口→按需浮动面板)    │
│  └───────────────────────┘  │                                       │
└─────────────────────────────┴───────────────────────────────────────┘
```

#### 多模式查看器（PaperViewerPanel）

左侧面板支持多种查看模式，通过顶部 Tab 栏切换：

| 模式 | 条件 | 内容 |
|------|------|------|
| PDF 原文 | 论文有 `pdf_path` | 嵌入式 **pdf.js** 查看器（PdfViewer 组件，见下方「嵌入式 pdf.js 查看器」） |
| 幻觉翻译 | 论文有 `arxiv_id` | 嵌入 `https://hjfy.top/arxiv/{arxiv_id}` iframe |
| Walk-through | 该 (用户, 论文) 有非空笔记（`store.noteCount > 0`） | 把整棵笔记树渲染为一篇连续 Markdown 文档（见下方「Walk-through 视图」） |

- 自动选中第一个可用模式（Walk-through 排在 modes 数组末位，PDF/幻觉翻译优先；笔记加载后该 Tab 才出现，且不抢占当前选中）
- 无可用模式时显示占位提示
- 模式系统可扩展：添加新模式只需在 modes 数组中增加条目
- Walk-through Tab 的可用性来自 `useNotesStore().noteCount`，故 `PaperViewerPanel` 直接读 notes store（笔记由始终挂载的 `PaperNotesCard` 拉取）
- `PaperViewerPanel` 还监听 `usePdfNavigation` 的 `requestedPdfTarget`：一旦有 PDF 锚点跳转请求且 PDF 可用，自动把 active Tab 切到「PDF 原文」

#### 嵌入式 pdf.js 查看器（PdfViewer）

不再用浏览器原生 PDF 插件（`<iframe type="application/pdf">`），改为用 **pdfjs-dist** 自建轻量查看器，从而可编程跳页、读当前页、在页面上画高亮——这是支持 `paperland://…?pdf=…` 页面/选区锚点的前提。

- **加载**：`lib/pdfjs.ts` 的 `loadPdfjs()` 动态 `import('pdfjs-dist')`（被 Vite code-split 成独立 chunk，只有打开 PDF Tab 才拉取），worker 以 `pdf.worker.min.mjs?url` 注册到 `GlobalWorkerOptions.workerSrc`。`pdfjs-dist` 版本在 package.json 中**精确 pin**——`ts/te` 是 pdf.js 提取文本的字符偏移，需跨部署版本稳定。
- **渲染**：连续纵向滚动，每页一个按宽高比预留的占位 `.pdf-page`；`IntersectionObserver`（`rootMargin 200%`）在临近视口时把该页渲染到 canvas（HiDPI 用 `transform:[dpr,…]`）+ pdf.js 文本层（透明、可原生选中），远离视口时卸载 canvas 以省内存。
- **当前页 / 跳转 / 缩放 / 适配模式**：滚动时按页矩形与视口中线判定「当前页」；工具栏含 上/下一页、页码跳转输入、缩放、**适配模式切换**（宽度铺满 ↔ 高度铺满，`MoveHorizontal`/`MoveVertical` 图标，**仅当前打开有效、不记忆**，默认宽度铺满；切换会把 zoom 重置为 1 使适配精确）。`effectiveScale = fitScale × zoom`，`fitScale` 由 `fitMode` 取「容器宽 / 首页宽」或「容器高 / 首页高」；缩放/适配后 canvas + 文本层按新尺度重渲染并保持对齐，文本层设 `--scale-factor`。
- **拖动分屏不卡**：宽度变化时只即时缩放占位页与 CSS 填充的 canvas，昂贵的重栅格化（canvas + 文本层）去抖 ~320ms（`RE_RASTER_DEBOUNCE_MS`），待尺度真正稳定后只做一次；期间页面保持 CSS 缩放（略软）直到落定（高度铺满模式下拖动分屏宽度不改变 `fitScale`，更不触发重渲染）。
- **选区 → 链接**：文本层支持原生选区；落定后用 `getSelectionOffsets`（复用 `useHighlight`）算出该页 `ts/te` 偏移，弹出「复制选区链接」浮钮，复制 `<选区文本> [#](paperland://paper/<id>?pdf=<page>&ts=<ts>&te=<te>)`；工具栏「复制本页链接」复制 `[PDF p.N](paperland://paper/<id>?pdf=N)`。
- **跳转 + 高亮**：监听 `requestedPdfTarget`，`{page}` 滚动到该页；`{page,ts,te}` 先确保该页渲染，再用 `buildTextSegments` 把偏移映射为 `Range.getClientRects()`，在页面上叠加临时高亮 div（`pdf-region-flash`，2.2s 淡出，不落库）并滚动到选区中心；偏移越界则退化为仅跳页 + toast 提示。
- **失败兜底**：pdf.js 加载/解析失败时显示错误态并给出原始文件链接 `/api/files/<pdf_path>`；无 `pdf_path` 时保留「暂无 PDF」占位。
- **未来图床前向兼容**：选区除偏移外还能算出归一化页内包围矩形；组件 `defineExpose` 了 `cropRegionToImage({page,x,y,w,h})`（离屏重渲染该页并裁剪为 PNG dataURL），供未来内部图床直接复用，本次不接 UI。

#### 窄屏布局

单栏布局（<900px）下，左侧查看器面板隐藏，仅显示论文信息和 Q&A 内容。

#### 按需浮动提问面板（QAInput）+ 功能入口（PaperActionLauncher）

提问框不再常驻遮挡视野，改为**点击功能入口后才弹出的浮动面板**。面板**就是 `QAInput` 卡片本身（单层）**——不套额外窗口外壳/标题栏，外圈即卡片自身边框，避免"窗口套卡片"的双层边框。

- **功能入口（`PaperActionLauncher.vue`）**：渲染调用方（`PaperDetail`）按页面功能顺序（引用 → 笔记 → 提问）注入的有序功能项，当前仅"提问"（`Bot` 图标）。
  - **桌面端**（≥ md）：在论文详情页 header **右侧内联直接平铺**功能按钮（图标 + 文字），无下拉菜单。
  - **移动端**（< md）：右下角**圆形悬浮按钮（FAB）**，点击展开竖直功能列表，选中即触发并收起。
- **面板状态（`composables/useQAWindow.ts`）**：模块级单例，`isOpen` + top-left 锚定几何 `left/top/width/height`（可缩放）。与笔记窗口不同，**不记忆/不持久化**上次位置大小，每次 `open()` 用调用方按当前布局算好的默认几何覆盖。
- **默认几何（由 `PaperDetail.openQA()` 计算）**：默认放在内容区左下角，默认高 `QA_DEFAULT_HEIGHT`（约 2 行输入框）。
  - 双栏：贴左下角，宽 = 左侧（PDF）栏当前宽度（`#split-container` 实测 × `leftWidth`），`top = 容器底 − height`。
  - 单栏：贴底部，占内容区完整横向宽度（`narrowScrollRef` 实测）。
  - 移动端：`inset-0` 全屏浮层。
- **面板内布局**：顶部一行自左至右为 **提交按钮（左）→ 模型选择 → 关闭按钮（右上角）**；其下为占满整行的输入框（`rows="2"` 默认两行、`flex-1` 随面板增高填充、`resize-none` 去掉自身缩放手柄）。
- **拖动 / 缩放分工（桌面端）**：面板**右下角有缩放手柄**（对角线 SVG，`@pointerdown.stop`，改 `width/height`）；**移动**则在卡片**空白处**（非输入框 / 非按钮 / 非手柄，`onCardDown` 用 `closest(...)` 排除）按下拖动，改 `left/top`。移动端全屏，二者均不提供。
- **提交按钮**：图标 + "Submit" 文字（不再仅图标）。
- 切换论文 / 组件卸载时 `qaWin.close()`，避免浮动面板跨论文残留。

#### QA 快速导航（QAPanelNav）

右侧面板内容区右边缘的悬浮导航条，帮助用户在大量 QA 条目间快速定位。

- **条目顺序**：先显示有结果的模板提问（config 顺序），再显示所有自由提问（最新优先）。没有生成结果的模板提问不显示在导航中
- **未展开**：垂直排列的小灰点（每个点对应一个 QA 条目），当前可见条目的点高亮为 indigo 色，半透明（opacity 0.45），不遮挡底层文字选中
- **展开**：鼠标 hover 时向左展开为 ~260px 面板，显示每个 QA 条目的问题标题（单行截断）
- **点击**：平滑滚动到对应 QA panel，若处于折叠状态则自动展开并更新 localStorage
- **定位**：`position: sticky; float: right; width: 0`，浮在内容区右侧不占布局空间
- **移动端**：点击触发展开/收起，导航后自动收回
- **滚动监听**：`useScrollSpy` composable 使用 `IntersectionObserver` 监听 `[data-qa-entry]` 元素可见性，取最靠近顶部的可见元素作为 active

#### QA 卡片布局

论文详情页右侧 Q&A 区域由三个独立卡片组成，按以下顺序排列：

1. **Kimi 自动摘要**（papers.cool 外部内容，仅在有数据时显示）
2. **Template Q&A**（模板提问，来自 config.yml 配置）
3. **Free Q&A**（自由提问，用户手动输入）

每个卡片有独立的"全部展开/全部折叠"按钮。所有 QA 问题默认折叠，用户点击标题手动展开。折叠时问题标题单行截断显示，展开后答案内容自然换行（不渲染内容中的换行符）。

#### 模板提问状态展示

每个模板根据其 Service Execution 状态实时展示：

| 状态 | 图标 | UI 展示 | 可用操作 |
|------|------|---------|---------|
| idle | ⬚ | 空白，"未生成" | [单独生成] |
| pending | ⏳ | "已提交..." | 按钮禁用 |
| waiting | ⏳ | "等待依赖..." | 按钮禁用 |
| running | 🔄 | 进度条 + 百分比 | 按钮禁用 |
| done | ✅ | 展示最新 result 的 answer | [重新生成] |
| failed | ❌ | 展示错误信息 | [重试] |
| blocked | 🚫 | "缺少依赖，无法执行" | — |

- **实时更新**：前端通过短轮询（每 N 秒请求一次）获取最新状态，done 后立即展示回答
- **一键生成按钮**：仅当存在 idle 状态的模板时显示
- **双栏比例**：左右栏宽度支持拖拽调整（使用 Pointer Events API + `setPointerCapture` 确保快速拖动跟手），分隔条 2px 宽 + 12px 隐形热区
- **左侧面板折叠**：分隔条中间有 toggle 按钮（`PanelLeftClose`/`PanelLeftOpen` 图标），可一键折叠/展开左面板，带 300ms 过渡动画

---

## 一（附）、会议管理

「会议」是与「论文管理」**同级**的顶级导航入口（侧栏 `/conferences`，`CalendarDays` 图标）。用于以「会议」为单位组织和浏览候选论文：先把抓取到的论文进**候选池**，按主题分组、确认后再「一键入库」到正式 `papers`。

### 1A.1 数据模型与候选池

新增两张表（数据库 schema 详见 `docs/tech-stack.md`）：

- `conferences` — 会议实体（`name`、可选 `year`/`start_date`/`end_date`/`location`/`description`/`link`）。
- `conference_papers` — 候选池，外键 `conference_id` → `conferences.id`；可选 `topic`（按主题分组的自由文本）、`source`（`arxiv` / `openreview` / `semantic_scholar` / null）、`external_id`、`status`（`pending` / `candidate` / `ingested`）、`paper_id`（入库后写入，FK → `papers.id`）。索引 `(conference_id, status)`。

### 1A.2 三态生命周期

| 状态 | 含义 | 操作 |
|---|---|---|
| `pending`（待确认） | 刚导入候选池的默认状态 | 「确认」→ `candidate`；可单删 |
| `candidate`（候选中） | 已确认，将被一键入库 | 「退回」→ `pending`；可单删 |
| `ingested`（已入库） | 已经在 `papers` 表里，`paper_id` 指向具体论文 | 终态，UI 提供「打开论文」入口 |

「本次会议一键添加」只处理 `candidate` 状态，**不**会动 `pending`。

### 1A.3 页面

- **`/conferences`（ConferenceList.vue）**：会议列表。支持按 name 模糊搜索 + 按 `year` 筛选。每张卡片显示 `paper_count` + 各状态计数。「新建会议」按钮弹出对话框（仅 `name` 必填）。
- **`/conferences/:id`（ConferenceDetail.vue）**：会议详情。按 `topic` 分组展示候选论文（`null` topic 归入「未分类」）。每条候选是一张**筛选卡片**：标题 → 元信息行（作者 · 引用数 · 领域）→ S2 **TL;DR** → **abstract**（`line-clamp` 截断 + 展开/收起）→ **统一外链行**（arXiv chip + `S2Badge` + OpenReview/原文 chip，只显示存在的）+ 可编辑 `#主题`。右侧为**状态药丸**（待添加 / 仅元数据 / 已在库）+ 主操作（仅元数据 → 加入；已在库 → 打开）+ `⋯` 菜单（编辑主题、删除）。顶栏「导入」对话框支持上传 JSON 文件或粘贴 JSON（接受 `{ papers: [...] }` 或裸数组）。
  - **三态生命周期（派生）**：`待添加`（无 `paper_id`）→ `仅元数据`（有 `paper_id` 且 `paper_listed === false`）→ `已在库`（`paper_listed === true` 或 `status === 'ingested'`）。UI **不再**呈现 `pending/candidate` 的「确认 / 退回」工作流与「本次会议一键添加」（DB `status` 列保留但前端不用）。
  - **复选框 = 选择以「加入列表」**：`仅元数据` 行可勾选；`已在库` 行默认勾选且锁定（不计入选择集合）；`待添加` 行禁用（需先「解析」）。「全选本组」只选 `仅元数据` 行。批量栏「加入选中到列表 (N)」→ `POST /api/conferences/:id/papers/promote { ids }`（对每条关联论文翻 `listed=1` 并触发完整管线，返回 `{ promoted, skipped, errors }`）。
  - **筛选字段 & 外链**：卡片的 abstract / TL;DR / 引用数 / 领域来自关联论文（`GET /api/conferences/:id/papers` 附带 `paper_abstract` / `paper_tldr` / `paper_citation_count` / `paper_fields_of_study`）。外链 id 取值优先级：关联论文 `paper_arxiv_id` / `paper_corpus_id` > 候选自身 `source`/`external_id` > 缓存 `metadata.s2_match`；arXiv 用显式 chip（不走 `SourceTag`，避免无 link 时渲染成 `-`）。**配图暂不显示**（S2 Graph API 不提供论文 figures）。

### 1A.4 入库链路（复用 `papers` ingest pipeline）

后端把原 `POST /api/papers` 的核心逻辑抽成可复用函数 `ingestPaper({ arxiv_id?, corpus_id?, title?, authors?, link?, content? })`（位于 `services/ingest_paper.ts`），负责 dedup 检查（命中已有 `arxiv_id`/`corpus_id` 时直接关联，互补缺失的 ID）+ insert + 异步 `serviceRunner.triggerForPaper(...)`。

会议一键入库的来源映射：
- `source='arxiv'` → `arxiv_id = external_id`
- `source='semantic_scholar'` → `corpus_id = external_id`
- `source='openreview'` 或 未知 → manual（仅 `title` + `authors` + `link`）

入库成功后把 `conference_papers.status` 置为 `ingested`，`paper_id` 写入新建或匹配到的 `papers.id`。已存在的论文按 ID 幂等关联，**不**会重复创建。

### 1A.5 Internal API（`/api/conferences/*`，会话认证）

| 方法 + 路径 | 说明 |
|---|---|
| `GET /api/conferences?search=&year=&page=` | 列表 + 分页 + 名称/年份筛选；每项附 `paper_count` + 状态计数 |
| `POST /api/conferences` | 创建（`name` 必填） |
| `GET /api/conferences/:id` | 详情 |
| `PATCH /api/conferences/:id` | 编辑 |
| `DELETE /api/conferences/:id` | 删除（事务级联 `conference_papers`，**绝不**删 `papers`） |
| `GET /api/conferences/:id/papers?topic=&status=` | 候选池列表 |
| `POST /api/conferences/:id/papers/import` | 批量导入候选（事务原子，默认 `pending`） |
| `PATCH /api/conferences/:id/papers/:cpId` | 单条更新（topic / status `pending↔candidate`） |
| `PATCH /api/conferences/:id/papers` | 批量更新（body `{ ids, status?, topic? }`） |
| `DELETE /api/conferences/:id/papers/:cpId` | 删除候选 |
| `POST /api/conferences/:id/ingest` | 一键入库所有 `candidate`，返回 `{ ingested, skipped, errors }` |
| `POST /api/conferences/:id/papers/:cpId/ingest` | 单条入库 |

### 1A.6 前端 store

`stores/conferences.ts`（Pinia）暴露：`fetchConferences` / `fetchConference` / `createConference` / `updateConference` / `deleteConference` / `fetchCandidates` / `importPapers` / `updateCandidate(s)` / `deleteCandidate` / `ingestConference` / `ingestCandidate` / `resolveConference` / `promotePaper`。

---

## 一（附2）、两层论文（已列出 vs 仅元数据）与会议解析

为了批量导入外部论文列表（如 OpenReview 会议列表）并用 Semantic Scholar 富集而不污染阅读列表、也不触发 arxiv 限流，论文分两层（由 `papers.listed` 全局布尔区分，默认 `1`）：

| | 已列出 `listed=1` | 仅元数据 `listed=0` |
|---|---|---|
| 论文列表 | 显示 | 默认隐藏（可切到"仅元数据/全部"查看） |
| 抓取管线 | 完整（S2 + arxiv metadata/PDF + 解析 + papers.cool） | 只跑 `semantic_scholar_service`；arxiv/PDF/解析/papers.cool 标 `deferred` |
| 详情页 | 可进入 | 列表行不可点击；需先"抓取"（提升）才可进入 |

- **服务门禁**：paper-bound 服务可声明 `requires_listed`；调度器对 `listed=0` 论文把这些服务记为 `deferred`、不执行。**提升**（`listed:0→1`）时 `triggerForPaper` 重跑，deferred 服务执行、已完成的 S2 跳过。
- **S2 优先元数据**：basic fields + abstract 优先取自 S2；arxiv metadata 退为补缺/PDF。
- **会议候选解析**：`POST /api/conferences/:id/resolve`（后台、~1 RPS）对未关联候选用 S2 `search/match` 把标题解析为 corpus/arxiv id，`ingestPaper(listed:false)` 建/并出隐藏论文并回填 `conference_papers.paper_id`，缓存 matchScore 供复核；未命中留"待添加"。会议候选状态由 `paper_id` + 关联论文的 `listed` **派生**（待添加 / 仅元数据 / 已加入），不再用 pending/candidate。`GET /api/conferences/:id/papers` 会附加关联论文的 `paper_listed`、`paper_arxiv_id`、`paper_corpus_id`，以及用于就地筛选的 `paper_abstract`、`paper_tldr`、`paper_citation_count`、`paper_fields_of_study`（均派生自关联论文、零冗余）。批量「加入列表」用 `POST /api/conferences/:id/papers/promote { ids }`（对每条关联论文翻 `listed=1` + 触发完整管线）。
- **前端**：论文列表页有 已列出 / 仅元数据 / 全部 三态切换；仅元数据行显示"仅元数据"徽章 + 行内"抓取"按钮（提升）。会议详情页有"解析"按钮与逐条"加入列表"按钮。论文详情页对 `listed=0` 论文显示"加入列表"。提升经 `PATCH /api/papers/:id { listed: true }`。
- **列表资格门禁**：仅有 OpenReview 链接、且无 `arxiv_id`/`corpus_id` 的"OpenReview-only"论文不可加入列表。API 响应（列表 `GET /api/papers` 与详情 `GET /api/papers/:id`）含派生布尔 `listable`；前端对 `listable === false` 的行**禁用**"抓取"/"加入列表"按钮并加 tooltip 说明。若后端仍拒绝（`422 LISTING_NOT_ALLOWED`），API client 弹出错误提示且本地状态不变（`promote` 仅在 await 成功后才改本地 `listed`）。**后端约定**：凡把 `listed` 置为 `true` 的路径（`PATCH /api/papers/:id`、`PATCH /external-api/v1/papers/:id`、会议批量 ingest / 候选关联、`ingestPaper` 自动提升）都必须经 `utils/listing.ts` 的 `canList` 判定。
- **列表过滤**：论文列表（按模式）、External API、idea-forge paper dump 默认只含 `listed=1`；`GET /api/papers/:id` 直链与会议详情页可访问隐藏论文。

---

## 二、Q&A 模块

### 2.1 两种提问类型

| | 模板提问 (Template) | 自由提问 (Free) |
|---|---|---|
| **索引方式** | template_name 为 key (e.g. "abstract") | 递增数字 id |
| **模板来源** | `config.yml` 中的 `qa` 列表 | 用户输入 |
| **模型选择** | config.yml 中的默认模型 | 用户通过复选框选择一个或多个（持久化到 localStorage，跨刷新保持） |
| **触发方式** | 手动（一键全部 / 单独生成） | 手动（用户提交问题） |
| **适用范围** | 所有论文通用的固定模板 | 针对具体论文的个性化问题 |

### 2.2 模板提问

#### 模板定义

- 定义在 `config.yml` 的 `qa` 列表中，每项包含 `name` 和 `prompt`
- `system_prompt` 字段定义论文内容与问题的拼接模板，使用 `{PAPER}` 和 `{PROMPT}` 占位符
- 列表顺序决定前端展示顺序

#### 一键生成按钮

- 仅当论文存在**未作答的模板**时显示
- 点击后遍历所有模板：
  - 已有结果 (results.length > 0) → 跳过
  - 已有 pending/running 的任务 → 跳过（防重复提交）
  - 无结果且无进行中任务 → 提交新任务
- 重复点击不会产生重复请求

#### 重新生成

- 手动点击 [重新生成] 按钮才会触发
- 从 `config.yml` 读取最新模板内容
- 使用 config.yml 中当前配置的默认模型
- 新结果追加到 results 数组末尾

### 2.3 自由提问

- 用户在输入框中输入问题并提交
- 通过复选框选择一个或多个模型（前端记忆上次选择）
- 每个选中的模型各自产生一个 result
- 支持重新生成（同一问题，不可更改问题文本）
- 新结果追加到 results 数组末尾

### 2.4 Q&A 入口

| 入口 | 说明 |
|------|------|
| 论文详情页内嵌 | 针对当前论文提问，paper_id 自动绑定，展示模板提问和自由提问 |
| 独立 Q&A 页面 (/qa) | 按时间倒序展示所有自由提问的 Feed 流（不含模板提问），每个 QA 为可折叠面板，显示关联论文标题及跳转链接，支持重新生成、删除、复制、Pin 等操作 |

### 2.5 提问的文本上下文来源

提问时需要将论文内容作为上下文发送给模型。从论文的 `contents` 字典中按 `config.yml` 的 `content_priority` 配置顺序取第一个非空值：

```yaml
# config.yml
content_priority:
  - user_input      # 用户手动输入 (最高优先级)
  - pdf_parsed      # PDF 解析 (最低优先级)
```

- 全部为空 → 报错提示用户
- PDF 通过 arxiv 抓取，使用 Python 脚本或 Node.js 库解析为纯文本（可配置）
- 用户在手动创建论文时输入的 content 存入 `contents.user_input`

---

## 二（附）、Markdown 渲染

### 渲染组件

`MarkdownContent.vue` 是全站统一的 Markdown 渲染组件，基于 `markdown-it` + `@traptitech/markdown-it-katex` + `KaTeX`。

### 数学公式支持

支持四种 LaTeX 定界符：

| 语法 | 类型 | 示例 |
|------|------|------|
| `$...$` | 行内公式 | `$E=mc^2$` |
| `$$...$$` | 行间公式 | `$$\int_0^1 f(x)dx$$` |
| `\(...\)` | 行内公式 | `\(\alpha + \beta\)` |
| `\[...\]` | 行间公式 | `\[\sum_{i=1}^n x_i\]` |

- 渲染引擎：KaTeX（同步渲染，轻量快速）
- 不支持的 LaTeX 命令降级为原始文本显示（`throwOnError: false`）
- 代码块内的数学定界符不会被渲染

### 样式

- 组件自带完整的 scoped CSS 样式（标题、列表、代码块、表格、引用等）
- 不依赖 `@tailwindcss/typography`，手动覆盖 Tailwind Preflight 的 reset（如 `list-style-type`）
- KaTeX 样式通过 `katex/dist/katex.min.css` 导入
- 行间公式居中显示，超宽公式支持水平滚动

### 文本高亮标注

`MarkdownContent.vue` 支持持久化的文本高亮标注功能。

#### 内容标识

- **pathname**：当前页面路径（不含 hostname），可通过 `highlightPathname` prop 覆盖（如 /qa 页面的 QA 内容使用原论文 `/papers/:id` 作为 pathname，而非 `/qa`）
- **content_hash**：markdown 内容去除所有空白字符后的 MD5 哈希（使用 `spark-md5`）
- 同一页面内所有 MarkdownContent 实例的 content_hash 不会重复

#### 偏移量

- 存储渲染后纯文本（`textContent`）中的 start/end offset
- 还原时通过 DOM text node 遍历定位并包裹 `<mark>` 元素
- KaTeX 公式作为原子单元处理：偏移量计算时不进入 KaTeX 内部节点，部分选中自动扩展为整个公式

#### 数据流

```
页面加载 → GET /api/highlights?pathname=... → 一次请求获取所有高亮
         → Pinia store 按 content_hash 分组 → 各 MarkdownContent 按 hash 取自己的高亮
         → DOM 后处理：遍历 text nodes，按 offset 包裹 <mark>

选中文本 → 浮动工具栏（4 色 + 复制为锚点链接）→ POST /api/highlights → 更新 store → 重新渲染
点击/tap 高亮 → 弹出菜单（改色 / 删除）→ PUT/DELETE /api/highlights/:id
```

> **高亮只做高亮**：高亮本身不再附带笔记（per-paper 笔记由独立的 Notes 系统承担）。工具栏无「添加笔记」输入框、点击菜单无「编辑笔记」、桌面端也不再有悬停 tooltip。数据库里旧的 `highlights.note` 历史数据保留但不再读取（active schema 已移除该列，未做破坏性迁移）。

#### 移动端适配

选择检测使用 `selectionchange` 事件（W3C 标准），在桌面和触摸设备上均可靠触发：

- **选择检测**：`document selectionchange` + 防抖（桌面 50ms / 移动 300ms），替代 `mouseup`
- **弹窗关闭**：同时监听 `mousedown` + `touchstart`（passive），确保桌面和触屏都可点击空白区域关闭
- **触摸区域**：通过 `@media (pointer: coarse)` 将按钮最小触摸区域扩大到 44×44 CSS px
- **视口 clamp**：工具栏和菜单定位增加左右边界检测，防止在窄屏上超出容器

#### API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/highlights?pathname=...` | 按页面路径获取所有高亮 |
| POST | `/api/highlights` | 创建高亮（仅颜色，无 note） |
| PUT | `/api/highlights/:id` | 修改颜色 |
| DELETE | `/api/highlights/:id` | 删除高亮 |

#### 高亮颜色

黄（yellow）、绿（green）、蓝（blue）、粉（pink），不支持重叠高亮。

---

## 三、服务管理

### 3.1 服务分类

所有后台任务统一抽象为 Service，代码统一放在 `services/` 目录下，每个 service 配有单元测试。

| 类型 | 说明 | 触发方式 | 依赖管理 |
|------|------|---------|---------|
| Paper-bound Service | 绑定论文，声明 depends_on/produces | 自动（依赖图调度） | 参与 |
| Pure Service | 不绑定论文，输入输出在调用时确定 | 手动 | 不参与 |

### 3.2 Paper-bound Service 依赖模型

每个 paper-bound service 在代码中声明：

- **depends_on**: 执行前必须存在的论文键值
- **produces**: 执行后写入论文的键值

#### 论文字段分类

| 分类 | 字段 | 管理方式 |
|------|------|---------|
| 基础字段 | title, abstract, authors | 不纳入依赖管理，任何 fetch service 执行时顺手写入（如果为空） |
| 服务键值 | pdf_path, contents.pdf_parsed, citation_count, reference_count, references, ... | 纳入依赖管理，由 produces 声明归属 |

#### 已知 Paper-bound Services

```typescript
semantic_scholar_service:
  depends_on: []            # 双向：对任何 paper 都可执行，运行时挑 id
  produces:   [corpus_id, citation_count, influential_citation_count, reference_count, references]
  # 有 arxiv_id 用 ARXIV:{id}、否则用 CORPUSID:{id} 查询 S2，单次拿到对侧 id + 引用富化；
  # arxiv_id 故意不放进 produces：corpus-only 论文解析出 arxiv_id 后，arxiv 元数据/PDF 服务
  #   靠 runner「完成后按实时 key 重触发」自然衔接，而非被提前调度；
  # reference_count 取 S2 referenceCount（权威总数，不受 references 单页截断影响）；
  # tldr/venue/year/doi/fields_of_study/s2_url 等存入 metadata（不纳入 produces，可能缺失）；
  # 既无 arxiv_id 也无 corpus_id 的手动论文：no-op（不发请求）

arxiv_service:
  depends_on: [arxiv_id]
  produces:   [pdf_path, arxiv_categories, ...]

pdf_parse_service:
  depends_on: [pdf_path]
  produces:   [contents.pdf_parsed]

```

#### 依赖图（前端可视化展示）

```
arxiv_id ─┐
corpus_id ┴─→ semantic_scholar_service ──→ 对侧 id + 引用富化 (citation_count / reference_count / references / tldr ...)
              （corpus-only 解析出 arxiv_id 后 ↓ 经重触发衔接）
arxiv_id ─────→ arxiv_service ──→ pdf_path ──→ pdf_parse_service ──→ contents.pdf_parsed
```

#### 自动调度逻辑

添加论文时，触发所有 paper-bound services，调度器根据依赖图自动决定执行顺序：

```
对于每个 paper-bound service:

  1. produces 的键值已全部存在?
     → 跳过，直接标记 done

  2. depends_on 的键值有缺失?
     → 找到能 produce 该键值的服务 X
       → X 已在 running/pending → 等待 X 完成
       → X 未触发 → 自动 trigger X (递归)
       → 无服务能 produce → 标记 blocked，跳过

  3. depends_on 全部就绪
     → 执行本服务

  4. 部分成功
     → 已拿到的键值写入论文
     → 标记 partial/failed
     → 用户可手动触发重新执行所有服务
```

### 3.3 Pure Service

| Service | 说明 |
|---------|------|
| qa_service | 调用大模型进行 Q&A |

- 注册为 `pure` 类型到 `service_runner`，使用 `executePureService()` 执行
- 受 `max_concurrency` 和 `rate_limit_interval` 约束，执行记录写入 `service_executions` 表
- 在服务管理页面可见（显示运行中/排队/最大并发数）
- 触发方式：用户手动提交 / External API 调用
- **前置条件**：调用方负责检查 content 不为空
- **启动清理**：服务器启动时将所有 pending/running 状态的执行记录（service_executions 和 qa_entries）重置为 failed

### 3.4 服务执行模型

**每个 service 独立的并发控制和速率限制：**

```
┌────────────────────────────────────────────────────────────┐
│                   Service Runner (调度器)                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  arxiv_service:           max_concurrency: 3                │
│    ┌─┐ ┌─┐ ┌─┐           rate_limit_interval: 3s           │
│    └─┘ └─┘ └─┘                                             │
│                                                             │
│  semantic_scholar_service: max_concurrency: 1               │
│    ┌─┐                  rate_limit_interval: 1s            │
│    └─┘                  (带 key 1 RPS；无 key 建议 3s)      │
│                                                             │
│  pdf_parse_service:       max_concurrency: 2                │
│    ┌─┐ ┌─┐                (本地操作，无需限流)               │
│    └─┘ └─┘                                                  │
│                                                             │
│  qa_service:              max_concurrency: 2                │
│    ┌─┐ ┌─┐                (取决于模型 API)                  │
│    └─┘ └─┘                                                  │
│                                                             │
│  不同 service 之间完全并行，互不阻塞                          │
│  同一 service 内部受 max_concurrency 和 rate_limit 约束      │
│  同一 service 的 rate_limit 冷却不影响其他 service            │
└────────────────────────────────────────────────────────────┘
```

### 3.5 论文创建防重复机制

External API 可能并发创建同一篇论文，需防止数据库出现重复条目。

```
内存中维护: initializing_papers: Map<string, Promise>

key 格式: "arxiv:2401.12345" 或 "corpus:123456789"

请求 A: 创建 arxiv_id=2401.12345
  → check Map → 无 → 加入 Map (存入 Promise) → 创建论文 → 完成后移除

请求 B: 同时创建 arxiv_id=2401.12345
  → check Map → 已存在 → await Promise → 拿到已创建的论文

请求 C: 创建 corpus_id=999 → s2 解析出 arxiv_id=2401.12345
  → 写入 arxiv_id 前查 DB → 已存在 → 合并到已有条目
```

### 3.6 服务管理页面（全局 Dashboard）

- **服务列表**：展示所有已注册的 services，显示当前并发数 / 最大并发数、速率限制
- **依赖图可视化**：展示 paper-bound services 之间的键值依赖关系
- **并发配置**：为每个 service 配置最大并发数和速率限制
- **执行历史**：全局查看所有 service 的执行记录，**支持分页**，可按 service 名称和状态筛选
- **重试操作**：对 `failed` 或 `blocked` 状态的执行记录，提供重试按钮（调用 `POST /api/papers/:id/services/:serviceName/trigger`），带加载状态和错误反馈

### 3.7 执行记录

每条执行记录包含：

| 字段 | 说明 |
|------|------|
| service_name | 服务名称 |
| paper_id | 关联论文 |
| status | pending → waiting → running → done / failed / blocked |
| progress | 执行进度 (0-100%) |
| created_at | 创建时间 |
| finished_at | 完成时间 |
| result / error | 执行结果或错误信息 |

### 3.8 服务执行状态流转

```
                  ┌───→ blocked  (依赖的键值无服务可产生)
                  │
pending ──→ waiting ──→ running ──→ done
  (已提交)  (等依赖)    (执行中)     │
                           │        ├── partial (部分键值写入成功)
                           │        │
                           └────────┴──→ failed
```

---

## 四、全局配置

所有配置统一在 `config.yml` 中管理。

### 4.1 配置结构

```yaml
# 数据库
database:
  type: sqlite
  path: ./data/paperland.db

# 认证
auth:
  users:
    - username: "admin"
      password: "your-password-here"
  # External API token (由前端签发，存储在数据库中)

# 服务配置
services:
  arxiv:
    max_concurrency: 3
    rate_limit_interval: 3     # 两次请求最小间隔 (秒)
  semantic_scholar_service:    # 服务名须与代码注册名一致，否则并发/限流不生效
    max_concurrency: 1         # S2 带 key 默认 1 RPS（所有端点）
    rate_limit_interval: 1     # 无 key 建议 3；S2 强制指数退避
    # api_key_env: SEMANTIC_SCHOLAR_API_KEY   # 或 api_key: <key>（config.yml 已 gitignore），经 x-api-key 头发送
  pdf_parse:
    max_concurrency: 2
    method: python             # python | nodejs
    python_script: ./scripts/pdf_parser.py
  qa:
    max_concurrency: 2

# 模型配置
models:
  default: "gpt-4o"
  available:
    - name: "gpt-4o"
      type: openai_api
      endpoint: "https://api.openai.com/v1"
      api_key_env: "OPENAI_API_KEY"
    - name: "claude-sonnet"
      type: claude_cli
    - name: "codex"
      type: codex_cli
```

### 4.2 Prompt 模板

- 定义在 `config.yml` 中的 `system_prompt` 和 `qa` 字段
- `system_prompt`：多行字符串模板，使用 `{PAPER}` 和 `{PROMPT}` 占位符定义论文与问题的拼接方式
- `qa`：有序数组，每项包含 `name`（模板名，作为 QA Entry 的 key）和 `prompt`（问题文本）
- 列表顺序决定前端展示顺序

### 4.3 前端设置页面

- 查看当前配置（只读展示或可编辑，**TBD**）
- 模型列表及默认模型选择
- 各 service 并发数调整
- **Token 管理**：签发 / 查看 / 撤销 External API Token

---

## 五、认证与授权

### 5.1 会话登录（取代 HTTP Basic Auth）

网站 `/api/*` 改用**应用内会话登录**，支持"未登录只读 + 登录后操作 + 在线改密 / 用户名 + 角色区分"。

- **用户存储**：用户账户存于数据库 `users` 表（`id`、`username` 唯一、`password_hash`、`role`、`created_at`），不再使用 `config.yml` 的 `auth.users`（该字段已弃用）。密码用 `Bun.password`（argon2id）哈希。
- **首启 seeding**：数据库无用户时，自动创建 `admin`（随机强密码），并在**服务器日志打印明文密码一次**。仅支持登录、不支持注册——新用户由管理员添加。
- **会话**：登录成功后写 `sessions` 表（随机不透明 token + 30 天过期）并下发 httpOnly cookie `paperland_session`（`SameSite=Lax; Path=/`）。前端 `fetch` 同源自动携带；401 时自动弹出登录框。
- **角色**：`admin` 与 `user` 两种。管理员可管理用户（增 / 改角色 / 重置密码，**不支持删除**，且不能降级最后一个 admin）。
- **开发期免登录**：`config.yml` `auth.enabled: false` 时跳过登录，所有 `/api/*` 以 admin 身份访问（本地开发用，启动会打印警告）；`true`（默认）启用会话登录与下方分层。

#### 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 公开。校验后建会话、下发 cookie |
| POST | `/api/auth/logout` | 删会话、清 cookie |
| GET | `/api/auth/me` | 公开。返回 `{ user }`（未登录为 `null`，不 401） |
| PATCH | `/api/auth/me` | 改本人用户名 / 密码（改密需校验 `current_password`） |
| GET/POST/PATCH | `/api/users` `/api/users/:id` | **仅 admin**。列表 / 新建 / 改角色 / 重置密码 |

### 5.2 访问分层（三级矩阵）

身份在请求钩子统一解析（注入 `request.user`），授权由各路由的 `requireUser` / `requireAdmin` preHandler 强制：

| 层级 | 范围 |
|------|------|
| **公开（免登录）** | 论文列表 / 详情、模板问答（template Q&A）、PDF / 查看器、`/api/health`、`login`、`me` |
| **公开但按属主过滤** | `GET /api/papers/:id/qa`（template 全量 + free 仅本人）、`GET /api/highlights`、`GET /api/papers/:id/tags`（匿名返回空、200） |
| **需登录（任意用户）** | 增 / 改 / 删论文、所有问答触发与重生成、高亮增改删、标签管理、`/qa` 列表、Idea Forge、单篇论文服务状态 / 触发、改本人账户 |
| **仅管理员** | 服务管理 Dashboard（`/api/services*`）、设置页 Token 管理（`/api/settings/tokens*`）、用户管理（`/api/users*`） |

- 前端路由守卫：受限路由未登录弹登录框、非管理员访问管理员页提示无权限。
- 侧边栏：未登录仍展示全部按钮（保持美观），点击受限项弹"需要登录"提示；登录后显示账户菜单（用户名、改名改密、登出）。

### 5.3 数据归属（按用户私有）

`free Q&A`、`论文标签（tag for paper）`、`文本高亮` 增加 `user_id`（外键 `users.id`）：

- **标签完全按用户隔离**：每个用户拥有自己的标签（名称 / 颜色 / 可见性）与"论文↔标签"关联，唯一性按 `(user_id, name)`。论文列表 / 详情仅展示当前用户的标签，匿名用户看不到任何标签（`papers.tags_json` 全局缓存已弃用，改为按当前用户实时 JOIN 计算）。
- **free Q&A / 高亮**：只能看见自己的；模板问答（template）为公开共享（`user_id` 为空）。
- **迁移**：升级时把库中已有的标签、free Q&A、高亮、API token 一次性归属到新建的 admin。
- 笔记功能尚未实现，但归属模型已为其预留（未来加 `user_id` 即可）。

### 5.4 External API Token

- 管理员在「设置」页面签发 / 查看 / 撤销 Token（Token 管理为**仅管理员**）。
- 每个 Token 归属一个用户（`api_tokens.user_id`）；以该 Token 调用 External API 时按其归属用户操作，故 Zotero 等创建 / 同步的标签归该用户所有。已有 Token 迁移归属 admin。
- Token 无细粒度权限，持有即可访问全部 External API 端点。

### 5.5 认证架构

```
浏览器 ──[会话 cookie paperland_session]──→ Internal API + 前端页面
            │                                  │
            │                                  ├── 公开只读 / 需登录 / 仅管理员 三级分层
            │                                  └── 管理员在设置页签发 Token（归属某用户）
            │
第三方  ──[Bearer Token]────→ External API (/external-api/v1/...)
(Zotero等)                    Token 解析其归属用户，数据按该用户归属
```

---

## 六、核心数据模型

### 6.1 Paper

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 内部主键 |
| arxiv_id | text (nullable, unique) | arXiv ID |
| corpus_id | text (nullable, unique) | Semantic Scholar corpus ID |
| title | text | 标题 |
| authors | text (JSON array) | 作者列表 |
| abstract | text (nullable) | 摘要 |
| contents | text (JSON, nullable) | 论文内容字典，详见下方 |
| pdf_path | text (nullable) | 本地 PDF 文件路径 |
| metadata | text (JSON, nullable) | 各服务抓取的其他元数据（S2: citation_count / reference_count / influential_citation_count / references / tldr / venue / year / doi / fields_of_study / s2_url） |
| tags_json | text (JSON, nullable) | 冗余标签数据 `[{id, name}]`，自动同步 |
| created_at | datetime | 创建时间 |

**`contents` 字典结构：**

| key | 来源 | 说明 |
|-----|------|------|
| `user_input` | 用户手动输入 | Q&A 上下文优先级最高 |
| `pdf_parsed` | PDF 解析 | Q&A 上下文优先级最低 |
| (可扩展) | 未来新来源 | 只需新增 key |

Q&A 取上下文时按 `config.yml` 中 `content_priority` 列表顺序，取第一个非空值。全部为空则报错。

### 6.2 Tag & PaperTag

**Tag:**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| name | text (unique) | 标签名称 |
| color | text (not null, default '') | 标签颜色（hex，如 `#6366f1`），创建时随机分配 |

**PaperTag (多对多关联表):**

| 字段 | 类型 | 说明 |
|------|------|------|
| paper_id | integer → Paper.id | 论文 |
| tag_id | integer → Tag.id | 标签 |

**Paper.tags_json (冗余字段):**

papers 表新增 `tags_json` (text, nullable) 字段，存储 `[{"id":1,"name":"ML"}]` JSON 数组。每次标签变更（增删改合并删除）时自动同步。前端列表页直接使用此字段渲染标签，避免 JOIN 查询。

**标签管理页面 (`/tags` → TagManagement.vue):**

- 侧边栏 Tag 图标入口
- 列表展示所有标签：颜色色块、名称、关联论文数、编号
- **可见性切换**：每个标签行有眼睛图标按钮（Eye/EyeOff），点击切换标签在论文列表筛选栏中的可见性。默认可见。隐藏标签的 EyeOff 图标始终显示，可见标签的 Eye 图标仅 hover 时显示。
- 内联重命名：如新名称已存在则弹出合并确认对话框
- 删除：确认对话框（不可撤销）
- 颜色选择器：预设 20 色调色板

**标签 Pinia Store (`stores/tags.ts`):**

- `tags` 数组、`colorMap` 计算属性
- `fetchTags()` / `ensureLoaded()` / `refreshCache()`
- `renameTag()` / `mergeTag()` / `deleteTag()` / `updateTagColor()` / `toggleVisibility()`
- 缓存策略：页面加载时请求一次，修改颜色后主动刷新

**标签组件:**

- `TagBadge.vue`：渲染单个标签徽章，使用颜色缓存，支持 clickable 模式
- `TagSelector.vue`：搜索式下拉选择器，支持选择已有标签或创建新标签

### 6.3 QA Entry

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 自由提问使用此递增 id 作为索引 |
| paper_id | integer → Paper.id | 关联论文 |
| type | text: "template" \| "free" | 提问类型 |
| template_name | text (nullable) | 模板名称，仅 template 类型有值，作为索引 key |
| status | text: "pending" \| "running" \| "done" \| "failed" | 执行状态 |
| error | text (nullable) | 错误信息 |
| created_at | datetime | 创建时间 |

### 6.4 QA Result

每个 QA Entry 关联一个 results 数组，默认展示最新的。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| qa_entry_id | integer → QAEntry.id | 关联的 QA Entry |
| prompt | text | 实际发送的问题文本 |
| answer | text | 模型的回答 |
| model_name | text | 使用的模型名称 |
| completed_at | datetime | 回答完成时间 |
| execution_id | integer (nullable) → ServiceExecution.id | 关联的服务执行记录 |

### 6.5 Service Execution

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| service_name | text | 服务名称 |
| paper_id | integer → Paper.id | 关联论文 |
| status | text | pending / running / done / failed |
| progress | integer | 0-100 |
| created_at | datetime | 创建时间 |
| finished_at | datetime (nullable) | 完成时间 |
| result | text (nullable) | 执行结果 |
| error | text (nullable) | 错误信息 |

### 6.6 ApiToken

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| token | text (unique) | Token 值 |
| created_at | datetime | 签发时间 |
| revoked_at | datetime (nullable) | 撤销时间，null 表示有效 |

### 6.7 数据关系

```
Paper (1) ──→ (N) QA Entry (1) ──→ (N) QA Result
  │
  ├──→ (N) PaperTag (N) ←── (1) Tag
  │
  └──→ (N) Service Execution
```

---

## 七、防重复提交机制

### 模板提问一键生成

```
点击 [一键生成所有模板回答]
         │
         ▼
   遍历所有模板 (从 config.yml qa 列表读取)
         │
         ├── 该模板已有 QA Entry 且 results.length > 0  → 跳过
         ├── 该模板已有 pending/running 的 Service Execution → 跳过
         └── 无结果且无进行中任务 → 创建 QA Entry + 提交 Service Execution
```

### 手动重新生成

- [重新生成] 按钮：强制提交新任务
- 模板提问：从 config 读取最新模板 prompt
- 自由提问：使用原始问题（不可更改）
- 新 QA Result 追加到 results 数组

---

## 八、分页

所有列表类数据统一支持分页。

### API 分页参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `page` | 1 | 当前页码 |
| `page_size` | 20 | 每页条数 |

### API 分页响应格式

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 156,
    "total_pages": 8
  }
}
```

### 需要分页的页面

| 页面 | 分页对象 |
|------|---------|
| 论文列表 | 论文条目 |
| 服务管理 - 执行历史 | Service Execution 记录 |
| 独立 Q&A 页面 | QA Entry 列表 |

---

## 九、全局 API 错误提示

前端通过 `api/client.ts` 发起的所有请求，如果返回非成功响应或网络错误，会自动在页面顶部弹出红色浮动 toast 通知。

### 机制

- `lib/error-bus.ts`：基于 `EventTarget` 的事件总线，API client 在 throw 错误前 dispatch 事件
- `components/GlobalAlert.vue`：挂载在 `App.vue` 根级，监听错误事件并展示 toast
- 该机制是补充性的全局兜底，不替代各页面已有的具体错误处理

### Toast 行为

| 特性 | 说明 |
|------|------|
| 自动消失 | 5 秒后自动移除 |
| 手动关闭 | 点击 X 按钮立即移除 |
| 最大数量 | 同时最多 5 条，超出时最旧的自动移除 |
| 动画 | 使用 Vue TransitionGroup 实现淡入淡出 |

---

## 待确认事项

### 已确认

- [x] ~~论文列表是否需要标签~~ → 支持标签（Zotero 同步）
- [x] ~~论文是否支持删除~~ → 暂不支持，未来如做则使用级联删除
- [x] ~~搜索方式~~ → 按 title 和 abstract 模糊匹配
- [x] ~~Service 限流~~ → rate_limit_interval 配置
- [x] ~~实时通知方式~~ → 短轮询
- [x] ~~双栏比例~~ → 可拖拽调整
- [x] ~~模板管理~~ → 通过 config.yml 中的 system_prompt 和 qa 字段管理
- [x] ~~批量操作~~ → 论文列表支持多选，具体批量功能 TBD
- [x] ~~数据库备份~~ → SQLite 每日备份，保留 30 天

---

## 十、嵌入模式（Embed Mode）

当 Paperland 页面在 Zotero 侧边栏等外部容器中通过 iframe/嵌入浏览器加载时，可通过 URL 查询参数激活嵌入模式，优化 UI 以适应狭窄的侧边栏环境。

### 10.1 URL 参数

| 参数 | 格式 | 说明 |
|------|------|------|
| `embed` | `embed=1` | 激活嵌入模式，隐藏导航 chrome、缩小内容边距、显示刷新按钮 |
| `bg` | `bg=f2f2f2`（6 位 hex，不带 `#`） | 自定义页面背景色，可独立于 embed 参数使用 |

示例 URL：`/papers/42?embed=1&bg=f2f2f2`

### 10.2 嵌入模式行为

| 变化 | 说明 |
|------|------|
| 隐藏桌面侧边栏 | 52px 图标导航栏不渲染 |
| 隐藏移动端导航栏 | 顶部 navbar 和汉堡菜单不渲染 |
| 隐藏论文标题 header | PaperDetail 页面的返回按钮 + 标题栏不渲染 |
| 缩小内容边距 | 单栏布局 padding 从 `p-5` 缩小到 `p-2`，去掉 `max-w-3xl` 限制 |
| 刷新按钮 | 页面顶部显示紧凑的刷新按钮工具栏（h-8），点击执行 `window.location.reload()` |
| 强制单栏布局 | 无论视口宽度如何，PaperDetail 页面始终使用单栏布局，不启用双栏分屏视图 |
| 自定义背景色 | `bg` 参数应用到 `document.documentElement` 和根 div |

### 10.3 实现

- **Composable**：`composables/useEmbedMode.ts` 在模块加载时从 `window.location.search` 读取并缓存参数，提供 `isEmbed`（boolean）和 `bgColor`（string | null）响应式状态
- **App.vue**：条件渲染侧边栏和移动端导航，应用背景色
- **PaperDetail.vue**：条件渲染标题 header / 刷新按钮工具栏，动态切换内容区 padding

---

### 待确认

- [ ] 论文列表是否需要分类 / 阅读状态功能
- [ ] 设置页面是只读展示还是支持在线编辑 config.yml
- [ ] 论文详情页是否需要展示引用关系
- [ ] 批量操作的具体功能（批量跑模板提问、批量删除等）
- [ ] 移动端适配策略（双栏 → 单栏切换？）
- [ ] Token 是否需要过期时间

---

## Idea Forge (研究想法管理)

### 概述

Idea Forge 是集成在 Paperland 中的研究想法管理系统。数据存储在本地文件系统 `data/idea-forge/{project-name}/`，不使用数据库。每个想法是一个带 YAML frontmatter 的 README.md 文件。

### 页面

#### 项目列表页 (`/idea-forge`)

- `views/idea-forge/ProjectList.vue`
- 显示所有项目卡片（名称、idea 数量、paper 数量）
- 支持创建新项目（名称校验：`[a-z0-9][a-z0-9_-]*`）

#### 想法管理页 (`/idea-forge/:projectName`)

- `views/idea-forge/IdeaManager.vue`
- 三种视图模式，通过 URL `?view=inbox|kanban|list` 切换
- 顶部控制栏：视图切换、标签筛选、分类筛选、排序控制、Paper Dump 按钮

### 视图模式

#### Inbox 模式

- `components/idea-forge/InboxView.vue`
- 左侧列表（340px）+ 右侧详情面板
- 默认筛选 `unreviewed` 分类，按 `update_time` 降序

#### Kanban 模式

- `components/idea-forge/KanbanView.vue`
- 四列看板：unreviewed / under-review / validating / archived
- 每列最小宽度 280px，超出横向滚动
- 使用 `vuedraggable` 实现拖拽移动分类

#### List 模式

- `components/idea-forge/ListView.vue`
- 平铺表格，列：名称、分类、摘要、评分、LLM评分、作者、标签、创建/更新时间
- 点击行跳转到 inbox 模式

### 核心组件

- **IdeaDetail** (`components/idea-forge/IdeaDetail.vue`)：想法详情面板
  - 固定顶部：评分（星星）、LLM 评分（只读）、作者、保存按钮、分类快切按钮、评论输入框
  - 可滚动底部：摘要（可编辑）、正文（Markdown 预览/编辑切换）、标签、时间戳
- **ScoreInput** (`components/idea-forge/ScoreInput.vue`)：0-5 星选择器
- **PaperDumpDialog** (`components/idea-forge/PaperDumpDialog.vue`)：论文导出对话框

### 编辑与保存

- 正文/摘要编辑：2 秒防抖自动保存
- 评分/评论/分类变更：立即保存
- Ctrl+S 手动保存
- 冲突检测：基于 content_hash（SHA-256），409 响应时显示"文件已被外部修改"错误 + Reload 按钮

### Pinia Stores

- `stores/idea-forge.ts`：项目列表、创建项目、Paper Dump
- `stores/ideas.ts`：想法列表、详情、更新、移动、冲突状态追踪

### Idea 分类

| 分类 | 含义 |
|------|------|
| `unreviewed` | 新创建，未审阅 |
| `under-review` | 正在评估 |
| `validating` | 已接受，验证中 |
| `archived` | 已归档 |

---

## 笔记 (Notes)

按用户私有的、面向整篇论文的笔记。UI 文案统一用英文（Notes / Overview）。

### 数据模型

单表 `notes`（见 tech-stack.md），无结构化 anchor 字段。每 (用户, 论文) 是**一棵树**，由唯一的**根笔记**（`kind='root'`，全树唯一 `parent_id IS NULL` 的节点）锚定：

- **根笔记 root**：每 (用户, 论文) 至多一条，是整棵树的父节点；编辑器里标为 **Overview**。它**惰性创建**——没有任何笔记的论文在库中零行，直到用户首次往根笔记写内容、或挂上第一条子笔记时才创建。
- **笔记 note**：任意多条，经 `parent_id` 自引用挂在根笔记下成树、`sort_order` 定同级次序；前端 `buildRootTree()` 组装成以根笔记为根的单棵树（无持久化根时给出一个合成的占位根节点）。
- **不再区分大/小笔记**：原 `walkthrough` 类型已废弃（数据迁移 0014 删除其行、为有顶层笔记的 (用户, 论文) 建根并把顶层笔记 reparent 到根下）。「通读全文」类需求今后由独立的 walkthrough view 承载，与根笔记无关。
- **按内容计数**：仅 `body`（去空白后）非空的节点计入笔记总数——空根笔记、仅有标题无正文的节点都不计数（但仍在思维导图中显示）。

### 锚定：`paperland://` 内联链接 + content_hash 块寻址

锚点不落库为字段，而是写在笔记 `body` 里的自定义协议 Markdown 链接：

```
paperland://paper/<id>                       // 仅跳论文页
paperland://paper/<id>?h=<content_hash>       // 定位某个 MarkdownContent 块
paperland://paper/<id>?h=<hash>&s=<start>&e=<end>  // 块内文本范围
paperland://paper/<id>?pdf=<page>            // 跳到 PDF 第 page 页（1 起）
paperland://paper/<id>?pdf=<page>&ts=<start>&te=<end>  // 跳到该页并高亮某段选区
```

- 目标分两类且互斥：**Markdown 块**（`h`/`s`/`e`）或 **PDF 页/选区**（`pdf`/`ts`/`te`）。同时带 `h` 和 `pdf` 时 **`pdf` 优先**。
- 定位基于**块的 `content_hash`**（与高亮同一指纹），不依赖问题/回答的 id 或下标——多模型多回答、重新生成、重排序都不会跑偏。
- `MarkdownContent` 给渲染容器挂 `data-content-hash`，并拦截 `paperland://` 链接点击：本页直接 `locateBlock`，跨页 `router.push('/papers/:id?h=...')`。
- `composables/useBlockAnchor.ts` 的 **`locateBlock(paperId, hash, range?)`**：① DOM 命中 → 滚动 + 闪烁；② 未命中（折叠 / 未激活 tab）→ 遍历 Q&A store 现算 hash 反查归属，展开 `Collapsible` + 激活对应 result tab（`requestedResultId`）后再定位；③ 找不到 → toast 失效、不跳转。有 `s`/`e` 时在块内按 offset 高亮该片段（复用 `useHighlight` 的 segment 逻辑）。
- 选区浮动工具栏（登录态）的「复制为锚点链接」：把**整段选区还原成 Markdown** 后，再追加一个紧凑的 `[#](paperland://...)` 锚点链接（形如 `<选区 Markdown> [#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)`）。还原用 `turndown` + `turndown-plugin-gfm`（整表→GFM 管道表）；数学公式从各 KaTeX 元素的 `x-tex` annotation 还原为 `$…$`（行内）/独立成行的 `$$…$$`（行间），并用占位符在 turndown 转义后再回填，保证 LaTeX 不被破坏；选区内的高亮 `<mark>` 会被剥离。锚点的 `s`/`e` 仍取渲染态偏移，跳转逻辑不变。
- **PDF 目标**走嵌入式 pdf.js 查看器（见 1.4「嵌入式 pdf.js 查看器」）：`MarkdownContent` 解析出 `pdf`/`ts`/`te` 后，本页直接调 `requestPdfNavigation(...)`（`composables/usePdfNavigation.ts` 的模块级 `requestedPdfTarget` ref，仿 `requestedResultId`），跨页 `router.push('/papers/:id?pdf=...&ts=...&te=...')`；`PaperDetail.handleAnchorFromRoute` 加载后读 query 设置同一 ref。`PaperViewerPanel` 监听该 ref 自动切到「PDF 原文」Tab，`PdfViewer` 监听后滚动到该页、把 `ts/te` 偏移映射回文本层矩形并画**临时高亮**（不落库，类似块锚点的闪烁）。`ts`/`te` 是该页**文本内容的字符偏移**（pdf.js `getTextContent()` 顺序，与高亮同一偏移模型），缩放无关。
- 锚定面覆盖 `MarkdownContent` 渲染文本（Q&A 回答、摘要/FAQ、笔记自身）**与 PDF 正文页/选区**；外部翻译 iframe 不可锚定。

### 浮动编辑窗口

根笔记（Overview）与普通笔记都在同一浮动窗口里编辑（`components/notes/`）：

- `stores/windows.ts`：多窗管理、z-index 栈（最后点击置顶）、全局尺寸记忆（localStorage，新窗口按上次缩放尺寸打开）。窗口 `kind: 'root' | 'note'`，根窗口按 `root-<paperId>` 唯一键（与具体 note id 无关）。
- `FloatingNoteWindow.vue`：电脑端可拖拽（标题栏）+ 可缩放（右下角），浮于页面顶层；手机端全屏。标题栏显示标题 + 关闭。
- `NoteEditor.vue`：三显示模式（Editor / Split / Preview）点选切换；预览复用 `MarkdownContent`；2s 防抖自动保存 + Ctrl+S（沿用 idea-forge 范式）。根窗口标题固定为 **Overview**、无标题输入框，保存走 `saveRoot`（首次惰性建根）；普通笔记走 `updateNote`。
- `NoteWindowHost.vue`：在 `App.vue` 挂载一次，渲染所有打开的窗口。

### 分支思维导图

`components/notes/NoteMindmap.vue` + 递归 `NoteNode.vue`：整棵笔记树以分支思维导图呈现（CSS 自动布局的层级节点 + 连线，节点只显示标题），**根笔记始终作为唯一根节点显示**（无持久化根时为占位节点，标为 Overview）。点击节点开其编辑窗口（根节点 → Overview 编辑器）；普通节点支持增子 / 增兄 / 删除（删除前确认并显示连带子节点数），**根节点不可拖拽、不可删除、无「增兄」**（只可增子）；拖拽改父子（落到某节点 → 成其子；落到空白画布 → 挂到根笔记下，绝不变成无父节点），乐观更新 + 失败回滚，后端防环。表头计数为 `store.noteCount`（仅非空 body 的节点）。

**节点字符数徽章**：body 非空（`body.trim()` 不为空）的节点在标题后显示一个灰色括号字符数 `(N)`（`.nn-count`，`var(--muted-foreground)`、`pointer-events:none`），N 为 `node.body.trim().length`；空节点不显示。徽章随节点 body 编辑实时更新（`node` 来自响应式 tree）。

### Walk-through 视图

`components/notes/NoteWalkthrough.vue`：把整棵笔记树渲染成一篇连续的阅读视图，作为左侧面板的「Walk-through」查看模式（见上方「多模式查看器」）。组装逻辑是 `stores/notes.ts` 的纯函数 `flattenWalkthrough(root): WalkthroughSection[]`——返回**结构化的 section 列表**（而非单个 Markdown 字符串），这样每个标题能携带 `noteId` 与编号、支持交互：

- **顺序**：按思维导图深度优先遍历，同级按 `sort_order`（复用 `tree` computed 已排好序的 children）。每个节点先出自身 section，再递归子节点。
- **层级**：根笔记**不出标题**，其 body（若非空）作为开篇引言 section（原样渲染、不编号）；根的直接子节点起始为 **H2**，每深入一层 +1（`level = min(2 + depth, 6)`，封顶 H6）。笔记标题层级仅由思维导图深度决定。
- **正文内标题重排**：节点 body 里用户自己写的 markdown 标题会被**重排到该笔记标题之下**——body 中最浅的标题落在比该笔记深一级处，更深的保留相对嵌套（distinct 层级映射成连续 rank）；代码围栏内的 `#` 不当标题。
- **自动编号（含正文标题）**：用一个贯穿全程的计数器 `outlineNumberer()`，给**所有标题**（笔记标题 + body 内部标题）统一编号 `1.`、`1.2.`、`1.2.3.`（带尾点）。`numberBodyHeadings` 把 body 标题穿插进同一套大纲：一个笔记自身的子小节标题与它的子笔记在文档顺序里共享一层（如笔记 `1.` 的 body 标题 `1.1.`、其第一个子笔记 `1.2.`）。编号**只看走查里 heading 的层级与顺序**，与笔记自身标题文字无关；根引言不编号。编号为黑色（继承标题色）。
- **点击进入编辑**：**笔记标题**用 `<component :is="'h'+level">` 渲染并挂 `@click`，经 `windows.open({ kind:'note', paperId, noteId, title })` 打开该笔记浮动编辑器（与思维导图同一套窗口模型）；标题带**常驻**铅笔图标 + hover 下划线提示。**body 内部标题不对应单个笔记，故有编号但不可点、无铅笔**。
- **正文渲染 + 关高亮**：每个 section 的 body 用 `MarkdownContent` 渲染并传 `:disable-highlights="true"`——走查内容是动态拼接的，与基于内容哈希的高亮模型不兼容，故关掉划线工具条/已存高亮/点击菜单（锚点链接、KaTeX 复制仍可用）。该 prop 在 `MarkdownContent` 内通过 `myHighlights` 直接返回 `[]`、`onMounted` 跳过 selection/dismiss 监听 实现。
- **空节点**：无标题用 `(untitled)` 占位；body 为空只出标题并继续递归子节点。
- **实时重渲染**：`sections = computed(() => flattenWalkthrough(store.tree))`，故笔记内容编辑、节点改父/重排都会自动重新组装并渲染，无需手动刷新。无内容时显示「No notes yet」。
- **阅读型字号（仅本视图）**：正文用紧凑阅读字号（`.nw-content { font-size: 0.9rem }`）；标题用**绝对 rem**（h2 1.7rem → h6 1.05rem），不随正文缩放而变。笔记标题（`.wt-heading`）与 body 标题（`MarkdownContent` 渲染，经 `.nw-content :deep(.markdown-content hN)` 同级同尺寸）保持一致；只作用于走查，不影响 Q&A / 论文正文等处 Markdown 字号。

### 入口与归属

- 论文详情页右栏 `PaperNotesCard`（位于 Q&A 之上）：即思维导图本身（根笔记 + 其子树）；匿名显示「Sign in to take notes」。
- 独立 `/notes` 页（`views/NotesPage.vue`，`requiresAuth`）：跨论文聚合，按论文分组 + 客户端搜索（仅列 body 非空的笔记，空根笔记不出现）；点击笔记跳到其 `/papers/:id?note=`（根笔记用 `?root=1`）并打开浮窗。
- 侧边栏新增 Notes 项（登录门禁）。
- 访问控制沿用 auth 模型：owner-scoped 读（匿名返回空 200）、写一律 `requireUser` + 属主校验（非属主 404）。

### 后端 API（`api/notes.ts`，全部 owner-scoped）

`GET /api/papers/:id/notes`（返回 `{ notes }` 扁平列表，含根笔记）、`PUT /api/papers/:id/root`（upsert 根笔记 + 乐观 `updated_at` 409；首次创建无需 `updated_at`）、`POST /api/papers/:id/notes`（无 `parent_id` 时经 `ensureRoot` 挂到根下、惰性建根）、`PATCH /api/notes/:id`、`POST /api/notes/:id/move`（防环；`parent_id` 为 null 解析为根；拒绝移动根）、`DELETE /api/notes/:id`（事务内级联删子树；拒绝删根）、`GET /api/notes`（跨论文聚合 + `paper_title`，排除 body 为空的行）。根笔记的单实例由 `notes_root_unq` 分区唯一索引（`WHERE kind='root'`）保证，`ensureRoot` 在索引冲突时回读胜出者。

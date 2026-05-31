# Paperland 前端功能架构

## 概述

Paperland 是一个论文管理网站。核心功能包括论文管理、数据抓取服务管理、以及基于大模型的论文 Q&A。

数据库使用 SQLite。全站配置统一在 `config.yml` 中管理。

## UI 技术栈

- **框架**：Vue 3 + Vite，状态管理 Pinia，路由 vue-router
- **样式**：Tailwind CSS v4（CSS-first 配置，`@tailwindcss/vite` 接管编译），无 `tailwind.config.js`、无 `postcss.config.js`
- **主题**：OKLCH CSS 变量定义在 `src/assets/main.css` 的 `:root` / `.dark` 块；`@theme inline { ... }` 把变量映射为 Tailwind token（`bg-background` / `text-foreground` / `bg-primary` 等）。明暗切换由 `stores/theme.ts` 驱动（见下文「主题切换（夜间模式）」），开关只在 `<html>` 上加/去 `.dark` 类，全站 token 随之生效，组件无需逐个改色
- **组件库**：[shadcn-vue](https://shadcn-vue.com) —— 通过 `bunx shadcn-vue@latest add <name>` 把组件代码下载到 `src/components/ui/`（代码即资产，可直接编辑）。底层无样式原语来自 [reka-ui](https://reka-ui.com)（前身 radix-vue）
- **图标**：`@lucide/vue`（`Github` brand 图标因商标原因被 lucide v1 下架，App.vue 用 inline SVG 替代）
- **Favicon / 品牌图标**：`packages/frontend/public/favicon.svg`（Vite 把 `public/` 原样拷到 `dist/` 根）——**主题色文档图标**（`#0069A8` = `--primary = oklch(0.5 0.134 242.749)`，竖版页面铺满画布高度/保持竖版比例不拉伸/水平居中，右上折角 dog-ear `#004F7E`，文档内 3 条**白色文字线镂空**）置于**透明背景**，与「论文管理」的 `FileText` 母题一致；`index.html` 以 `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` 引用。颜色硬编码自 `--primary`（favicon 独立渲染、无法用 CSS 变量），**改主题色需重生成 favicon**。仅 SVG（常青浏览器 + Safari ≥16.4）；本机无 SVG→PNG 工具时未生成 `apple-touch-icon.png` 等光栅回退
- **字体**：`Noto Sans Variable`（正文）+ `Noto Sans Mono Variable`（等宽），通过 `@fontsource-variable` 加载
- **Toast 通知**：`vue-sonner`（`<Toaster>` 在 `App.vue` 根挂一次；调用 `import { toast } from 'vue-sonner'` 触发）；项目内通过 `lib/error-bus.ts` 的 `dispatchApiError` 包装

### 组件迁移约定

- 所有 button / input / textarea / dialog / sheet / select / tabs / badge / card / popover / tooltip / dropdown-menu / table / alert / scroll-area / sonner / command / checkbox / label / collapsible / skeleton 都来自 `@/components/ui/*`
- 折叠 disclosure 用 `<Collapsible>` 而非 HTML `<details>`；展开状态用 reactive `openMap`（如 `Record<string, boolean>`）管理
- **`Tooltip` 必须位于某个 `TooltipProvider` 内**。`App.vue` 挂了**两处** provider：一处包桌面侧边栏 `<aside>`，一处包主内容 `<main>` 的 `<RouterView />`。页面内容（路由组件）里用 `Tooltip` 时直接用即可，无需自己再套 provider；反过来，脱离 `App.vue` 外壳单独挂载用到 `Tooltip` 的组件会抛 "must be used within `TooltipProvider`"
- 单个 `.vue` 文件中的 Tailwind utility **主要承担布局**（grid/flex/spacing/responsive），不再用 utility 模仿按钮 / 输入框 / 卡片视觉
- 颜色用语义 token：`bg-primary`、`text-muted-foreground`、`text-destructive` 等。**不**使用 `text-indigo-600`、`bg-emerald-50` 之类的具体色阶
- Tag 徽章统一用 `TagBadge`（`components/TagBadge.vue`）：默认渲染中性 `secondary` 药丸；传入 `color` prop 时渲染该标签**自身颜色的淡色调 chip**（标签色文字 + 同色半透明底/描边，亮/暗模式皆可读）。标签管理页（`/tags`）即用 `color` 渲染真彩 chip；论文列表/详情目前不传 `color`，保持中性 `secondary`。后端始终保留每标签颜色（`tags.color`，前端 `tagsStore.getTagColor`）
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

### 主题切换（夜间模式）

左下角一键切换的明暗主题，在**白天 / 夜间 / 跟随系统**三态间循环（点击依次 Light → Dark → System → Light）。

- **Store**（`stores/theme.ts`）：`mode: 'light' | 'dark' | 'system'`，初值读自 `localStorage['paperland_theme']`（缺失/非法/不可用时回退 `system`）；派生 `resolved: 'light' | 'dark'`（`system` 时按 `matchMedia('(prefers-color-scheme: dark)')` 折叠为实际明暗）。唯一副作用集中在 store：`watch(resolved)` 在 `document.documentElement` 上加/去 `.dark` 类。`cycle()` 推进三态并持久化；并注册 `matchMedia` 的 `change` 监听，使 `system` 模式实时跟随系统切换。
- **防白闪（FOUC）**：`index.html` `<head>` 内联一段极小脚本，在主 bundle 加载前读取同一 `paperland_theme` 键并预先给 `<html>` 加 `.dark`，避免夜间模式刷新时先闪一下白天主题；store 挂载后为权威源（两者用同一键/逻辑，必然收敛）。
- **入口位置**：桌面侧边栏底部（账号/GitHub 旁，ghost 图标按钮 + tooltip 显示当前模式）、移动端抽屉 footer（整行按钮，带文字）。图标 `Sun`/`Moon`/`Monitor`（`@lucide/vue`）即当前态指示。embed 模式下整个外壳隐藏，故开关自然不出现。
- **PDF 内容随主题变色**：见上文「嵌入式 pdf.js 查看器」的「主题感知渲染」——夜间用 pdf.js 原生 `pageColors` 灰底白字重渲染。

### 页面布局（`AppPage` 统一管理页布局）

各「XX 管理」页通过共享组件 `components/AppPage.vue` 统一页面标题与内容宽度，不再各自手写页头 / 宽度容器：

- **标题**：固定置于内容区顶部，统一 `text-xl font-semibold`，左侧带**对应图标**、**无描述副标题**。标题文字默认取 `route.meta.title`（英文，与侧边栏标签、浏览器标签一致），可用 `title` prop 覆盖。
- **标题图标**：默认取 `route.meta.icon`（在 `router/index.ts` 为每个管理路由声明，与侧边栏导航图标一致：Papers→FileText、Conferences→CalendarDays、Tags→Tag、Q&A→MessageSquare、Notes→NotebookPen、Idea Forge→Lightbulb、Services→Activity、Settings→Settings），可用 `icon` prop 覆盖。图标只在 `meta` 里定义一处，避免与侧边栏图标漂移。
- **宽度**：默认居中收窄 `mx-auto max-w-5xl`；传 `full` 则全宽、无最大宽度限制。
- **`fill` 模式**：用于自管内部滚动的页面（如 Q&A）——外层 `h-full flex flex-col`，标题头 `shrink-0` 不随滚动，内容区为 `flex-1 min-h-0 overflow-hidden`，页面内部的 `overflow-y-auto` 子元素照常滚动。非 `fill` 时页面随 `<main>` 整体滚动。
- **操作按钮**：经 `#actions` 具名插槽渲染在标题右侧（如「添加论文」「新建会议」「New Project」、服务管理「回填 S2」、会议详情「刷新 / 解析 / 导入」）。

各路由归类：

- **全宽（`full`）**：论文管理 `/`（表格需要整页宽）。
- **收窄管理布局（`max-w-5xl`，即 1024px）**：`/tags`、`/qa`（`fill`）、`/notes`、`/images`（图床画廊）、`/conferences`、`/conferences/:id`（标题固定为 `Conferences`，会议名 + 返回按钮置于内容区）、`/services`、`/settings`、`/idea-forge`。
- **不使用 `AppPage`（保留自有全宽布局与 chrome）**：论文详情 `/papers/:id`、Idea 工作区 `/idea-forge/:projectName`——顶部不显示管理标题栏；`PaperDetail` 的 embed / 窄屏宽度（见 embed-mode）保持不变。

> **新建管理页 checklist**：① 在 `router/index.ts` 给路由加 `meta.title`（英文，与侧边栏/标签一致）+ `meta.icon`（`@lucide/vue` 图标）；② 在 `App.vue` 加侧边栏导航项（同图标 + 英文标签）；③ 视图根用 `<AppPage>` 包裹，**不要再手写 `<h1>` 或宽度容器**——标题/图标由 `AppPage` 从 `meta` 自动渲染；画廊/看板/表格类传 `full`，自管内部滚动类传 `fill`，右上角按钮放 `#actions` 插槽。详情页除外。

> 标题「随滚动固定」（sticky header）暂未实现，仍维持滚动后标题滑出视口的现状。

---

## 一、论文管理

### 1.1 论文列表页

- 展示所有已添加的论文
- 每条记录显示：标题、标签（彩色徽章）、作者、来源（link）、引用指标（Cited / Refs）、日期
  - **标签列**：使用 `TagBadge` 组件（`components/TagBadge.vue`）渲染中性 `secondary` 圆角徽章（此处不传 `color`，真彩 chip 仅用于标签管理页）
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

#### 摘要中英双语（BilingualText）

信息区的「摘要」用通用组件 `components/BilingualText.vue` 渲染（详情页宽 / 窄两处布局均接入）。组件接收一段**纯文本**（不做 Markdown 渲染，`whitespace-pre-wrap` 保留换行），默认只展示英文原文，下方有一个小 **Translate** 按钮（lucide `Languages` 图标）。**仅登录用户**点击才翻译：未登录则唤起登录框（`useLoginPrompt().openLogin()`）、不发请求。点击后调 `translationApi.translate(text)`（`POST /api/translate`，由前端把文本喂入），翻译期间按钮显示 `Loader2` 并禁用；返回后在英文下方**追加**中文译文（带 muted「Translation」小标签），并提供 **Hide/Show** 折叠与 **Re-translate**（`force` 绕过缓存重译并覆盖）。翻译缓存由后端按内容寻址、**全体用户共享**（见 tech-stack.md「翻译服务」），同一段文本任意用户翻过一次后其他人点 Translate 即秒回。组件为通用叶子组件，可复用于其它纯文本（如未来 TLDR）。

#### 多模式查看器（PaperViewerPanel）

左侧面板支持多种查看模式，通过顶部 Tab 栏切换：

| 模式 | 条件 | 内容 |
|------|------|------|
| PDF 原文 | 论文有 `pdf_path` | 嵌入式 **pdf.js** 查看器（PdfViewer 组件，见下方「嵌入式 pdf.js 查看器」） |
| 幻觉翻译 | 论文有 `arxiv_id` | 嵌入 `https://hjfy.top/arxiv/{arxiv_id}` iframe |
| Walk-through | 该 (用户, 论文) 有非空笔记（`store.noteCount > 0`） | 整篇大笔记的三模式文档视图（render / edit / split，见下方「Walk-through / 文档视图」） |

- 自动选中第一个可用模式（Walk-through 排在 modes 数组末位，PDF/幻觉翻译优先；笔记加载后该 Tab 才出现，且不抢占当前选中）
- 无可用模式时显示占位提示
- 模式系统可扩展：添加新模式只需在 modes 数组中增加条目
- Walk-through Tab 的可用性来自 `useNotesStore().noteCount`，故 `PaperViewerPanel` 直接读 notes store（笔记由始终挂载的 `PaperNotesCard` 拉取）
- `PaperViewerPanel` 还监听 `usePdfNavigation` 的 `requestedPdfTarget`：一旦有 PDF 锚点跳转请求且 PDF 可用，自动把 active Tab 切到「PDF 原文」

#### 嵌入式 pdf.js 查看器（PdfViewer）

不再用浏览器原生 PDF 插件（`<iframe type="application/pdf">`），改为用 **pdfjs-dist** 自建轻量查看器，从而可编程跳页、读当前页、在页面上画高亮——这是支持 `paperland://…?pdf=…` 页面/选区锚点的前提。

- **加载**：`lib/pdfjs.ts` 的 `loadPdfjs()` 动态 `import('pdfjs-dist')`（被 Vite code-split 成独立 chunk，只有打开 PDF Tab 才拉取），worker 以 `pdf.worker.min.mjs?url` 注册到 `GlobalWorkerOptions.workerSrc`。`pdfjs-dist` 版本在 package.json 中**精确 pin**——`ts/te` 是 pdf.js 提取文本的字符偏移，需跨部署版本稳定。
- **渲染**：连续纵向滚动，每页一个按宽高比预留的占位 `.pdf-page`；`IntersectionObserver`（`rootMargin 200%`）在临近视口时把该页渲染到 canvas（HiDPI 用 `transform:[dpr,…]`）+ pdf.js 文本层（透明、可原生选中），远离视口时卸载 canvas 以省内存。
- **主题感知渲染（夜间模式）**：读 `stores/theme.ts` 的 `resolved`，夜间时给 `page.render({ pageColors })` 传 pdf.js **原生** `pageColors`（灰底 `#3a3a3a` / 近白字 `#e8e8e8`，与 `.pdf-page` 的 `.dark` 背景一致），由 pdf.js 在栅格内重新着色——比 CSS `invert()` 更准（可独立设灰底/白字），且选区高亮、`pdf-region-flash` 在 canvas 之上、仍走 UI token 不被反色。`pageColors` 烤进 canvas 无法原地变色，故 `watch(theme.resolved)` 在主题切换时对当前已渲染（可见/邻近）页用新配色重渲染（`rendered`/`renderTasks` 项带 `dark` 标记，使「同尺度已渲染」判断在仅主题变化时也重渲染），离屏页滚动到时再渲染。pdf.js 无现成「夜间模式」开关，`pageColors`（原为高对比/forced-colors 设计）是其支持的着色原语。
- **无白闪渲染**：pdf.js 在每次 render **开始**时把 canvas 填白（`background || "#ffffff"`），夜间的 `pageColors`（HCM 滤镜）要到 render **结束**才套上。若 canvas 先挂进 DOM 再渲染，浏览器会画出「白底→黑字→暗色滤镜」的中间帧 → 闪白。故每页渲染到**离屏新建 canvas**，待 `renderTask.promise` 完成（已是暗色）后再 `appendChild`/`replaceWith` 换入；旧 canvas 保留到换入瞬间。这样首帧即暗色不闪白，主题切换/缩放重栅格期间也不空屏不闪。
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
- **`/conferences/:id`（ConferenceDetail.vue）**：会议详情。按 `topic` 分组展示候选论文（`null` topic 归入「未分类」）。每条候选是一张**筛选卡片**：标题 → 元信息行（作者 · 引用数 · 领域）→ S2 **TL;DR** → **abstract**（`line-clamp` 截断 + 展开/收起）→ **统一外链行**（按源着色、与论文详情页一致：arXiv 红色 `Badge`（`destructive`）+ 蓝色 `S2Badge` + OpenReview/原文 灰色 `Badge`（`secondary`），只显示存在的）。候选已按 `topic` 分组，**行内不再重复 `#主题` 标签**；改主题走 `⋯` 菜单的「编辑主题」（点开后在外链行就地显示输入框 + 确认）。右侧为**状态药丸**（待添加 / 仅元数据 / 已在库）+ 主操作（仅元数据 → 加入；已在库 → 打开）+ `⋯` 菜单（编辑主题、删除）。顶栏「导入」对话框支持上传 JSON 文件或粘贴 JSON（接受 `{ papers: [...] }` 或裸数组）。
  - **三态生命周期（派生）**：`待添加`（无 `paper_id`）→ `仅元数据`（有 `paper_id` 且 `paper_listed === false`）→ `已在库`（`paper_listed === true` 或 `status === 'ingested'`）。UI **不再**呈现 `pending/candidate` 的「确认 / 退回」工作流与「本次会议一键添加」（DB `status` 列保留但前端不用）。
  - **复选框 = 选择以「加入列表」**：`仅元数据` 行可勾选；`已在库` 行默认勾选且锁定（不计入选择集合）；`待添加` 行禁用（需先「解析」）。「全选本组」只选 `仅元数据` 行。批量栏「加入选中到列表 (N)」→ `POST /api/conferences/:id/papers/promote { ids }`（对每条关联论文翻 `listed=1` 并触发完整管线，返回 `{ promoted, skipped, errors }`）。
  - **筛选字段 & 外链**：卡片的 abstract / TL;DR / 引用数 / 领域来自关联论文（`GET /api/conferences/:id/papers` 附带 `paper_abstract` / `paper_tldr` / `paper_citation_count` / `paper_fields_of_study`）。外链 id 取值优先级：关联论文 `paper_arxiv_id` / `paper_corpus_id` > 候选自身 `source`/`external_id` > 缓存 `metadata.s2_match`；arXiv / OpenReview 用显式 `Badge`（按源着色——arXiv 红 `destructive`、OpenReview/原文 灰 `secondary`、S2 蓝 `S2Badge`），**不走 `SourceTag`**（避免无 link 时渲染成 `-`，并保留 `OpenReview`/`原文` 友好标签而非主机名）。**配图暂不显示**（S2 Graph API 不提供论文 figures）。

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
| 独立 Q&A 页面 (/qa) | 按时间倒序展示自由提问的 Feed 流（不含模板提问，后端分页 20/页），每个 QA 为可折叠面板，显示关联论文标题及跳转链接，支持重新生成、删除、复制、Pin 等操作 |

**`/qa` Feed 卡片组成（`QAFeedPanel.vue`）**：每个条目 = **card 外上方的一行「论文标题（左，可用整行、不截断成窄宽）+ 提问时间（`ml-auto` 右对齐）」** + 下方一张内容简单的 shadcn `Card`。这样论文标题作为分组标签放在卡外，card 内层级更简单。card 由 `<Collapsible v-model:open>` 驱动展开/折叠（`CollapsibleTrigger as-child` 套在 `CardHeader` 上，合并后 DOM 的 `data-slot` 为 `collapsible-trigger`；`CollapsibleContent` 是卡片体，头/体间用 `<Separator>` 分隔）。card 头部保持**单行**：状态图标（`Tooltip` 标注 已完成/生成中/生成失败）+ **加粗问题**（`font-semibold`，与详情页问题一致）+ 右侧回答数或模型 `Badge`，**无展开 chevron**（整行可点切换）。论文链接在 card 外，点击只跳转、不影响折叠。组件根是单个 `<div>`（论文行 + card + 对话框），使外层列表的 `space-y-3` 按"条目"分隔。重新生成对话框用 `Checkbox` + `Label` 行做模型多选。卡片体复用 `QAResultView.vue`（多模型 `Tabs`、markdown、操作按钮）——其图标操作（Pin/复制/重生成/删除）改用 `Tooltip` 标注、分隔用 `Separator`，论文详情页同享此改进。页面外壳 `QAPage.vue` 在 `AppPage` 的 `#actions` 槽放刷新按钮（加载时 spin），加载态用一组**结构化骨架卡**（与真实条目同构：card 外的论文/时间行 + card 内的 状态点/问题行/badge 的 `Skeleton` 块；数量取 `feedPagination.page_size`（即一页条数）而非写死，使加载前后列表高度一致、不跳动）。注意：列表/骨架的滚动容器要带 `pt`（如 `pt-2`），否则 `overflow-y-auto` 会把最上方卡片的 ring 描边裁掉。`Skeleton` 组件默认底色已从 shadcn 原版的 `bg-accent` 改为 `bg-foreground/10`——本主题把 `--accent` 定制成了蓝色（同 primary），原版骨架会变成蓝块。**分页**：feed 走后端分页（`GET /api/qa/free?page=&page_size=`，默认 20/页，返回 `{ data, pagination }`，复用 `PaginatedResponse<T>`，与论文列表一致）；`QAPage` 在 fill 布局底部固定 上一页/下一页 + "当前/总页数" 控件（`total_pages > 1` 时显示），翻页后把列表滚回顶部；轮询只重拉当前页。**性能**：模型列表（重新生成对话框用）由 `QAPage` 在页面级经 store 的 `fetchModels()` 只请求一次、通过 `store.availableModels` 共享给所有卡片——此前每张 `QAFeedPanel` 都在 `onMounted` 各发一次 `/api/config/models`，条目多时（如 200+）会产生上百个重复请求,是页面卡顿的主因。

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
- 行间公式居中显示，超宽公式封顶 100% 宽度并支持水平滚动（`.katex-display` 用 `display:flex; justify-content:safe center` + `overflow-x:auto`，子 `.katex` 为 `inline-block; flex-shrink:0`）
- 点击公式复制 LaTeX 的 hover 高亮只覆盖公式**实际渲染宽度**（行间公式不再点亮整行），超宽公式仍可左右滚动到两端

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

选中文本 → 浮动工具栏（4 色 + 两个复制按钮：内容+锚点链接 / 仅锚点链接）→ POST /api/highlights → 更新 store → 重新渲染
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

- 侧边栏 Tag 图标入口；用 `AppPage` 包裹，`#actions` 槽放「New」按钮
- **该页所有 UI 文案均为英文**（New / Visible / ID / Name / Papers / Rename / Change color / Hide·Show / Delete / toast 等）
- **shadcn `Table` 数据表格**，列顺序：可见(Visible) / ID / 名称(Name) / 论文数(Papers)（+ 末尾 `⋯` 操作控制列）。不分页、不内部滚动，默认展示全部标签，随页面滚动
  - **可见列**：`Eye` / `EyeOff` 按钮（带 `Tooltip`）切换标签在论文列表筛选栏中的可见性，默认可见
  - **ID 列**：`#id` 灰色等宽，表头可点击排序
  - **名称列**：用 `TagBadge`（传 `color`）渲染**真彩 chip**（颜色即体现在此，**不再单设颜色列**）；重命名时就地切换为 `Input`（Enter 确认 / Esc 取消），新名已存在则弹合并确认对话框；表头可点击排序
  - **论文数列**：右对齐，表头可点击排序
  - 排序：`sortKey ∈ {id, name, paper_count}`、升/降序切换，默认按名称升序
  - **操作列（`⋯` `DropdownMenu`）**：Rename / Change color（子菜单调色板）/ Hide·Show / Delete（`destructive`，确认对话框，不可撤销）——改色入口收在此处
- **工具栏**：左侧 `Input` 按名称大小写不敏感实时过滤；右侧统计「N / M visible」（可见标签数 / 总标签数）
- **行内新建**：「New」在表体顶部插入可编辑新行（名称 `Input` + 行内色块 `Popover` 选色，默认随机色），保存调用 `createTag`；空名禁用保存，重名走 409 并 `toast.error` 提示
- **反馈**：增 / 改 / 合并 / 删除成功与失败均用 `vue-sonner` `toast`
- **空态**：加载中（`Loader2`）/ 无标签（No tags yet）/ 搜索无匹配（No matching tags）三态分明

**标签 Pinia Store (`stores/tags.ts`):**

- `tags` 数组、`colorMap` 计算属性
- `fetchTags()` / `ensureLoaded()` / `refreshCache()`
- `createTag()` / `renameTag()` / `mergeTag()` / `deleteTag()` / `updateTagColor()` / `toggleVisibility()`
- `createTag()` / `renameTag()` 用裸 `fetch`（而非 `api.post/patch`），以便就地处理 409 名称冲突而不触发全局错误 toast
- 缓存策略：页面加载时请求一次，增删改后主动刷新

**标签组件:**

- `TagBadge.vue`：渲染单个标签徽章，支持 `clickable` 模式；默认中性 `secondary`，传入 `color` 时渲染该色的淡色调 chip
- `TagSelector.vue`：搜索式下拉选择器，支持选择已有标签或创建新标签

**标签管理 Internal API（`packages/backend/src/api/tags.ts`，均需登录、按 `user_id` 隔离）:**

- `GET /api/tags` — 列出当前用户标签（含 `paper_count`）
- `POST /api/tags` — 新建标签。body `{ name, color? }`；`name` 去空校验（空 → 400）；`(user_id, name)` 查重，冲突返回 `409 { error: { code: 'TAG_NAME_CONFLICT' }, target_tag }`；`color` 缺省时由后端分配随机调色板颜色（`randomTagColor()`）；成功返回 `201 { id, name, color, visible, paper_count: 0 }`；匿名 `401`
- `PATCH /api/tags/:id` — 改名 / 改色 / 改可见性（改名冲突同样 409）
- `POST /api/tags/:id/merge` — 合并到 `target_id`
- `DELETE /api/tags/:id` — 删除标签及其论文关联

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

按用户私有的、面向整篇论文的笔记。每 (用户, 论文) = **一篇 Markdown 大笔记**（单文档）。UI 文案统一用英文（Notes）。思维导图与 Walk-through 都是这篇文档的**派生视图**（由其 Markdown 标题结构推导），不再有笔记树。

### 数据模型

单表 `notes`（见 tech-stack.md）：每 (用户, 论文) 至多一行，整篇笔记就是一个 `body` 字符串；`(user_id, paper_id)` 唯一索引。无 `kind`/`parent_id`/`title`/`sort_order`、无结构化 anchor 字段（锚点写在 `body` 里，见下）。

- **惰性创建**：没有内容的论文在库中零行，首次写入时才建行。`PUT /api/papers/:id/note` upsert 整篇 body，乐观 `updated_at`（首次创建无需 `updated_at`，409 返回最新）。
- **结构来自标题**：前端 `lib/markdown-doc.ts` 把 body 解析成 heading-section 树——层级按 heading **相对深度**（最浅的标题层级即顶层，故 `#` 或 `##` 起头都可用）；每个 section 的「叶子正文」= 该标题到下一个标题之间的文本；第一个标题之前的「前言（preamble）」= 思维导图中心节点的内容。
- **按内容计数**：`store.noteCount` = 叶子正文非空的 section 数 + 前言非空（中心节点）；空文档不计数、不出现在 `/api/notes` 聚合里。
- **旧数据迁移**：`db/notes-migration.ts` 的 `migrateNotesToSingleDoc()` 在 `migrate()` 之前运行（需要旧列），把每 (用户, 论文) 的旧笔记树按 walkthrough 方式压平成一篇 Markdown（标题→按深度的 heading、正文跟随、正文内标题重定级、根 body 作前言；无编号）写入存活行、删其余行；随后 drizzle 迁移 `0017` 删旧列 + 建唯一索引。幂等（旧列没了即跳过）、转换前自动备份。

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
- 选区浮动工具栏（登录态）提供**两个复制按钮**，二者指向同一个 `paperland://paper/<id>?h=<hash>&s=<start>&e=<end>` 锚点，只是剪贴板的 Markdown 包裹形式不同：
  - **复制内容和锚点链接**（`Copy` 图标，`copyContentAndAnchorLink`）：把**整段选区还原成 Markdown** 后，再追加一个紧凑的 `[#](paperland://...)` 锚点链接（形如 `<选区 Markdown> [#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)`）。还原用 `turndown` + `turndown-plugin-gfm`（整表→GFM 管道表）；数学公式从各 KaTeX 元素的 `x-tex` annotation 还原为 `$…$`（行内）/独立成行的 `$$…$$`（行间），并用占位符在 turndown 转义后再回填，保证 LaTeX 不被破坏；选区内的高亮 `<mark>` 会被剥离。
  - **复制锚点链接**（`Link2` 图标，`copyAnchorLinkOnly`）：只复制定位链接、不带正文，且用 Markdown **图片**语法包裹——`![#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)`。`![#]` 作为「嵌入标记」（区别于会被点击拦截的 `[#]` 链接形式），其渲染为可点击/嵌入元素留作后续；当前点击拦截只处理 `a[href^="paperland://"]`。

  两者都从 `pendingAnchorUrl()` 取同一个 URL，登录态（`paperId` 存在）才显示。锚点的 `s`/`e` 仍取渲染态偏移，跳转逻辑不变。
- **PDF 目标**走嵌入式 pdf.js 查看器（见 1.4「嵌入式 pdf.js 查看器」）：`MarkdownContent` 解析出 `pdf`/`ts`/`te` 后，本页直接调 `requestPdfNavigation(...)`（`composables/usePdfNavigation.ts` 的模块级 `requestedPdfTarget` ref，仿 `requestedResultId`），跨页 `router.push('/papers/:id?pdf=...&ts=...&te=...')`；`PaperDetail.handleAnchorFromRoute` 加载后读 query 设置同一 ref。`PaperViewerPanel` 监听该 ref 自动切到「PDF 原文」Tab，`PdfViewer` 监听后滚动到该页、把 `ts/te` 偏移映射回文本层矩形并画**临时高亮**（不落库，类似块锚点的闪烁）。`ts`/`te` 是该页**文本内容的字符偏移**（pdf.js `getTextContent()` 顺序，与高亮同一偏移模型），缩放无关。
- 锚定面覆盖 `MarkdownContent` 渲染文本（Q&A 回答、摘要/FAQ、笔记自身）**与 PDF 正文页/选区**；外部翻译 iframe 不可锚定。

### 共享状态与并发模型（`stores/notes.ts`）

整篇笔记在 store 里只有**一份响应式 `body` 字符串**（单一数据源），`tree = computed(parseNoteDoc(body))` 派生 heading-section 树。所有编辑面都直接写穿这份 body，无各自的本地快照；持久化是**整篇防抖保存**（1.2s）+ 乐观 `updated_at`，409 → 重载最新并关窗 + toast。

- **模态编辑上下文**（`panelMode: 'render' | 'edit' | 'split'`）：render 时左面板只读、靠思维导图/浮窗编辑；进入 edit/split（整篇直接编辑）会**先关闭所有浮窗**（`setPanelMode` → `closeForPaper`）。
- **结构变更关窗**：思维导图的拖拽/增/删/改名都是结构性改动（`applyStructural` → 快照入 undo 栈 + 写穿 + 关闭本论文所有浮窗）；`undo()` 弹栈回退。
- **浮窗严格绑定（防覆盖兜底，design D7）**：浮窗打开时记录 ① 结构指纹 `structureKey()`（仅 heading 层级+文本+顺序，排除正文）② 本小节正文基线。每次写回前比对，任一不符即**拒绝写回 + 弹冲突提示**（保留窗内文本供拷贝）。同标签页内靠关窗已避免冲突；该绑定主要兜跨标签页/异常（重载后指纹/基线不符）。
- **浮窗只改叶子、不产生结构**：窗内输入的任何 heading 在写穿时经 `demoteHeadings` 转加粗，故浮窗永不改文档结构。

### 浮动编辑窗口（`components/notes/`）

- `stores/windows.ts`：多窗管理、z-index 栈、全局尺寸记忆（localStorage）。窗口按 `${paperId}:${sectionId ?? 'preamble'}` 唯一键——一个 section 至多一个窗（再次打开只聚焦）。
- `FloatingNoteWindow.vue`：桌面可拖拽（标题栏）+ 缩放（右下角），手机端全屏。
- `NoteEditor.vue`：编辑**单个 section 的叶子正文**（中心节点 → 编辑前言）；三显示模式（Editor / Split / Preview）；预览用 `demoteHeadings(editBody)` 渲染（所见即所存）；写穿到 `store.updateLeaf(sectionId, text)` / `store.updatePreamble(text)`，1.2s 防抖 + 失焦/Ctrl+S/关窗即提交，IME 安全；冲突时顶部红条提示。标题栏显示该 section 的标题（只读——改名是结构操作，在思维导图里做）。
- `NoteWindowHost.vue`：在 `App.vue` 挂载一次，渲染所有窗口。

### 分支思维导图（heading 派生）

`components/notes/NoteMindmap.vue` + 递归 `NoteNode.vue`：由文档 heading 结构派生的分支导图。**中心节点 = 论文（其内容是前言）**，点它编辑前言；每个 heading 是一个节点（按相对深度成树），叶子正文非空时标题后显示灰色字符数徽章 `(N)`。连线由真实 DOM 位置量出的 SVG 曲线绘制（`data-nid` 用 section id）。点节点开其叶子浮窗；拖拽改父子（落到节点 → 成其子、落到中心/空白 → 顶层）= `store.reparent` 改写 heading；增子/增兄（`window.prompt` 命名 → `addChild`/`addSibling` 插入 heading）、改名（`rename` 改 heading 文本）、删除（确认连带子节点数 → `remove`）。中心节点不可拖拽/删除/增兄。表头 Undo 回退最近一次结构改动。

### Walk-through / 文档视图（左面板，`NoteWalkthrough.vue`）

左侧面板对整篇大笔记的三模式视图（`store.panelMode`）：
- **render（默认）**：阅读型渲染——前言 + 各 section 的可点击、自动编号标题（`1.`、`1.1.`、`1.1.1.`，由 heading 层级在渲染时推导）+ 叶子正文（`MarkdownContent`，`:disable-highlights="true"`，因动态编号内容与基于内容哈希的高亮不兼容）。点标题开该 section 的浮窗。标题层级 `min(2+depth, 6)`，阅读型绝对 rem 字号（仅本视图）。
- **edit**：整篇 Markdown 文本框（`v-model` → `store.setBody`），可自由增删/重排 heading。
- **split**：编辑器 + render 并排。
- 进入 edit/split 关闭所有浮窗；任一改动（叶子/结构/整篇）都实时重渲染。无内容时显示「No notes yet」。

### 入口与归属

- 论文详情页右栏 `PaperNotesCard`：即思维导图（中心节点 = 论文 + 各 heading）；匿名显示「Sign in to take notes」。左侧查看器 `PaperViewerPanel` 的「Walk-through」Tab 即三模式文档视图（`noteCount > 0` 时出现）。
- 独立 `/notes` 页（`views/NotesPage.vue`，`requiresAuth`）：每篇论文一条（聚合 `GET /api/notes`，仅 body 非空）+ 客户端搜索（论文标题 + body），点击跳到 `/papers/:id`。
- 访问控制沿用 auth：owner-scoped 读（匿名 `{ note: null }` 200）、写 `requireUser` + 属主校验。

### 后端 API（`api/notes.ts`，owner-scoped）

`GET /api/papers/:id/note`（返回 `{ note }` 或 `{ note: null }`；匿名 200 空）、`PUT /api/papers/:id/note`（upsert 整篇 body + 乐观 `updated_at`；首次创建无需 `updated_at`，stale → 409 带最新；唯一索引冲突回读胜出者）、`GET /api/notes`（跨论文聚合，每篇一条 + `paper_title`，排除空 body；**鉴权在 handler 内联判断而非 `requireUser` preHandler**——本 fastify 版本下 preHandler 发 401 不能可靠中止 GET handler，故内联以免二次发送）。已移除旧的 tree 端点（create/move/subtree-delete/`PUT /root`）与 `ensureRoot`。

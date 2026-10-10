# Paperland 前端功能架构

## 概述

Paperland 是一个论文管理网站。核心功能包括论文管理、数据抓取服务管理、以及基于大模型的论文 Q&A。

数据库使用 SQLite。全站配置统一在 `config.yml` 中管理。

### 生产托管

前端经 `bun run build:frontend`（排队构建，见 tech-stack.md「前端构建排队」）构建到 `packages/frontend/dist/`。后端启动时检测 `dist/index.html`，存在即通过 `frontend_hosting.ts` 挂载静态文件和 GET/HEAD 页面路由回退；刷新 `/papers/:id`、`/images` 等页面返回 SPA 入口。HTML 使用 `Cache-Control: no-cache`，`/assets/` 构建资源使用一年 immutable 缓存。未知 `/api`、`/external-api`、`/image` 路径以及缺失资源返回错误，不回退到 HTML。

线上 `https://paperland.dev.mem.ac` 由 Caddy 转发到 `127.0.0.1:3000`，页面、API、图片共用入口；SSE 反代使用 `flush_interval -1`。后端由 `paperland.service` 运行，工作目录为项目根目录。开发仍使用根目录下的 `bun run dev` 和 Vite 5173；未构建前端时后端可独立提供 API。

## UI 技术栈

- **框架**：Vue 3 + Vite，状态管理 Pinia，路由 vue-router
- **样式**：Tailwind CSS v4（CSS-first 配置，`@tailwindcss/vite` 接管编译），无 `tailwind.config.js`、无 `postcss.config.js`
- **主题**：OKLCH CSS 变量定义在 `src/assets/main.css` 的 `:root` / `.dark` 块；`@theme inline { ... }` 把变量映射为 Tailwind token（`bg-background` / `text-foreground` / `bg-primary` 等）。明暗切换由 `stores/theme.ts` 驱动（见下文「主题切换（夜间模式）」），开关只在 `<html>` 上加/去 `.dark` 类，全站 token 随之生效，组件无需逐个改色
- **组件库**：[shadcn-vue](https://shadcn-vue.com) —— 通过 `bunx shadcn-vue@latest add <name>` 把组件代码下载到 `src/components/ui/`（代码即资产，可直接编辑）。底层无样式原语来自 [reka-ui](https://reka-ui.com)（前身 radix-vue）
- **图标**：`@lucide/vue`（`Github` brand 图标因商标原因被 lucide v1 下架，App.vue 用 inline SVG 替代）
- **Favicon / 品牌图标**：`packages/frontend/public/favicon.svg`（Vite 把 `public/` 原样拷到 `dist/` 根）——**主题色文档图标**（`#0069A8` = `--primary = oklch(0.5 0.134 242.749)`，竖版页面铺满画布高度/保持竖版比例不拉伸/水平居中，右上折角 dog-ear `#004F7E`，文档内 3 条**白色文字线镂空**）置于**透明背景**，与 "Papers" 的 `FileText` 母题一致；`index.html` 以 `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` 引用。颜色硬编码自 `--primary`（favicon 独立渲染、无法用 CSS 变量），**改主题色需重生成 favicon**。仅 SVG（常青浏览器 + Safari ≥16.4）；本机无 SVG→PNG 工具时未生成 `apple-touch-icon.png` 等光栅回退
- **字体**：`Noto Sans Variable`（正文）+ `Noto Sans Mono Variable`（等宽），通过 `@fontsource-variable` 加载
- **Toast 通知**：`vue-sonner`（`<Toaster>` 在 `App.vue` 根挂一次；调用 `import { toast } from 'vue-sonner'` 触发）；项目内通过 `lib/error-bus.ts` 的 `dispatchApiError` 包装

### 组件迁移约定

- 所有 button / input / textarea / dialog / sheet / select / tabs / badge / card / popover / tooltip / dropdown-menu / table / alert / sonner / checkbox / label / collapsible / skeleton 都来自 `@/components/ui/*`
- 折叠 disclosure 用 `<Collapsible>` 而非 HTML `<details>`；展开状态用 reactive `openMap`（如 `Record<string, boolean>`）管理
- **`Tooltip` 必须位于某个 `TooltipProvider` 内**。`App.vue` 挂了**两处** provider：一处包桌面侧边栏 `<aside>`，一处包主内容 `<main>` 的 `<RouterView />`。页面内容（路由组件）里用 `Tooltip` 时直接用即可，无需自己再套 provider；反过来，脱离 `App.vue` 外壳单独挂载用到 `Tooltip` 的组件会抛 "must be used within `TooltipProvider`"
- 单个 `.vue` 文件中的 Tailwind utility **主要承担布局**（grid/flex/spacing/responsive），不再用 utility 模仿按钮 / 输入框 / 卡片视觉
- 颜色用语义 token：`bg-primary`、`text-muted-foreground`、`text-destructive` 等。**不**使用 `text-indigo-600`、`bg-emerald-50` 之类的具体色阶
- Tag 徽章统一用 `TagBadge`（`components/TagBadge.vue`）：默认渲染中性 `secondary` 药丸；传入 `color` prop 时渲染该标签**自身颜色的淡色调 chip**（标签色文字 + 同色半透明底/描边，亮/暗模式皆可读）。标签管理页（`/tags`）即用 `color` 渲染真彩 chip；论文列表/详情目前不传 `color`，保持中性 `secondary`。后端始终保留每标签颜色（`tags.color`，前端 `tagsStore.getTagColor`）

---

## 全局导航结构

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Paperland                                                                                │
├────────┬──────────┬──────┬─────┬───────┬────────┬───────────┬──────────┬──────────┤
│ Papers │ Research │ Tags │ Q&A │ Notes │ Images │ Extension │ Services │ Settings │
└────────┴──────────┴──────┴─────┴───────┴────────┴───────────┴──────────┴──────────┘
```

### 页面标题（浏览器标签）

每个页面根据内容设置浏览器标签标题，统一格式 `{页面标题} · Paperland`，无标题时回退为 `Paperland`。`index.html` 的静态 `<title>Paperland</title>` 仅作首屏 / 兜底。

- **静态标题**：在 `router/index.ts` 各路由的 `meta.title` 声明（与侧边栏语义一致）：Papers `/`、Research `/research`、Tags `/tags`、Q&A `/qa`、Services `/services`、Settings `/settings`；详情类路由先用占位标题（Paper Detail `/papers/:id`、Research `/research/:id`，加载后改为会话标题）。`router.afterEach` 守卫在每次导航时同步 `document.title = formatTitle(to.meta.title)`。
- **动态标题**：内容驱动的页面在视图内用 `composables/usePageTitle.ts` 的 `usePageTitle(() => …)`（基于 `@vueuse/core` 的 `useTitle`）响应式覆盖占位——论文详情用论文标题（加载前显示「Paper Detail」）。守卫先于视图执行，故占位标题在数据就绪后被组件覆盖；离开页面时视图作用域销毁停止 watcher，由目标页守卫重置标题。
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
- **双栏 / master-detail 降级**：`PaperDetail` 宽屏 split view 在 < 900px 降级为单栏。
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
- **标题图标**：默认取 `route.meta.icon`（在 `router/index.ts` 为每个管理路由声明，与侧边栏导航图标一致：Papers→FileText、Research→Telescope、Tags→Tag、Q&A→MessageSquare、Notes→NotebookPen、Services→Activity、Settings→Settings），可用 `icon` prop 覆盖。图标只在 `meta` 里定义一处，避免与侧边栏图标漂移。
- **宽度**：默认居中收窄 `mx-auto max-w-5xl`；传 `full` 则全宽、无最大宽度限制。
- **`fill` 模式**：用于自管内部滚动的页面（如 Q&A）——外层 `h-full flex flex-col`，标题头 `shrink-0` 不随滚动，内容区为 `flex-1 min-h-0 overflow-hidden`，页面内部的 `overflow-y-auto` 子元素照常滚动。非 `fill` 时页面随 `<main>` 整体滚动。
- **操作按钮**：经 `#actions` 具名插槽渲染在标题右侧（如 "Add paper"、"New research"、服务管理 "Backfill S2 data"）。

各路由归类：

- **全宽（`full`）**：论文管理 `/`（表格需要整页宽）。
- **收窄管理布局（`max-w-5xl`，即 1024px）**：`/tags`、`/qa`（`fill`）、`/notes`、`/research`、`/images`（图床画廊）、`/services`、`/settings`。
- **不使用 `AppPage`（保留自有全宽布局与 chrome）**：论文详情 `/papers/:id`、研究详情 `/research/:id`——顶部不显示管理标题栏；`PaperDetail` 的 embed / 窄屏宽度（见 embed-mode）保持不变。

- **版本 footer**：`AppPage` 两种模式都以 `components/AppVersion.vue` 结尾（normal 模式在内容之后、内容不满一屏时贴底，`fill` 模式固定在底部一行），显示 `Paperland v<version> · <hash>`，hash 链接到 GitHub 对应 commit（`unknown` 时无链接）；移动端抽屉底部也显示。值来自 Vite `define` 注入的 `__APP_VERSION__` / `__GIT_HASH__`（见 tech-stack.md「版本号」）。论文详情不显示。

> **新建管理页 checklist**：① 在 `router/index.ts` 给路由加 `meta.title`（英文，与侧边栏/标签一致）+ `meta.icon`（`@lucide/vue` 图标）；② 在 `App.vue` 加侧边栏导航项（同图标 + 英文标签）；③ 视图根用 `<AppPage>` 包裹，**不要再手写 `<h1>` 或宽度容器**——标题/图标由 `AppPage` 从 `meta` 自动渲染；画廊/看板/表格类传 `full`，自管内部滚动类传 `fill`，右上角按钮放 `#actions` 插槽。详情页除外。

> 标题「随滚动固定」（sticky header）暂未实现，仍维持滚动后标题滑出视口的现状。

---

## 一、论文管理

### 1.1 论文列表页

- **个人论文列表（Mine / All）**：论文本身全站只有一份（避免重复抓取），每个用户另有一份私有的「我的论文」列表，存于 `user_papers`（`user_id × paper_id` 关系表，`in_library=1` 即在 Mine 中；以后其它「用户 × 论文」状态也放这张表，标签分配仍在 `paper_tags`，按 `tags.user_id` 归属）。
  - 搜索栏左侧的 **Mine / All** 切换（仅登录用户，`ScopeToggle size="sm"`）：Mine（默认）= `GET /api/papers?scope=mine`，只列自己的论文；All = `scope=all`，全站论文。选择记在 localStorage `paperland_paper_scope`。匿名访问恒为 All。scope 与搜索、标签、listed 模式、排序叠加。
  - **列表响应是瘦身的**（`GET /api/papers`）：列表项**不含** `contents`（论文全文，平均每篇约 165 KB），`metadata` 只保留列表要渲染的 `citation_count` / `reference_count` / `s2_url`；完整的 `contents` 与 `metadata` 只在详情 `GET /api/papers/:id` 返回（"Copy full text" 读的是详情）。后端在 SQL 里分页（`count(*)` + `LIMIT`/`OFFSET`，同时间戳按 `id` 兜底排序），不读全文列。改前每页约 4.5 MB。
  - 列表与详情的每篇论文带 `in_library`（当前用户）。All 视图中已在列表里的显示「In my list」，否则显示「+ My list」按钮（`PUT /api/papers/:id/library`）。详情页标题右侧书签按钮可加入 / 移出（`PUT` / `DELETE /api/papers/:id/library`，幂等，需登录，未知论文 404）；移出只清 `in_library`，不删论文，也不动该用户的标签、笔记、Q&A 等数据。
  - 自动加入："Add paper"（新建或命中已有论文）、浏览器插件快捷打开、绑定用户的 External API Token 创建论文，以及在前端 "Fetch" 仅元数据论文，都会把论文加入操作者的列表。打标签、写笔记、提问等不会改变列表。
  - **初始论文**：`config.yml` 的 `library.starter_arxiv_id`（默认 `1706.03762`，Attention Is All You Need，空字符串关闭）。启动时若 `papers` 为空，自动 ingest 这篇并加入所有用户的列表；新建用户（管理员创建或首次启动的 bootstrap admin）自动获得这一篇（`services/user_library.ts`）。
  - Mine 为空时提示可切到 All 添加。
- 展示论文（按上面的 scope）
- 每条记录显示：标题、标签（彩色徽章）、作者、来源（link）、引用指标（Cited / Refs）、日期
  - **标签列**：使用 `TagBadge` 组件（`components/TagBadge.vue`）渲染中性 `secondary` 圆角徽章（此处不传 `color`，真彩 chip 仅用于标签管理页）
  - **引用指标列**：两个独立列 `Cited` / `Refs`，各用 `CountCell` 组件（`components/CountCell.vue`）渲染一个数字。`Cited`（被引用数）取 `metadata.citation_count`，`Refs`（引用数）取 `metadata.reference_count`（旧数据缺 `reference_count` 时由后端用 references 数组长度补上）。已知值（含 `0`）用 `toLocaleString()` 千分位显示，未富化时显示中性占位符 `–`（区分「未知」与「确为 0」）。两列均 `hidden md:table-cell`（窄屏隐藏）
  - **来源列**：使用 `SourceTag` 组件（`components/SourceTag.vue`），根据 `arxiv_id` 与 `link` 显示可点击的来源标签
    - arXiv 论文：只要 `arxiv_id` 存在就显示红色标签，格式 `arxiv:{id}`，链接由 id 派生（`arxiv.org/abs/{id}`），**不依赖** `link` 字段（经 S2 解析出 `arxiv_id` 的论文 `link` 可能为空）
    - 其他来源：若 `link` 为非 arXiv 链接则额外显示灰色标签，显示域名（如 `mem.ac`），点击跳转原始链接
    - 无来源：显示 `-`
- **搜索**：按 title 和 abstract（arxiv 抓取的摘要字段）进行模糊匹配
- **标签筛选**：支持按标签过滤论文（多标签 AND 逻辑），筛选状态反映在 URL query `?tags=1,2`。筛选栏仅显示 `visible=true` 的标签，隐藏标签可通过标签管理页面切换可见性
- **排序**：支持按 "Date added" (`created_at`) 和 "Last modified" (`updated_at`) 排序，通过搜索栏旁的下拉菜单切换。日期列标题和内容随排序模式动态变化。
- **修改时间追踪**：论文的 `updated_at` 字段在以下操作时自动更新：Free QA 提问、Template QA 触发/重新生成、QA 重新生成、高亮标注创建/编辑/删除。
- **分页**：支持分页浏览，每页条数可配置

### 1.2 添加论文（三种方式）

#### 方式一：通过 arxiv_id 创建

- 用户输入 arxiv_id
- 系统查找是否已有匹配论文
  - 已存在 → 绑定（补充缺失 id）
  - 不存在 → 创建新记录
- 自动触发依赖 arxiv_id 的 fetch services

#### Extension 页面（`/extension`）

- 侧边栏 **Extension**（`Puzzle` 图标，位于 Images 之后，需登录），`views/ExtensionPage.vue`，使用 `AppPage`。
- 内容：下载按钮（普通 `<a href download>` 指向 `GET /api/extension/download?base_url=<window.location.origin>`，同源请求携带会话 cookie）、Chrome/Edge 与 Firefox 安装步骤（Tabs）、使用方式与支持站点、Site URL + Token（复制 / 重新生成，与 Settings 页 Browser Extension 卡片中的是同一个 token）。
- `base_url` 用浏览器看到的 origin，而不是后端推断的地址，这样在 Caddy 反代和 Vite 代理下都正确。

#### 快捷打开：浏览器插件 / `/open/arxiv/:arxiv_id`

- 路由 `/open/arxiv/:arxiv_id(.*)?token=<token>`（`views/OpenArxiv.vue`，`(.*)` 让旧式 id `hep-th/9901001` 保持为一个参数）。浏览器插件（`packages/browser-extension/`，见 `docs/browser-extension.md`）在 arxiv / Hugging Face / alphaXiv 页面一键打开该路径。
- 页面调用 `POST /api/papers/open-arxiv { arxiv_id, token }`：不存在则创建（与方式一相同的 ingest 流程，自动触发服务）、存在则复用，随后 `router.replace` 到 `/papers/:id`，带 token 的 URL 不留在历史记录中。
- 路由**不**设置 `requiresAuth`（守卫会跳回 `/` 丢失目标）；未登录时 App 显示整页登录页（登录墙），登录成功后路由原样渲染、自动继续。token 无效 / id 无效时在页面内显示错误和返回列表链接，不创建论文。
- token 是每用户的 CSRF token：仅凭 token 无法操作（还需会话 cookie），用于防止第三方页面用链接诱导已登录用户创建论文。在 **Settings → Browser Extension** 查看站点地址与 token（复制 / 重新生成）。
- 生产托管：`frontend_hosting.ts` 对 `/open/` 前缀豁免「带扩展名即视为静态文件」规则（`2401.12345` 看起来像扩展名），保证该路径返回 SPA 入口。

#### 方式二：通过 Semantic Scholar 标识创建

- 添加对话框的「Semantic Scholar」标签页只有一个输入框，接受 Corpus ID（`123` / `CorpusId:123`）、40 位 S2 paper ID 或 semanticscholar.org 论文链接；`lib/s2-input.ts` 的 `parseS2Input` 把它路由为 `corpus_id` 或 `s2_paper_id` 提交（无法识别时就地提示并禁用 "Add"，后端 `utils/s2_ids.ts` 再次校验）
- 系统依次按 arxiv_id → corpus_id → s2_paper_id 查找已有论文
- 系统查找是否已有匹配论文
  - 已存在 → 绑定（补充缺失 id）
  - 不存在 → 创建新记录
- `semantic_scholar_service` 先用 S2 反查 arxiv_id（及 corpus_id / s2_paper_id）：查到 arxiv_id 则走原 arXiv 元数据/PDF 链；没有 arXiv 版本时由 `s2_pdf_service` 尝试下载开放获取 PDF

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

- **Title**：文本输入框（arXiv 论文禁用）
- **Authors**：逗号分隔的文本输入框（arXiv 论文禁用）
- **Source URL**：文本输入框（所有论文均可编辑）
- **Content (user input)**：等宽字体 (`font-mono`) 的多行文本框，编辑 `contents.user_input` 字段

arXiv 导入的论文标题和作者字段显示为禁用状态（灰色背景），后端也会拒绝修改。

编辑完成后点击 "Save"，仅发送有变更的字段（PATCH 语义），点击 "Cancel" 丢弃所有修改。

#### 标签编辑

标签区域标题旁有编辑按钮（铅笔图标），点击进入标签编辑模式：

- 使用 `TagSelector` 组件，预填当前论文标签
- 支持搜索已有标签、创建新标签、移除已选标签
- 保存调用 `PUT /api/papers/:id/tags` 全量替换
- 保存后自动刷新论文详情和标签颜色缓存
- 无标签时显示 "+ Add tag" 按钮直接进入编辑模式
- 宽屏 split view 和窄屏 single column 两处均支持编辑

#### 参考链接

信息卡片中（标签区块下方）有 "Reference links" 区块（`components/ReferenceLinksSection.vue`），用于挂载论文之外的外部资源（博客解读、项目主页、讨论帖等）。**按 用户×论文 归属、用户可选共享**（受属主 `reference_links` 共享开关控制，匿名只读返回空）。区块标题右侧有 Mine / All 切换（`localStorage` 记忆，默认 Mine）；All 中别人的链接显示属主用户名（admin 看未共享的带 Private 标记），且不显示编辑/删除按钮。

- 每条链接**只有 `url` 必填**；`description`（描述）由后端爬取链接页 `<title>` 自动生成，形如 `${document.title} (${hostname})`（例：`Build software better, together (github.com)`），**用户不可手动编辑**；`title` 为可选字段，仅保留给历史数据 / 显示回退
- **显示标签按回退链 `title → description → url` 解析**：有 `title` 用 `title`（历史数据），否则用自动 `description`，再否则用原始 `url`。链接渲染为超链接，`target="_blank" rel="noopener noreferrer"` 新标签页打开；当 `title` 与 `description` 同时存在时，`description` 作为次要灰字显示在标题下方
- 列表按添加顺序（`created_at` 升序）展示
- **管理控件（「+」添加；编辑、删除仅自己的链接）仅对已登录用户显示**（`useAuthStore().isAuthenticated` 门控；匿名用户看不到任何增删改入口）；编辑/删除按钮常驻显示（hover 加深），删除前用 `window.confirm` 弹窗二次确认
- 内联表单只有一个 URL 输入：用户输入合法 http(s) 链接后，前端 debounce（~500ms，回车/保存前也会触发）调用 `referenceLinksApi.preview(url)` 自动拉取描述，期间显示加载态，结果作为只读次要文字预览；保存提交 `{ url, description }`（不含 title），增删改后就地刷新，不整页刷新
- 组件自取自管（`referenceLinksApi`：`getForPaper` / `preview` / `create` / `update` / `remove`），无需 Pinia store；宽屏 split view 与窄屏 single column 两处均渲染
- 后端 `GET /api/papers/:id/reference-links?scope=mine|all`（返回 `username`/`shared`）、`POST /api/papers/:id/reference-links`、`GET /api/reference-links/preview?url=…`、`PATCH|DELETE /api/reference-links/:id`，写操作与 preview 均经 `requireUser`（preview 同时只放行登录用户，避免成为开放抓取代理）+ owner 校验，`url` 仅放行 http/https
- preview 端点服务端抓取链接页 `<title>`：超时 / 最大字节数 / User-Agent 由 `config.yml` 的 `reference_links` 配置块控制；抓取失败（超时、非 2xx、无 `<title>`）不报错而是返回 `description: null`，链接仍可仅凭 url 保存（显示回退到 url）

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
│  │  - 幻觉翻译 (hjfy.top)│  │  ┌── Preset Q&A ──────────────┐   │
│  │                       │  │  │  模板提问结果...                │   │
│  │  Tab 切换查看模式       │  │  └────────────────────────────────┘   │
│  │                       │  │  ┌── User Q&A ───────────────────┐   │
│  │                       │  │  │  自由提问历史记录...             │   │
│  │                       │  │  └────────────────────────────────┘   │
│  │                       │  │  (右上角 "Ask" 入口→按需浮动面板)     │
│  └───────────────────────┘  │                                       │
└─────────────────────────────┴───────────────────────────────────────┘
```

#### 摘要中英双语（BilingualText）

信息区的 "Abstract" 继续由 `components/BilingualText.vue` 负责英文原文、登录门禁、cache peek、Translate、Hide/Show 与 Re-translate。未缓存文本不会因摘要渲染自动消耗模型；仅登录用户点击 Translate 后才挂载 `StreamingTranslationText`。peek 命中时也会挂载子组件，但流接口直接走缓存、不会调用 provider。

`components/StreamingTranslationText.vue` 是样式透明的流式叶子组件：以非空 `text` 创建即调用 `POST /api/translate/stream`，按 delta 增长文本，以 done 的 `translated_text` 做最终权威值；text/force 变化、unmount 会 AbortController 取消，generation token 防止旧响应覆盖新状态。Codex 的几个 sentence-sized delta 可能在几十毫秒内连续到达，Vue 会把同一轮同步 ref 更新合并成一次绘制；因此组件会在**完整追加每个真实 delta 后 await 一次 `requestAnimationFrame`**，让浏览器在持续接收期间定期重绘，再继续处理下一 delta。它不拆字符、不限制输出速率、不 sleep；done 会自然等待当前 async callback。缓存命中或 `stream:false` 没有 delta，直接显示 done，不伪造流式。默认用 `as` 决定实际 HTML 文本元素，并把父级 class/style/ARIA/普通 attrs 直接透传，不添加产品字体/颜色/间距、不渲染 Markdown；也可用 scoped slot `{ text, status, cached, error }` 完全控制 markup。

隐藏测试路由 `/translation-test` 使用 `AppPage`，提供 draft/submit 分离输入、force、start/re-run、cancel/reset 与实时状态面板，通过 scoped slot 演示外部样式。路由 `requiresAdmin:true`，匿名和普通用户由既有 router guard 阻止；它刻意不加入桌面/移动侧边栏。

#### 多模式查看器（PaperViewerPanel）

左侧面板支持多种查看模式，通过顶部 Tab 栏切换：

| 模式 | 条件 | 内容 |
|------|------|------|
| PDF | **始终可用** | 有 `pdf_path` 时为嵌入式 **pdf.js** 查看器（PdfViewer 组件，见下方「嵌入式 pdf.js 查看器」）；没有时渲染 `PdfUploadPanel`（见下方「PDF 缺失与用户上传」） |
| Bilingual PDF | 论文有 `pdf_path` 且 doc2x 启用 | `Doc2xTranslationTab`：顶部显示 doc2x 精确解析状态（未开始/失败时可 "Start parse"）；未翻译显示 "Start translation"，排队（等解析）/进行中/失败（可重试）各有状态；完成后用 `PdfViewer`（`paper-id=null`，不生成锚点）显示，可在 "Side by side"（doc2x 拼页 PDF）与 "Translation only"（后端裁出的右半页 PDF，页数相同）间切换，选择记在 `localStorage['paperland.doc2x.view']` |
| hjfy.top | 论文有 `arxiv_id` | 嵌入 `https://hjfy.top/arxiv/{arxiv_id}` iframe |
| Note | **始终可用**（空笔记/匿名时渲染空状态） | 整篇大笔记的三模式文档视图（render / edit / split，见下方「Note / 文档视图」）；从论文列表 note 列点进来（`?view=note`）会自动选中此 Tab |

- 默认选中第一个可用的**主查看器**（PDF / hjfy.top），Note 永不作为自动默认——除非它是唯一可用模式（论文既无 `pdf_path` 也无 `arxiv_id`）。这是因为 Note Tab **始终可用**，而面板在 paper 数据（`pdf_path`/`arxiv_id`）加载前就挂载了：若按「第一个可用模式」选，加载窗口期只有 Note 可用就会被选中，且加载完成后 Note 仍有效便不会切走。故默认逻辑用 `pickDefault()` 跳过 Note，并在主模式后到时重新选中它
- 用户的**显式选择**（点击 Tab，或 `?view=note`/`?note=`/`?pdf=` 深链）会置 `userChose` 标志，此后 available 模式集变化不再覆盖该选择（仅当所选模式消失才重选）
- 无可用模式时显示占位提示
- 模式系统可扩展：添加新模式只需在 modes 数组中增加条目
- Note Tab 始终可用（`available: true`），内容是当前论文那篇单文档笔记（空笔记/匿名时渲染空状态），由始终挂载的 `PaperNotesCard` 负责拉取
- "Bilingual PDF" 排在 "PDF" 之后，`pickDefault()` 因此永远先选 PDF，不会自动默认到它
- doc2x 状态由 `stores/doc2x.ts` 统一维护：`PaperDetail` 在加载论文时 `load(paperId)`、卸载时 `release()`；它请求 `GET /api/papers/:id/doc2x`，在解析/翻译进行中（或机械解析尚未产出）时每 5 秒轮询，供 "Bilingual PDF" tab 与 "Copy full text" 按钮共用
- `PaperViewerPanel` 还监听 `usePdfNavigation` 的 `requestedPdfTarget`：一旦有 PDF 锚点跳转请求且 PDF 可用，自动把 active Tab 切到 "PDF"（并置 `userChose`）

#### PDF 缺失与用户上传（PdfUploadPanel）

闭源论文照常添加并抓取能抓到的信息（S2 元数据、引用等），但拿不到 PDF；此时左侧 "PDF" Tab 显示 `PdfUploadPanel`，由 `GET /api/papers/:id` 派生的两个字段驱动（`utils/pdf_status.ts`，只在详情接口返回）：

| `pdf_status` | 条件 | 面板 |
|---|---|---|
| `available` | 有 `pdf_path` | 不显示面板，直接 PdfViewer |
| `fetching` | `arxiv_pdf_service` / `s2_pdf_service` 最近一次执行 pending/running，或无 arxiv_id 论文的 `semantic_scholar_service` 正在跑 | "Fetching PDF…"，每 5 秒 `store.refreshCurrentPaper()` 轮询直到状态变化 |
| `upload_required` | 其他情况 | "PDF needed" + 原因 + 选择文件按钮 / 拖放上传 |

`pdf_unavailable_reason`：`download_failed`（最近一次 PDF 下载服务 failed）> `closed_access`（metadata 有 `open_access_pdf_status` 但无 `open_access_pdf_url`）> `not_found`。

- 上传走 `POST /api/papers/:id/pdf`（需登录，原始 `application/pdf` body，`api.upload()`），后端校验 `%PDF` 头与 `config.yml` 的 `pdf_upload.max_file_size_mb`（默认 100，超出 413），存为 `data/pdfs/upload_<id>_<sha256 前 8 位>.pdf`（内容哈希命名，避开 `/api/files` 的 24h 缓存），条件写入 `pdf_path`（已有 PDF → 409 `PDF_EXISTS`；非 PDF → 422 `INVALID_PDF`），随后 `triggerForPaper` 让 pdf_parse / doc2x 等自动接上
- `store.uploadPdf()` 用响应替换 `currentPaper`，`pdf_path` 出现后面板即被 PdfViewer 取代，无需刷新页面
- 匿名用户只看到原因与 "Log in to upload a PDF"；不支持替换已有 PDF

#### 嵌入式 pdf.js 查看器（PdfViewer）

不再用浏览器原生 PDF 插件（`<iframe type="application/pdf">`），改为用 **pdfjs-dist** 自建轻量查看器，从而可编程跳页、读当前页、在页面上画高亮——这是支持 `paperland://…?pdf=…` 页面/选区锚点的前提。

- **加载**：`lib/pdfjs.ts` 的 `loadPdfjs()` 动态 `import('pdfjs-dist')`（被 Vite code-split 成独立 chunk，只有打开 PDF Tab 才拉取），worker 以 `pdf.worker.min.mjs?url` 注册到 `GlobalWorkerOptions.workerSrc`。`pdfjs-dist` 版本在 package.json 中**精确 pin**——`ts/te` 是 pdf.js 提取文本的字符偏移，需跨部署版本稳定。
- **渲染**：连续纵向滚动，每页一个按宽高比预留的占位 `.pdf-page`；`IntersectionObserver`（`rootMargin 200%`）在临近视口时把该页渲染到 canvas（HiDPI 用 `transform:[dpr,…]`）+ pdf.js 文本层（透明、可原生选中），远离视口时卸载 canvas 以省内存。
- **主题感知渲染（夜间模式）**：读 `stores/theme.ts` 的 `resolved`，夜间时给 `page.render({ pageColors })` 传 pdf.js **原生** `pageColors`（灰底 `#3a3a3a` / 近白字 `#e8e8e8`，与 `.pdf-page` 的 `.dark` 背景一致），由 pdf.js 在栅格内重新着色——比 CSS `invert()` 更准（可独立设灰底/白字），且选区高亮、`pdf-region-flash` 在 canvas 之上、仍走 UI token 不被反色。`pageColors` 烤进 canvas 无法原地变色，故 `watch(theme.resolved)` 在主题切换时对当前已渲染（可见/邻近）页用新配色重渲染（`rendered`/`renderTasks` 项带 `dark` 标记，使「同尺度已渲染」判断在仅主题变化时也重渲染），离屏页滚动到时再渲染。pdf.js 无现成「夜间模式」开关，`pageColors`（原为高对比/forced-colors 设计）是其支持的着色原语。
- **无白闪渲染**：pdf.js 在每次 render **开始**时把 canvas 填白（`background || "#ffffff"`），夜间的 `pageColors`（HCM 滤镜）要到 render **结束**才套上。若 canvas 先挂进 DOM 再渲染，浏览器会画出「白底→黑字→暗色滤镜」的中间帧 → 闪白。故每页渲染到**离屏新建 canvas**，待 `renderTask.promise` 完成（已是暗色）后再 `appendChild`/`replaceWith` 换入；旧 canvas 保留到换入瞬间。这样首帧即暗色不闪白，主题切换/缩放重栅格期间也不空屏不闪。
- **当前页 / 跳转 / 缩放 / 适配模式**：滚动时按页矩形与视口中线判定「当前页」；工具栏含 上/下一页、页码跳转输入、缩放、**适配模式切换**（宽度铺满 ↔ 高度铺满，`MoveHorizontal`/`MoveVertical` 图标，**仅当前打开有效、不记忆**，默认宽度铺满；切换会把 zoom 重置为 1 使适配精确）。`effectiveScale = fitScale × zoom`，`fitScale` 由 `fitMode` 取「容器宽 / 首页宽」或「容器高 / 首页高」；缩放/适配后 canvas + 文本层按新尺度重渲染并保持对齐。
- **文本层对齐（选区不漂移）**：pdf.js 5.x 的 `TextLayer` 用 CSS 变量 `--total-scale-factor` 计算每个 span 的 `font-size` 与文本层宽高（`--scale-round-x/y` 用于取整）；官方查看器在每页上设置它，我们自绘页面必须自己设。`pageStyle()` 在每个 `.pdf-page` 上把 `--total-scale-factor` 绑定到实时 `effectiveScale`（`--scale-round-x/y: 1px`）。缺失时 span 字号无效而回退为继承字号，选区会横向越拉越偏、上下串行（历史 bug，旧代码只设了老变量名 `--scale-factor`）。由于绑定的是实时尺度，缩放/拖动分屏的去抖窗口内文本层也随 CSS 缩放的 canvas 同步缩放，选区依旧对齐。
- **拖动分屏不卡**：宽度变化时只即时缩放占位页与 CSS 填充的 canvas，昂贵的重栅格化（canvas + 文本层）去抖 ~320ms（`RE_RASTER_DEBOUNCE_MS`），待尺度真正稳定后只做一次；期间页面保持 CSS 缩放（略软）直到落定（高度铺满模式下拖动分屏宽度不改变 `fitScale`，更不触发重渲染）。
- **选区 → 链接**：文本层支持原生选区；落定后用 `getSelectionOffsets`（复用 `useHighlight`）算出该页 `ts/te` 偏移，在选区下方弹出浮动选区工具栏（`.pdf-sel-toolbar`，样式对齐 Markdown 划线高亮工具栏）：登录用户有 "Translate" 按钮，登录且有 `paperId` 时有 "Ask"、"Add to question"（见下文「上下文提问」），有 `paperId` 时有 "Copy selection link"。选区跨页时（段落被分页打断）按页用 `getRangeOffsets` 在各页文本层上裁出子 Range 分别求偏移，snapshot 带 `segments: [{page,ts,te,text}]`；跨页选区只显示 "Ask"、"Add to question"，翻译和复制链接仍只支持单页，后者复制 `<选区文本> [#](paperland://paper/<id>?pdf=<page>&ts=<ts>&te=<te>)`；工具栏 "Copy page link" 复制 `[PDF p.N](paperland://paper/<id>?pdf=N)`。
- **选区 → 按需流式翻译**：不再自动翻译（旧的 500ms stable-intent 已移除）。选区捕获约 60ms 落定后只显示工具栏；登录用户点击工具栏 "Translate" 才对当前 page/`ts`/`te`/text identity 挂载 `StreamingTranslationText` 调 `/api/translate/stream`（同一 identity 已打开时再次点击为 no-op）。浮层优先居中放在选区上方，空间不足时放到下方并为工具栏预留位置；宽度/x/y 都 clamp 在 viewer 内，内容增长由 ResizeObserver 重算。请求开始但尚无译文时，结果区直接显示原文，不显示“加载翻译”类占位文字；首个非空 delta 或 cache result 到达后，真实译文立即替换原文预览。每个真实 delta 整段追加后让出一帧，cache hit 直接完成。面板与工具栏内的 pointer interaction 拥有其引发的临时 selection collapse：浮层/source snapshot 保留并在 pointer-up 尝试恢复 Range；普通外部点击才关闭。选中不同的有效选区会立即 abort 旧请求并关闭旧浮层，新选区只显示工具栏。scroll Range 失效、zoom/theme text-layer 重渲染、PDF 切换、截图模式、Escape 或卸载会关闭工具栏/abort 请求/关闭浮层，late event 不得覆盖新选区；scroll 保持 Range 有效时按 rAF 重定位。匿名用户不显示 "Translate" 按钮、不调用 API、不弹登录。
- **跳转 + 高亮**：监听 `requestedPdfTarget`，`{page}` 滚动到该页；`{page,ts,te}` 先确保该页渲染，再用 `buildTextSegments` 把偏移映射为 `Range.getClientRects()`，在页面上叠加临时高亮 div（`pdf-region-flash`，2.2s 淡出，不落库）并滚动到选区中心；`{page,rect}` 则把归一化 `[0,1]` 矩形直接换算到页面像素框画同款临时高亮（`highlightRect`）。`rect` 优先于 `ts/te`；偏移越界 / 矩形非法则退化为仅跳页 + toast 提示。
- **失败兜底**：pdf.js 加载/解析失败时显示错误态并给出原始文件链接 `/api/files/<pdf_path>`；无 `pdf_path` 时保留 "No PDF yet" 占位。
- **PDF 高亮（按用户，持久化）**：复用 `highlights` 表与 `/api/highlights`（后端零改动）：`pathname = /papers/<id>`（PaperDetail 已把它加载进 `stores/highlights.ts`），`content_hash = pdf:<pdf.js 指纹 fingerprints[0]>:<页码>`，`start_offset/end_offset` 即该页文本层的 `ts/te`。指纹把偏移绑定到具体文件，PDF 被替换后旧高亮不再绘制；Markdown 块的 hash 从不以 `pdf:` 开头，互不干扰。每个已渲染页在 canvas 之上、文本层之下有一层 `.pdf-hl-layer`（`pointer-events:none`），用 `offsetsToRects` 算矩形并按页面百分比定位，故缩放/CSS 缩放期间保持对齐；页面重渲染完成和高亮列表/范围变化时重建。自己的高亮为实心填充，他人的为虚线下划线（配色与 `MarkdownContent` 的 `.hl-*`/`.hl-foreign-*` 一致），悬停时滚动区 `title` 显示主人名（命中测试，因覆盖层不接收指针）。选区工具栏对登录用户的单页选区显示 4 个颜色圆点：新建高亮；若选区与自己的某条高亮完全相同（同页同 `ts/te`），则改色并显示删除。**点击高亮**（无拖拽、非截图模式，重叠时取最新一条）会用 `offsetsToRange` 把该段设为原生选区，于是复用常规选区工具栏的翻译/提问/加入提问框/复制链接。工具栏的 `HighlightScopeToggle`（Mine/All）与 Markdown/QA 高亮共用同一设置。
- **框选截图 → 图床**：工具栏 `Crop` 图标进入截图模式（仅在传入 `paperId` 时显示，激活态高亮）。模式下滚动区 `cursor:crosshair`、文本层 `pointer-events:none` + `user-select:none`，从而拖拽画出橡皮筋矩形而非选中文字（`mousedown`→`mousemove`→`mouseup`，`Esc` 或再次点击取消）。松手后把该矩形钳制到所在 `.pdf-page`、归一化为 `{page,x,y,w,h}`，该区域保持高亮（`.pdf-capture-sel`，以百分比定位在所属 `.pdf-page` 内，随页面滚动/缩放），并在其正下方居中弹出操作菜单（`.pdf-capture-menu`，是高亮框的子元素；在菜单上按下鼠标不会开始新的拖拽）："Copy image link" / "Copy Markdown" / "Add to question" / "Ask about screenshot"（后两项仅登录用户，见下文「上下文提问」），`Esc`、点 ×、开始新的拖拽或退出截图模式都会丢弃这次截图（不上传）并清除高亮；上传进行中高亮与菜单保留（按钮禁用），上传失败也保留以便重试，成功后清除。两个复制项都先调 `cropRegionToImage(region, dpi)` 渲成 PNG，经 `utils/uploadImage` 上传图床；"Copy image link" 只写入图床 URL，"Copy Markdown" 写入 `[![](<image_url>)](paperland://paper/<id>?pdf=<page>&rx=&ry=&rw=&rh=)`（坐标保留 4 位小数）并 toast 提示；上传期间 `capturing` 置位、忽略后续拖拽。
- **DPI 可配置（不硬编码）**：`cropRegionToImage(region, dpi)` 按 `scale = dpi/72` **只渲染选区**（平移 transform `[1,0,0,-sx,-sy]`，避免高 DPI 下整页栅格化）。默认 DPI 来自 `config.yml` 的 `pdf_viewer.screenshot_dpi`，挂载时经 `GET /api/config/pdf`（`configApi.pdf()`）拉取存入 `screenshotDpi` ref，请求失败回退 300。

#### 窄屏布局

单栏布局（<900px）下，左侧查看器面板隐藏，仅显示论文信息和 Q&A 内容。

#### doc2x 提问确认 + 复制全文

- **提问确认**：`stores/qa.ts` 的提问入口（`triggerAllTemplates` / `regenerateTemplate` / `submitFreeQuestion`（含 PDF 直接提问 `askDirect`）/ `regenerateEntry`）先调 `confirmDoc2xIfNeeded(paperId)`：取 `GET /api/papers/:id/doc2x`，若 `qa_needs_confirm`（doc2x 已启用、有 PDF、无 user_input 且 doc2x 解析未完成）就 `window.confirm` 提醒 "The doc2x parse isn't finished, so this answer will use the basic text extraction (formulas and tables may be inaccurate). Ask anyway?"，取消则不发请求（`QAInput` 保留已输入的问题）。同一论文的并发调用（模板对多个模型循环重新生成）共享一次确认。doc2x 解析完成后不再提示——后端 `content_priority` 为 `[user_input, doc2x_parsed, pdf_parsed]` 且在每次运行时取文本，重新提问/重新生成会**静默**改用 doc2x 文本。
- **复制全文**：`PaperFullTextCopy` 在详情信息卡（宽/窄两套布局）"Reference links" 之前显示 "Copy full text (basic parse)"、"Copy full text (doc2x)" 两个按钮，分别复制 `contents.pdf_parsed` / `contents.doc2x_parsed`；对应文本存在（已加载的论文或 doc2x 状态的 `text_sources`）之前按钮禁用。页面打开期间解析完成，轮询到的状态会让按钮变可用，点击时再拉取最新论文内容。

#### 上下文提问（选段 / 截图 / 追问）

QA 统一为「system prompt + 有序 inputs + 问题」：inputs 可以是 PDF 选段、框选截图（必须先上传到本服务图床，按 `image_hash` 引用）、对话历史（只引用父回答 id）。普通提问就是没有 inputs 的特例。

- **直接提问**（`PdfViewer`）：选区工具栏 "Ask" 或截图菜单 "Ask about screenshot" → `qaStore.askDirect(paperId, input)` → `POST /api/papers/:id/qa/free` 带 `direct_ask: true`。后端把问题定为 `@Quote1 <qa_prompt.direct_ask.question>`，只用 `models.default`。提问前同样走 doc2x 确认。回答在选区/截图旁的浮层 `.pdf-ask-panel` 里流式显示（浮层读 `qaStore.qaData.free` 中对应 entry，由 store 的 SSE 实时更新；完成后用 `MarkdownContent qa-answer`），底部有 "Show in list"（`revealQAEntry`）和 "Follow up"（默认接续最近一次已完成的回答，`defaultFollowupResult`）。与翻译浮层互斥。
- **加入提问框**：选区 "Add to question" 或截图菜单 "Add to question" → `useQAComposer().addAttachment(input)`：按类别续号（`Quote1`、`Image2`…，追问时从祖先链已用的最大编号往后数），在输入框光标处插入 `@Quote1 ` 并请求打开提问面板（`PaperDetail` 监听 `composer.openRequests` 调 `openQA()`）。
- **提问框 composer（`composables/useQAComposer.ts`）**：模块级单例，保存问题文本、附件（已带标号）、追问目标（父 result/entry + 祖先链 inputs）。草稿按「用户 + 论文」存 `localStorage`（`paperland_qa_draft_<user>_<paper>`，读写 try/catch），刷新后恢复，提交成功后清空；附件不限数量。移除附件时其他标号不重排，并删掉问题里该附件的 token。
- **`QAInput` 面板**：顶部行下依次是追问提示条（"Following up on QA-12 · <model> · <question>"，× 取消追问）、附件栏（类别图标 + `@标号` + 摘要/缩略图 + 页码，跨页显示 `p.3–4`，可移除）、输入框。输入 `@` 弹出补全菜单，列出祖先链和本轮的全部可引用输入（↑↓ 选择、Enter/Tab 插入）。整条链有图片时，所选模型都必须 `vision: true`（来自 `/api/config/models`），否则禁用提交并提示。论文没有可用全文（`lib/qa-content.ts` 的 `paperHasQAContent`）时提交和 PDF 提问入口都置灰并提示。
- **追问**：每个回答下的 `MessagesSquare` 按钮（只有 done 的回答可用）、回答里模型给出的 `[💬 …](#moonlight)` 链接（`MarkdownContent` 以 `qa-answer` 渲染时拦截，预填问题）都会调 `composer.startFollowup(...)`；它先取 `GET /api/qa/entries/:id/tree` 收集祖先链 inputs 供 `@` 菜单使用。`/qa` 页没有提问框，追问跳到论文页 `?qa=<entry>&result=<id>&followup=1[&fq=<预填>]`，由 `PaperDetail.handleAnchorFromRoute` 打开。
- **列表展示**：`QAList`/`QAFeedPanel` 折叠标题栏用 `QAInputSummary` 只显示 inputs 类别图标 + 数量（选段 `TextQuote`、截图 `Image`、历史 `MessagesSquare`），不展开内容；标题栏的 `QA-<id>` 点击复制 `[QA-<id>](paperland://paper/<pid>?qa=<id>)`；`QAList` 的折叠标题栏不再显示模型名/回答数 badge，`QA-<id>` 放在最右侧；追问展开后有 "Follow-up to QA-x"，父回答不可见/已删除时只 toast "This Q&A isn't visible" / "This Q&A was deleted"。
- **回答操作**：`QAResultBody` 新增 "Follow up"、"Copy answer link"（`[QA-<id> · 模型](paperland://paper/<pid>?qa=<id>&result=<rid>)`）、"View model input"（`QAModelInputDialog`，打开时才请求 `GET /api/qa/results/:id/model-input`，显示按当前配置重建的 system prompt、全文摘要（来源 + 字符数，不展开全文）、references、inputs（截图缩略图）、history、question）。
- **Agent 画的图**：Codex 回答（QA 与 Deep Research 报告）里可能出现 `![caption](/image/YYYY/MM/DD/<hash>.png)`——模型用内置画图生成后经 MCP `upload_image` 存进图床（见 tech-stack.md「Agent 画图」）。前端无需改动：`MarkdownContent` 照常把它渲染成 `<img>`，和用户上传的截图走同一个 `/image/*` 路由。
- **引用链接**：`MarkdownContent` 的 `qa-answer` 模式把 `#cite:<id>`（40 位 S2 paperId，或纯数字 CorpusId）统一经 `useS2Paper` 走 `POST /api/s2/papers/resolve` 解析，**不依赖回答所属的论文**（不再读取本论文参考文献）；解析为 `resolved` 时换成引用标签 `.qa-cite-chip`（文字不变，不影响高亮偏移），悬停/点击弹出卡片（标题、作者、年份、venue、Semantic Scholar 链接，库内论文可 "Open paper"）；解析不到（`not_found` / `unavailable` / 匿名未缓存）保持纯文本 `.qa-cite-unknown`。卡片展示模型 `{title, authors, year, venue, library_paper_id}`。因此该模式可用于任何 Markdown（如 Deep Research 报告），无需 `paperId`。回答完成后后端会把回答中所有 `#cite:` id 的 S2 元数据预热进缓存表 `s2_papers`（见下方「S2 论文元数据缓存」）。
- **回答引用列表**：每个 done 且含有效 `#cite:` 的 Result 在正文下方显示默认折叠的「References · N」（`QAResultBody` 内的 `Collapsible`），只含该回答自己引用的论文（`lib/cite-links.ts` 的 `extractCiteLinks` 提取，按规范化 id 去重、按首次出现排序）；展开时才挂载 `PaperRefList`，此时才发解析请求。每行：标题（解析不到时用链接文字）、作者（前 3 位 + et al.）· 年份 · venue · 被引数，库内论文显示「In library」并链接 `/papers/:id`，所有行带 Semantic Scholar 外链；加载中 / Not found / Unavailable 各有状态。**不提供导入论文库的操作**（无一键全部导入，也无单篇加入）。
- **`PaperRefList` 组件**（可复用）：props `items?: RefItem[]` 或 `sections?: { title, description?, items, removed? }[]`。`RefItem` 为论文行 `{ id, fallback_text?, comment?, unverified?, added? }`（id 为规范化 S2 id）或链接行 `{ kind: 'link', url, citation, comment?, added? }`；comment / description 为 Markdown（qa-answer 模式渲染，可含 `#cite` chip），`removed` 渲染为段下折叠的「Removed · N」。QA 引用列表只用平铺论文形态；分段、comment、链接、版本对比标记由 Deep Research 使用（见文末「Deep Research」）。
- **前端批量解析**：`composables/useS2Papers.ts` 的 `useS2Paper(id)` 返回按 id 共享的 ref（页面会话级缓存）；同一 tick 内所有列表与 chip 请求的 id 通过 `queueMicrotask` 合并成一次 `POST /api/s2/papers/resolve`（按 200 分块）。`unavailable` 和请求失败的结果不进永久缓存，下次挂载（如登录后）会重试。
- **图床列表按上传者隔离**：`GET /api/images` 对普通用户只返回 `uploaded_by` 是自己的图片，管理员看到全部（每项带 `uploaded_by_name`，无上传者的旧图为 null）；`/images` 页对管理员在每张卡片上显示「by <上传者>」。图片 URL 仍然公开，只是列表收窄。Agent 经 MCP `upload_image` 上传的图归 token 所属用户（Codex 回合即提问者 / 会话所有者）。**已知限制（暂不处理）**：内容去重下，重新上传别人已传过的同一张图会拿到对方的那行，不会出现在自己的列表里。
- **图床不再支持删除**：`/images` 去掉删除按钮（后端也没有删除接口），每张图同时显示「被笔记引用次数」和「被 QA 引用次数」（`qa_reference_count`，统计所有 `qa_entries.inputs` 中的 image input），保证追问和重新生成时截图一直可用。
- **默认选中的回答**：`lib/qa-result-selection.ts` 对所有状态按 `created_at`（缺失回退 `completed_at`）+ id 判定最新；多模型提交时后端按模型列表逆序创建，所以排在前面的模型默认被选中。

#### 按需浮动提问面板（QAInput）+ 功能入口（PaperActionLauncher）

提问框不再常驻遮挡视野，改为**点击功能入口后才弹出的浮动面板**。面板**就是 `QAInput` 卡片本身（单层）**——不套额外窗口外壳/标题栏，外圈即卡片自身边框，避免"窗口套卡片"的双层边框。

- **功能入口（`PaperActionLauncher.vue`）**：渲染调用方（`PaperDetail`）按页面功能顺序（引用 → 笔记 → 提问）注入的有序功能项，当前仅 "Ask"（`Bot` 图标）。
  - **桌面端**（≥ md）：在论文详情页 header **右侧内联直接平铺**功能按钮（图标 + 文字），无下拉菜单。
  - **移动端**（< md）：右下角**圆形悬浮按钮（FAB）**，点击展开竖直功能列表，选中即触发并收起。
- **面板状态（`composables/useQAWindow.ts`）**：提问框是全站浮动窗口之一（`stores/windows.ts` 的 `qa-ask`），`QAInput` 用共享的 `FloatingWindow` 外壳（`bare` 外观）渲染，移动 / 缩放逻辑与笔记窗口、Q&A 树窗口同一份代码。与它们不同，**不记忆/不持久化**上次位置大小，每次 `open()`（`store.place`）用调用方按当前布局算好的默认几何覆盖。
- **默认几何（由 `PaperDetail.openQA()` 计算）**：默认放在内容区左下角，默认高 `QA_DEFAULT_HEIGHT`（约 2 行输入框）。
  - 双栏：贴左下角，宽 = 左侧（PDF）栏当前宽度（`#split-container` 实测 × `leftWidth`），`top = 容器底 − height`。
  - 单栏：贴底部，占内容区完整横向宽度（`narrowScrollRef` 实测）。
  - 移动端：`inset-0` 全屏浮层。
- **面板内布局**：顶部一行自左至右为 **提交按钮（左）→ 模型选择 → 关闭按钮（右上角）**；其下为占满整行的输入框（`rows="2"` 默认两行、`flex-1` 随面板增高填充、`resize-none` 去掉自身缩放手柄）。
- **拖动 / 缩放分工（桌面端）**：面板**右下角有缩放手柄**（对角线 SVG，`@pointerdown.stop`，改 `width/height`）；**移动**则在卡片**空白处**（非输入框 / 非按钮 / 非手柄，`onCardDown` 用 `closest(...)` 排除）按下拖动，改 `left/top`。移动端全屏，二者均不提供。
- **提交按钮**：图标 + "Submit" 文字（不再仅图标）。
- 切换论文 / 组件卸载时 `qaWin.close()`，避免浮动面板跨论文残留。
- **单模型**：模型按钮为单选（`selectModel` 直接把 `selectedModels` 设为 `[name]`）；`stores/qa.ts` 读取旧的多模型缓存时只保留第一个。重新生成弹窗仍可多选。
- **对话视图打开时**：浮动面板不渲染（`PaperDetail` 只挂载一个 `QAInput`），`openQA()` 与 `composer.openRequests` 都不再弹浮窗，内容进入对话栏底部停靠的同一个提问框。

#### 对话视图（QAConversationPanel）与树视图（QATreeView）

- **三种页面布局**：宽屏且已登录时，页头右上角（`PaperActionLauncher` 左侧）有布局切换按钮组（`data-layout-selector`，单选）：
  - **Two columns**（`split`，`Columns2`）：原来的「阅读器 | 论文信息 + Q&A」。
  - **Paper + conversation**（`split-conv`，`MessagesSquare`）：「阅读器 | 对话视图」两栏。原右栏拆成左侧阅读器里 Note 右边的两个 tab（`PaperViewerPanel` 的 `info-tabs` prop + `#metadata` / `#qa` 插槽）：「Metadata」放论文信息卡片、引用、笔记卡片、Kimi 摘要；「Q&A」放 Preset Q&A 与 User Q&A 列表，以及 `QAPanelNav`。左右比例与双栏共用，拖任一布局的分隔线都会改变两者。
  - **Three columns**（`three`，`Columns3`）：「阅读器 | 论文信息 + Q&A | 对话视图」，两条分隔线都可拖动，比例独立保存。
  - 论文信息卡片（`Metadata`）和整栏（`PaperColumn`，`part: all | metadata | qa`）只在模板里定义一次（VueUse `createReusableTemplate`）：中间栏渲染 `all`，两个 tab 各渲染一部分。`QAPanelNav` 的滚动容器 `wideScrollRef` 跟随含 Q&A 的那个实例。
  - 定位 Q&A（`revealQAEntry`，以及 `locateBlock` 命中回答）前会调 `requestPaperInfo()`，"Paper + conversation" 布局下阅读器会先切到「Q&A」tab。
  - 窄屏/移动端、未登录不提供布局切换和对话视图。
- **比例与持久化（修复刷新后比例错乱）**：所有比例都按 split 容器宽度的**百分比**存储，不再存 px。旧实现的对话栏宽度是 px，左栏 45% 也不持久化，刷新或窗口宽度变化后中栏会被挤窄或溢出。
  - `paperland_paper_layout` 存 `{ layout, last }`，`last` 是最近用过的对话布局。
  - `paperland_paper_split_left` 存双栏 / 论文 + 对话共用的左栏比例，范围 20–80%。
  - `paperland_paper_three` 存三栏的 `{ left, conv }`。读取和拖动时都经过 `clampThree`：左栏 ≥ 15%，对话栏 ≥ 22%，中栏 ≥ 25%；正在拖动的一侧优先，另一侧让位。
  - 在双栏布局下点 "Open in conversation view"，切换到 `last` 记录的对话布局，默认 "Paper + conversation"。对话栏上的 "Close conversation view" 按钮回到双栏。
- **thread（`QAThreadView.vue`）**：不落库，由尾回答推导。调 `GET /api/qa/entries/:id/tree` 找根 → 尾的路径，每个祖先取其子节点的 `parent_result_id` 对应的回答、尾节点取选中的回答；内容优先用 `useQAStore().qaData` 里的实时 entry（流式回答实时增长），不在当前 scope 的祖先用树快照。不可见/已删除的祖先显示占位。问题渲染为右侧气泡（附件可点击跳回 PDF 位置，`QA-<id>` 点击在列表中定位），回答复用 `QAResultBody`（`in-conversation`、不显示管理按钮）。尾回答流式时贴底自动滚动。
- **停靠提问框**：`QAInput` 的 `docked` 模式（非 fixed、无移动/缩放/关闭，模型改为下拉框），与浮动框共用 `useQAComposer` 草稿，切 tab、开关视图都保留内容。`QAConversationPanel` 让追问目标跟随活动 tab：尾回答 `done` 时 `composer.startFollowup(尾回答)`，"New conversation" tab 清空追问；尾回答未完成时传 `blocked` 提示并禁用提交。提交成功后 `setActiveTail(entry_id, runs[0].result_id)`，活动 tab 自动跳到新回答。
- **入口**：每个回答操作栏新增 "Open in conversation view"（`PanelRightOpen`，任意状态包括排队/流式，仅 `available` 时显示）。对话视图打开时，`useQAComposer.startFollowup`（回答的追问按钮、`#moonlight`、`?followup=1`）会先 `openThread` 到该回答。
- **Q&A 树（`QATreeView.vue` + 递归 `QATreeNode.vue`）**：在浮动窗口中打开，**不改变 Q&A 列表**。`QAList` 的 Preset / User Q&A 标题栏有 "Q&A tree (floating window)" 按钮（`Network` 图标）→ `windows.openQATree(paperId, title)`，由 `FloatingWindowHost` 用共享外壳渲染（可拖动、缩放、与其他浮窗共存）；切换论文 / 离开详情页时 `PaperDetail` 关闭 `qa-tree` 窗口。由 `qaData`（模板 + 当前 mine/all scope 的用户提问）按 `parent_entry_id` 建森林，追问挂在父**问题**下（与接续的是父问题哪个回答无关），父问题不在当前数据中的作为根；中心节点为论文标题。布局同笔记思维导图：嵌套 flex + 由 DOM 实测位置画 SVG 贝塞尔连线（ResizeObserver 重算）。点节点打开该问题的首选回答（置顶模型，否则最近请求的）所在 thread；对话视图不可用时改为在列表中定位。

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
2. **Preset Q&A**（模板提问，来自 config.yml 配置）
3. **User Q&A**（自由提问，用户手动输入）

每个卡片有独立的 "Expand all" / "Collapse all" 按钮。所有 QA 问题默认折叠，用户点击标题手动展开。折叠时问题标题单行截断显示，展开后答案内容自然换行（不渲染内容中的换行符）。

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
- **双栏比例**：左右栏宽度支持拖拽调整（使用 Pointer Events API + `setPointerCapture` 确保快速拖动跟手），分隔条 2px 宽 + 12px 隐形热区；比例以百分比存 localStorage，刷新后恢复（三种布局见「对话视图」一节）
- **左侧面板折叠**：分隔条中间有 toggle 按钮（`PanelLeftClose`/`PanelLeftOpen` 图标），可一键折叠/展开左面板，带 300ms 过渡动画

---

## 一（附）、两层论文（已列出 vs 仅元数据）

为了导入外部论文并用 Semantic Scholar 富集而不污染阅读列表、也不触发 arxiv 限流，论文分两层（由 `papers.listed` 全局布尔区分，默认 `1`）：

| | 已列出 `listed=1` | 仅元数据 `listed=0` |
|---|---|---|
| 论文列表 | 显示 | 默认隐藏（可切到 "Metadata only" / "All" 查看） |
| 抓取管线 | 完整（S2 + arxiv metadata/PDF + 解析 + papers.cool） | 只跑 `semantic_scholar_service`；arxiv/PDF/解析/papers.cool 标 `deferred` |
| 详情页 | 可进入 | 列表行不可点击；需先 "Fetch"（提升）才可进入 |

- **服务门禁**：paper-bound 服务可声明 `requires_listed`；调度器对 `listed=0` 论文把这些服务记为 `deferred`、不执行。**提升**（`listed:0→1`）时 `triggerForPaper` 重跑，deferred 服务执行、已完成的 S2 跳过。
- **S2 优先元数据**：basic fields + abstract 优先取自 S2；arxiv metadata 退为补缺/PDF。
- **前端**：论文列表页有 "Listed" / "Metadata only" / "All" 三态切换；仅元数据行显示 "Metadata only" 徽章 + 行内 "Fetch" 按钮（提升）。论文详情页对 `listed=0` 论文显示 "Add to list"。提升经 `PATCH /api/papers/:id { listed: true }`。
- **列表过滤**：论文列表（按模式）、External API 默认只含 `listed=1`；`GET /api/papers/:id` 直链可访问隐藏论文。

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

- 定义在 `config.yml` 的 `qa` 列表中，每项包含 `name`、`prompt`，可选 `system_prompt`（指定 `prompts/system/<name>.md`）
- system prompt 是 `prompts/system/*.md` 文件（规则，不含论文），默认 `qa_prompt.default_system_prompt`；论文、参考文献、inputs、历史和问题由后端拼成 user 消息（见 4.2）
- 列表顺序决定前端展示顺序

#### 一键生成按钮

- 仅当论文存在**未作答的模板**时显示
- 点击后遍历所有模板：
  - 已有完成结果 (`results.some(status === 'done')`) → 跳过；只有失败/取消尝试时仍可重新提交
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
- 提问框一次只选一个模型（单选，前端记忆上次选择）；后端接口仍接受多个模型
- 每个模型产生一个 result
- 支持重新生成（同一问题，不可更改问题文本）
- 新结果追加到 results 数组末尾

### 2.4 Q&A 入口

| 入口 | 说明 |
|------|------|
| 论文详情页内嵌 | 针对当前论文提问，paper_id 自动绑定，展示模板提问和自由提问 |
| 独立 Q&A 页面 (/qa) | 按时间倒序展示自由提问的 Feed 流（不含模板提问，后端分页 20/页），每个 QA 为可折叠面板，显示关联论文标题及跳转链接。默认仅展示当前用户自己的提问；所有登录用户均可用 Mine / All 切换查看自己 + 开启 Q&A 共享的用户的提问（admin 看全部，未共享的标 Private）并看到提问者。别人的 QA 对普通用户只读，owner/admin 才有重新生成与删除操作。 |

**`/qa` Feed 卡片组成（`QAFeedPanel.vue`）**：每个条目 = card 外的论文/提问者/时间行 + 下方可折叠 shadcn `Card`。card 头部显示状态、问题、当前用户的非零 "N highlights" / "N note references"、个人淡色背景选择器以及回答数/模型；card body 复用 `QAResultView`。每次模型运行在排队前即成为独立 Result tab，状态为 `queued → awaiting_output → streaming → done|failed|cancelled`。多回答 Tabs 按成功完成时间、活动运行创建时间及 id 判定最新，新增 Result 自动选中；计时/答案/SSE/等价轮询不改变 selection signature，保留用户手动历史选择。`scope=mine|all` 默认 mine，所有登录用户可切换；all 按 Q&A 共享开关过滤（admin 不过滤），显示 asker，普通用户能实时阅读别人的 QA，但停止/重生成/删除仍由 Result/Entry owner 或 admin 控制。背景色通过 `qa_user_preferences` 跨设备同步，支持 gray/brown/orange/yellow/green/blue/purple/pink/red 九色。高亮计数来自当前用户实际 rows，笔记引用计数从当前用户该论文的 `notes.body` 锚点派生，不缓存计数。分页和轮询仍只重拉当前页，并批量聚合 creator/preferences/highlights/notes。

#### QA Result 流式前端状态

- `queued`：显示 `Queued`，不把队列等待算作 Thinking。
- `awaiting_output`：模型调用已经开始但还没有首个非空 delta，显示固定宽度、等宽数字的 `Thinking · mm:ss`。初始耗时由后端 `thinking_duration_ms` 给出，前端只用独立 monotonic timer 每秒更新该文本节点。
- `streaming`：首个 delta 写入 `first_chunk_at` 并冻结思考耗时；`GET /api/qa/results/:resultId/stream` 持续发送已经落库的 delta。断开 SSE 只停止观察，不会取消后台 Service。
- `done`：等待浏览器已排队的 delta paint 后，用 `done.result.answer` 替换预览并通过标准 `MarkdownContent` 完整渲染一次；此时才启用稳定 `content_hash` 对应的高亮与笔记锚点。
- `failed/cancelled`：保留局部答案、冻结的 `Thought for · mm:ss` 和错误；重试创建新 Result，不覆盖该次历史。新增流式状态及提示使用英文 UI copy（包括 `This model will display its answer when complete` 与 `Agent is thinking…`）。

流式阶段由 `QAStreamingMarkdown` 将内容分为 append-only 的完整 block 前缀和可重解析尾部。服务端 200ms 合并 chunk，前端再用 `AnimationFrameBatcher` 合并同一帧更新；未闭合 fence/公式、列表、表格保留在尾部。Result/card/tab 外层始终按 Result id 保持挂载，无高度/透明度动画且不自动滚动，从而避免每个 token 重写 `MarkdownContent.innerHTML` 所造成的抖动。

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

### 图片宽度指令（alt 文本 `w=`）

在图片 **alt 文本**里写一个 `w=` token 控制该图渲染宽度（约定语法，作者手写，类似 `paperland://` 锚点）：

| 写法 | 效果 |
|------|------|
| `w=sm` / `w=md` / `w=lg` | 选三档预设 `max-width`（默认 **240 / 480 / 720 px**，见 config.yml `notes.image_width_tiers`） |
| `w=100`（直接数字） | 显式设 `max-width` 为该像素值（钳制到 `[16, 4096]`；0/负数/未知关键字 → 无指令） |
| 无 `w=` token | 不变：`width:100%` 充满列宽，仅受容器约束 |

- **仅作上限、不溢出**：指令只叠加一个 `max-width`，不替换默认的 `width:100%`。实现为 `max-width: min(档位值, 100%)`，所以无论档位多大都不会超出容器宽度。
- **解析时机**：在 `renderAndHighlight()` 渲染后那次 DOM 遍历里（与高亮同一处），`parseImageWidthDirective(alt)` 用正则 `(?:^|\s)w=(sm|md|lg|\d+)(?=\s|$)`（大小写不敏感、词边界）抠出**第一个**有效 token，把它从 alt 里剥掉（`![figure 1 w=md]` → alt 变 `figure 1`），档位加 class `md-img-w-{sm|md|lg}`、数字写内联 `style.maxWidth`。对带锚点的截图 `[![w=lg](url)](paperland://…)` 同样生效（`<img>` 仍带 alt，外层 `<a>` 不动）。
- **档位值可配置**：三档 px 来自 `config.yml` 的 `notes.image_width_tiers`，前端登录后经 `GET /api/config/notes`（`configApi.notes()`）拉取，由 `App.vue` 注入为 `:root` 的 `--note-img-w-sm/md/lg` CSS 变量；scoped CSS 用 `var(--note-img-w-md, 480px)` 形式，**把设计默认值作为 fallback**，所以公开/匿名笔记（不拉 config）也按 240/480/720 正确渲染。
- **不影响思维导图**：指令只作用于笔记**直接渲染**。`MarkdownContent` 的 `applyImageWidth`（默认 `true`）prop 为 `false` 时（`NoteNode` 内容节点）只剥 token、不加宽度上限，思维导图图片尺寸仍由节点布局决定。（将来若要让思维导图也响应，此 prop 即接入点。）

### 数学公式支持

支持两种 LaTeX 定界符：

| 语法 | 类型 | 示例 |
|------|------|------|
| `$...$` | 行内公式 | `$E=mc^2$` |
| `$$...$$` | 行间公式 | `$$\int_0^1 f(x)dx$$` |

- 渲染引擎：KaTeX（同步渲染，轻量快速）
- 只支持 `$` / `$$` 定界符：`\(...\)`、`\[...\]` 不渲染为公式（`\(x\)` 显示为 `(x)`），刻意不做转换，让模型写错的定界符在页面上一眼可见；QA 与 Deep Research 的 system prompt 都要求用 `$` / `$$`
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

> **Mine / All 高亮叠加**：`HighlightScopeToggle`（论文详情 Preset Q&A 与 User Q&A 两个卡片头部、`/qa` 页头）切换 `useHighlightStore().scope`（`localStorage` 记忆，默认 Mine），重新拉取 `?scope=`。「看不看 Q&A 回答里别人的高亮」是同一个设置：几处开关读写同一个 store 值，始终同步，作用于页面上所有回答（preset 与 user Q&A；别人共享的 User Q&A 也能被自己高亮）。User Q&A 头部的高亮开关带高亮图标，与旁边控制「显示谁的提问」的 Mine / All 区分。别人的高亮由 `applyHighlights(el, hls, viewerId)` 渲染为 `.hl-foreign`（无底色、按颜色的虚线下划线，`title` 显示属主用户名 / private），点击不弹改色删除菜单，只读。

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
| GET | `/api/highlights?pathname=...&scope=mine\|all` | 按页面路径获取高亮；`all` = 自己的 + 共享者的（admin 全部），每条带 `user_id`/`username`/`shared` |
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
  # 查询 id 优先级：ARXIV:{arxiv_id} → CORPUSID:{corpus_id} → 裸 {s2_paper_id}；响应 paperId 缺失时回写到 s2_paper_id 列（与他人冲突则跳过）
  # 有 arxiv_id 用 ARXIV:{id}、否则用 CORPUSID:{id} 查询 S2，单次拿到对侧 id + 引用富化；
  # arxiv_id 故意不放进 produces：corpus-only 论文解析出 arxiv_id 后，arxiv 元数据/PDF 服务
  #   靠 runner「完成后按实时 key 重触发」自然衔接，而非被提前调度；
  # reference_count 取 S2 referenceCount（权威总数，不受 references 单页截断影响）；
  # tldr/venue/year/doi/fields_of_study/s2_url 等存入 metadata（不纳入 produces，可能缺失）；
  # 同时请求 openAccessPdf：url 非空时存 open_access_pdf_url，status（GREEN/BRONZE/CLOSED...）存 open_access_pdf_status；
  # 既无 arxiv_id 也无 corpus_id 的手动论文：no-op（不发请求）

arxiv_service:
  depends_on: [arxiv_id]
  produces:   [pdf_path, arxiv_categories, ...]

s2_pdf_service:
  depends_on: [open_access_pdf_url]   # 不在任何 produces 中 → 首次调度标 blocked，S2 写入 url 后经实时 key 重触发
  produces:   [pdf_path]
  eligible:   !arxiv_id && !pdf_path   # 有 arxiv_id（含 S2 刚反查出的）一律走 arxiv_pdf_service
  requires_listed: true
  # 无 arXiv 版本的 corpus-only 论文：从 S2 开放获取链接下载 PDF 到 data/pdfs/s2_<corpus_id>.pdf；
  # 跟随重定向、download_timeout / max_file_size_mb 限制、必须以 %PDF 开头（HTML 落地页/403 → failed，可重试，不留文件）；
  # 闭源论文（无 url）保持 blocked，不报错。存量论文：POST /api/services/backfill/s2_pdf_service（admin）

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
                                     ↑
open_access_pdf_url (S2, 仅无 arxiv_id) ─→ s2_pdf_service
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

doc2x 两个 paper-bound 服务（配置见 tech-stack.md `doc2x` 块）：

```typescript
doc2x_parse:                # 自动：created_at ≥ doc2x.auto_since 的新论文；旧论文仅手动
  depends_on: [pdf_path]
  produces:   [contents.doc2x_parsed]   # doc2x Markdown（$ 公式、含参考文献）；同时写 metadata.doc2x_parse_id
  eligible:   enabled && pdf_path && (新论文 || metadata.doc2x_parse_requested)

doc2x_translate:            # 手动排队；解析完成后由依赖图「完成后重检查」自动开始
  depends_on: [contents.doc2x_parsed]
  produces:   [doc2x_translation]       # metadata：{ bilingual_pdf_path, translated_pdf_path, parse_id, translate_id, ... }
  eligible:   enabled && metadata.doc2x_translate_requested && contents.doc2x_parsed
```

- **eligible 门槛**：paper-bound 服务可以声明 `eligible(paper)`。在自动调度中（初次触发和完成后的重检查），不满足门槛的服务会被**静默跳过**，不写 blocked/deferred 记录；显式调用 `executeServiceForPaper` 不受门槛约束。
- **共享并发组**：`services.<name>.concurrency_group` 相同的服务共用一个信号量。doc2x 两个服务都在 `doc2x` 组里，上限 1（实测 Doc2X 账号同时只能跑 1 个任务，解析与翻译串行排队）。
- **翻译复用 parseId**：`doc2x_translate` 优先用 `metadata.doc2x_parse_id`，通过 doc2x 网关（CLI 内部使用、未公开的接口：`CreateTranslateTask` → `GetTaskStatus` → `CreateExternalPDFMergeTask`）直接从已有解析建翻译任务。这样不会重新解析，不扣页数，只扣翻译积分（约 10.6 积分/页）。没有 parseId 或网关失败时，回退到 `doc2x translate` CLI，CLI 会重新解析，因此要再扣一次页数。

### 3.3 Pure Service

| Service | 说明 |
|---------|------|
| qa_service | 调用大模型进行 Q&A |

- 注册为 `pure` 类型到 `service_runner`，使用 `executePureService()` 执行
- 受 `max_concurrency` 和 `rate_limit_interval` 约束，执行记录写入 `service_executions` 表；pre-run hook 在进入队列前用本次 execution id 创建 `queued` Result，callback 同时获得该 id 和 execution-owned `AbortSignal`
- 在服务管理页面可见（显示运行中/排队/最大并发数）
- 触发方式：用户手动提交 / External API 调用
- **前置条件**：调用方负责检查 content 不为空
- **有效 Codex 配置**：默认及可选的 GPT-5.6-sol max/xhigh/medium 与 GPT-5.5-xhigh 均使用结构化 `stream:true` app-server 配置，保留原 Paperland model name / model id / reasoning effort；旧 `shell` exec 仅作为显式 buffered 兼容方式
- **精确取消**：Result owner/发起人或 admin 可停止一个 Result；semaphore/rate-limit 等待和 provider 调用共用同一 AbortSignal，兄弟运行不受影响。Services 页面仍只统一监控，不新增 QA 专属操作。
- **启动清理**：服务器启动时将 stale service execution 标为 failed；`queued/awaiting_output/streaming` Result 保留 prompt/局部 answer 后标为 interrupted failed，再从所有 Result 重算 Entry 汇总状态

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
│  s2_pdf_service:          max_concurrency: 2                │
│    ┌─┐ ┌─┐                rate_limit_interval: 2s           │
│    └─┘ └─┘                (开放获取 PDF 下载)               │
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
pdf_upload:
  max_file_size_mb: 100        # 用户上传 PDF 的大小上限，超出返回 413

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
  s2_pdf_service:              # 仅无 arxiv_id 的论文：经 S2 openAccessPdf 下载 PDF
    max_concurrency: 2
    rate_limit_interval: 2
    download_timeout: 60       # 秒
    max_file_size_mb: 100      # 超出则 failed，不落盘
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
      stream: false
    - name: "codex-gpt-6-luna-low"
      type: codex
      stream: true
      cli_path: "/root/.local/bin/codex"
      codex_home: "/root/.codex"
      model_id: "gpt-6-luna"
      reasoning_effort: low
```

模型 provider 只保留 `openai_api` 与 `codex` 两类；旧 `claude_cli` / `codex_cli` 已移除。两者都以 `stream`（默认 false）声明是否提供真实增量，但内部协议完全独立：OpenAI 为 JSON/SSE，Codex 为 ephemeral exec/app-server。

### 4.2 Prompt 模板

- **system prompt 文件**：`prompts/system/<name>.md`（随仓库提交，英文书写），整份作为模型的 system 内容，每次运行重新读取（改了不用重启）。`config.yml` 的 `qa_prompt` 指定 `default_system_prompt`（默认 `paper-qa`）、`direct_ask.{system_prompt?, question}`、`codex_web_search`（默认 true）、`max_history_turns`（默认 20），`system_prompts_dir` 省略时用仓库自带目录。启动时校验被引用的文件都存在；旧的顶层 `system_prompt` 模板一旦出现直接启动报错。
- **user 消息**（后端 `services/qa_formatter.ts`，运行和 "View model input" 共用）：`<paper>`（`content_priority` 选出的全文，没有全文时所有提问返回 409）→ `<references>`（本论文引用的文献：`cite:<S2 paperId>` 或 `no id`、标题、第一作者 et al.、年份、venue，库内论文标 `in library: paperland://paper/<id>`）→ `<inputs>`（整条追问链的截图在前、选段在后，各出现一次，带标号与页码；截图作为图片 part 紧跟标号行）→ `<history>`（祖先各轮的问题 + 被选中的回答，只用标号引用输入，最多 `max_history_turns` 轮）→ `<question>`。
- **provider 映射**：OpenAI 兼容 API 发真正的 `role: system`，图片读本地图床文件转 base64 data URL；Codex app-server 用 `thread/start` 的 `developerInstructions` + `config.web_search: "live"`，图片用 `localImage`（图床文件绝对路径）；Codex exec 用 `-c developer_instructions=…`、`-c web_search="live"`、`--image <path>`，问题文本走 stdin。
- `qa`：有序数组，每项包含 `name`（模板名，作为 QA Entry 的 key）、`prompt`（问题文本）和可选 `system_prompt`
- 列表顺序决定前端展示顺序

### 4.3 前端设置页面

`/settings`（`views/Settings.vue`，`AppPage` 包裹）对**所有登录用户**开放（路由 `meta.requiresAuth`，侧边栏 Settings 项 `requiresAuth`）；不再有账户设置弹窗——侧边栏账户菜单的 **Account settings** 和移动端抽屉里的用户名按钮都 `router.push('/settings')`。自上而下：

1. **Install app**（`components/settings/InstallAppCard.vue`）：把站点安装为独立窗口的 PWA，见下文「PWA 安装」。
2. **Account 区**（`components/settings/AccountSettings.vue`，由原 `AccountDialog.vue` 迁移，挂载时加载数据）四张卡片：
   - **Account**：用户名 / 昵称 / 当前密码 / 新密码，`PATCH /api/auth/me`（`auth.updateAccount`）；保存成功后 toast，清空密码框并按新用户信息重填，停留在本页。
   - **Sharing**：五个共享开关（见 5.3）。
   - **API Tokens**：MCP URL、personal token 列表 / 新建 / 撤销、Codex agent token 重置（见 5.4）。
   - **Browser Extension**：Site URL + quick-open token（复制 / 重新生成）。
3. **Usage**（`components/settings/UsageSection.vue`，`usageApi.me` → `GET /api/usage/me`）：本人模型调用的次数、token、缓存命中占比、估算费用，以及按类别（Q&A / Deep Research / Translation）的表格；右上角 All time / Last 30 days 切换（`?days=30`）。数字格式化在 `components/settings/usage-format.ts`（`formatTokens` 1.2K / 3.4M、`formatCost`、`cacheShare`）。
4. **Administration**（`v-if="auth.isAdmin"`，标题行带 ShieldCheck）：用户管理表（新增 / 审核 / 角色 / 昵称 / 重置密码）、**All API Tokens**（全站 token 列表，`/api/settings/tokens*`）、**Recalculate costs**（`components/settings/UsageRecalculate.vue`：From / To 两个日期输入（UTC、含两端、留空为开区间）+ 按钮，`confirm` 后调 `usageApi.recalculate` → `POST /api/usage/recalculate`，按 config.yml 当前 pricing 从已存 token 重算估算费用，显示更新条数和因无 pricing 跳过的模型）与 **Usage leaderboard**（`components/settings/UsageLeaderboard.vue`，`usageApi.leaderboard` → `GET /api/usage/leaderboard`：排名、用户（昵称 + 用户名，无归属的显示 Unattributed）、调用数、token、缓存占比、估算费用，同样可切 30 天）。仅管理员挂载时才请求 `/api/users`、`/api/settings/tokens`、`/api/usage/leaderboard`，普通用户不会触发 403。

**PWA 安装**（无新依赖，手写）：
- `public/manifest.webmanifest`（name/short_name `Paperland`、`start_url`/`scope`/`id` 为 `/`、`display: standalone`、`theme_color #0069A8`、图标 `icon-192.png` / `icon-512.png` / `icon-maskable-512.png` / `favicon.svg`）；`index.html` 链接 manifest、`apple-touch-icon.png`（180）与 `theme-color`。PNG 图标按 `favicon.svg` 的几何图形绘制生成后提交。
- `public/sw.js`：只为满足可安装性——`install` 时 `skipWaiting`、`activate` 时 `clients.claim`，`fetch` 监听器不调用 `respondWith`，**不缓存、不拦截**，API / SSE / WebSocket / 会话 cookie 行为不变。仅生产构建注册（`main.ts` → `registerServiceWorker()`，dev 不注册以免干扰 HMR）。
- 生产托管（`frontend_hosting.ts`）直接返回 `dist/` 根目录存在的文件并带 `no-cache`，登录墙只管 `/api`，所以 manifest / 图标 / `sw.js` 匿名可取，SW 更新随下次导航检查生效。
- `composables/usePwaInstall.ts`：模块级单例，`main.ts` 启动即 import，提前捕获 `beforeinstallprompt`（`preventDefault` 后保存，事件可能早于进入 Settings 触发）和 `appinstalled`；`standalone` 由 `display-mode: standalone` 媒体查询或 iOS `navigator.standalone` 判断。暴露 `canInstall` / `installed` / `standalone` / `install()`（调用保存的 `prompt()`，事件只能用一次）。
- `InstallAppCard`：`canInstall` 时标题栏显示 **Install** 按钮；已安装（独立窗口运行或刚接受安装）显示已安装提示；其余（iOS Safari、Firefox 等不支持一键安装的浏览器，或 Chromium 尚未给出提示）显示 Chrome/Edge、Safari macOS、Safari iOS 的手动安装步骤。

---

## 五、认证与授权

### 5.1 会话登录（取代 HTTP Basic Auth）

网站 `/api/*` 改用**应用内会话登录**。**全站仅限成员**：未登录什么都看不到（只有登录 / 注册页；例外是已发布笔记的链接和图床 `/image/*`），支持自助注册 + 管理员审核、在线改密 / 用户名、角色区分。

- **用户存储**：用户账户存于数据库 `users` 表（`id`、`username` 唯一、`nickname` 可空且可重复、`password_hash`、`role`、`status`（`active` | `pending`，默认 `active`，迁移 0036）、`created_at`），不再使用 `config.yml` 的 `auth.users`（该字段已弃用）。密码用 `Bun.password`（argon2id）哈希。
- **首启 seeding**：数据库无用户时，自动创建 `admin`（随机强密码），并在**服务器日志打印明文密码一次**。管理员创建的用户直接 `active`。
- **自助注册 + 审核**：`POST /api/auth/register { username, password, nickname? }`（免登录；用户名去首尾空格、≤64 字符，重名 409；`config.yml` `auth.registration_enabled: false` 时 403）建一个 `role=user`、`status=pending` 的账号，**不登录、不发 cookie**。pending 账号登录时密码正确返回 `403 ACCOUNT_PENDING`（密码错误仍是通用 401，不泄露谁在待审核）；会话也只解析 `active` 账号。管理员在 Settings 审核：`POST /api/users/:id/approve` 置 `active` 并在此时放入初始论文（Attention）；`DELETE /api/users/:id` 拒绝 = 删除该 pending 账号（用户名释放；`active` 账号删除返回 400）。
- **会话**：登录成功后写 `sessions` 表（随机不透明 token + 30 天过期）并下发 httpOnly cookie `paperland_session`（`SameSite=Lax; Path=/`）。前端 `fetch` 同源自动携带；401 时清空本地用户，界面切回登录页。
- **角色**：`admin` 与 `user` 两种。管理员可管理用户（增 / 改角色 / 重置密码 / 审核注册，只能删除 pending 账号，且不能降级最后一个 admin）。
- **开发期免登录**：`config.yml` `auth.enabled: false` 时跳过登录，所有 `/api/*` 以 admin 身份访问（本地开发用，启动会打印警告）；`true`（默认）启用会话登录与下方分层。

#### 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 公开。校验后建会话、下发 cookie |
| POST | `/api/auth/logout` | 删会话、清 cookie |
| POST | `/api/auth/register` | 公开。自助注册，建 pending 账号（见上） |
| GET | `/api/auth/me` | 公开。返回 `{ user, registration_enabled }`（未登录 `user` 为 `null`，不 401） |
| PATCH | `/api/auth/me` | 改本人用户名 / 昵称 / 密码（改密需校验 `current_password`；`nickname` 去首尾空格，空串清除，>32 字符 400） |
| GET/POST/PATCH | `/api/users` `/api/users/:id` | **仅 admin**。列表（含 `status`）/ 新建 / 改角色 / 改昵称 / 重置密码 |
| POST | `/api/users/:id/approve` | **仅 admin**。通过注册（pending → active + 初始论文；已 active 为 no-op） |
| DELETE | `/api/users/:id` | **仅 admin**。拒绝注册 = 删除 pending 账号；active 账号 400 |

### 5.2 访问分层（登录墙）

身份与登录墙都在全局 `onRequest` 钩子（`auth/identity_hook.ts`）里处理：解析 `request.user` 后，**匿名请求只放行白名单**（按「方法 + 路由模式」匹配），其余 `/api/*` 一律在钩子里直接 401（路由 handler 不会执行）；不存在的路由仍走 404。管理员权限仍由各路由 `requireAdmin` 检查。`/external-api/*` 只认 Bearer Token，不受登录墙影响；`/image/*`（图床）与前端静态资源不在 `/api` 下，保持公开。

| 层级 | 范围 |
|------|------|
| **匿名可访问（白名单）** | `GET /api/health`、`POST /api/auth/login`、`POST /api/auth/register`、`GET /api/auth/me`、`GET /api/notes/:noteId`（匿名只返回已发布笔记，其余 404）；另有 `/api` 之外的 `/image/*` |
| **需登录（任意用户）** | 其余全部 `/api/*`：论文列表 / 详情、问答、PDF（`/api/files/*`）、会议、模板、笔记、高亮、标签、翻译、图床上传…… |
| **仅管理员** | 服务管理 Dashboard（`/api/services*`）、设置页 Token 管理（`/api/settings/tokens*`）、用户管理（`/api/users*`）、用量排行榜（`/api/usage/leaderboard`） |

- 各路由里原有的「匿名返回空 / 仅模板」分支保留但已不可达（匿名到不了这些路由）。
- **`/api/files/*`**（`api/files.ts`，PDF 查看器）：需登录，且只服务**解析后位于项目 `data/` 目录内、扩展名为 `.pdf`** 的文件（论文 PDF `data/pdfs/…`、doc2x 译文 `data/doc2x/…/*.pdf`）；越界路径（`..`、绝对路径）、数据库 / 配置等非 PDF 一律 404。缓存头为 `private`。
- **前端门禁**（`App.vue`）：`auth.loaded` 之前什么都不渲染（不发业务请求）；未登录时整页显示 `components/AuthScreen.vue`（Log in / Register 两个 tab，注册关闭时只有 Log in；注册成功提示等待管理员审核并切回登录；pending 账号登录显示「awaiting admin approval」），不渲染侧边栏和页面。登录成功只是设置用户，原本请求的路由随即渲染。路由守卫对匿名直接放行（由 App 挡住），只负责非管理员访问管理员页的拦截；登录后若当前路由是管理员页而用户不是管理员，跳回 `/`。
- **已发布笔记链接**：匿名打开 `/papers/:id?note=:noteId` 时渲染 `components/notes/PublicNoteStandalone.vue`——只拉 `GET /api/notes/:noteId`，显示论文标题、作者显示名、日期和只读笔记（复用 `PublicNoteView`），右上角 Log in；笔记不可读（未发布 / 已删）或点 Log in 时切到登录页。登录用户打开同一链接仍走论文详情页右栏自动展开的原逻辑。
- **审核入口**：Settings 用户表把 pending 账号排在最前（`Pending` 徽标），操作列为 Approve / Reject（Reject 先 `confirm`）。管理员侧边栏 Settings 图标右上角显示待审核数量（`composables/usePendingRegistrations.ts` 共享计数：App 在确认是管理员后拉一次，Settings 每次刷新用户表时更新）。
- 侧边栏：登录后显示账户菜单（昵称 / 用户名、**Account settings** → 跳转 `/settings`、登出）。

### 5.3 数据归属与多用户可见性

所有用户数据分三类（openspec `data-sharing-preferences`）：

| 类别 | 数据 | 规则 |
|---|---|---|
| **始终全站共享** | 论文（任何人添加都进全站列表，避免重复抓取）、Preset Q&A、翻译缓存 | 不受任何开关影响 |
| **纯私有** | 标签及论文↔标签、图床图片列表、API token、QA 背景色/阅读偏好 | 只返回给属主 |
| **用户可选共享** | 高亮、笔记、Free Q&A（含未来划线/截图提问）、参考链接、Deep Research 会话 | 由属主每类一个开关决定 |

- **共享开关**：每用户每类型一个全局开关（表 `user_sharing_settings`，稀疏存储；无行 = `config.yml` 的 `sharing.default_shared`，默认 `true`，因此存量数据迁移后即为共享）。开关作用于该类型全部已有与新建数据，无单条覆盖。例外：`research` 开关未设置时默认**关闭**（私有），不受 `sharing.default_shared` 影响（`visibility.ts` 的 `defaultSharedFor`）。Settings 页 Account 区（`components/settings/AccountSettings.vue`）的 **Sharing** 卡片五个复选框（Highlights / Notes / Q&A / Reference links / Research），`GET/PUT /api/auth/me/sharing`（`sharingApi`，后端 `api/sharing.ts`）。
- **统一 mine/all 语义**（后端 `auth/visibility.ts` 的 `ownerVisibilityFilter` 在 SQL 层过滤，分页 total 正确）：`mine` = 自己的；`all`（普通用户）= 自己的 + 开启该类型共享的其他用户的；`all`（admin）= 所有用户的，不论开关；匿名 = 仅始终共享数据 + 已发布笔记。每行返回 `user_id` / `username` / `display_name` / `shared`。
- **统一的 Mine / All 切换组件**：所有 Mine / All 切换（论文列表、`/notes`、`/qa` feed、论文详情 User Q&A、参考链接区、高亮）都用同一个 `components/ScopeToggle.vue`（`v-model: 'mine' | 'all'`）。
  - 文案固定为英文 "Mine" / "All"。
  - `size`：`md` 用于页面工具栏（h-8），`sm` 用于区块标题和论文列表（h-6）。
  - 可选 `#icon` 插槽，`HighlightScopeToggle` 在这里放高亮图标。
  - 样式为分段控件：`bg-muted` 轨道（内边距 2px，无边框），选中项是嵌在里面的 `bg-background` 圆角块（带轻阴影；暗色主题下比轨道更深）。
  - 两个选项等宽，选中块切换时平移（200ms，`prefers-reduced-motion` 下关闭）；选中态只改颜色、不加粗，宽度不抖动。
- **前端展示**：`/notes`、`/qa`、论文详情 User Q&A、参考链接区、高亮（`HighlightScopeToggle`）都有 Mine / All 切换；不属于自己的条目显示属主 **display name**（`display_name` = 昵称，未设置时为用户名；昵称在 Settings 页 Account 卡片设置，admin 可在 Settings 用户表修改，可重复）；`shared: false` 的条目（admin 看到的别人未共享数据，或自己未共享的数据）显示 **Private** 标记。
- **只读**：可见不代表可写。别人的高亮/笔记/QA/参考链接对普通用户不显示编辑删除入口，后端也只允许 owner（QA 另允许 admin）修改。
- **笔记发布是特例**：`is_public` 是单篇的 “Published” 状态，提供免登录访问的链接；已发布笔记无论属主笔记开关如何都出现在 All 列表。

- **标签完全按用户隔离**：每个用户拥有自己的标签（名称 / 颜色 / 可见性）与"论文↔标签"关联，唯一性按 `(user_id, name)`。论文列表 / 详情仅展示当前用户的标签，匿名用户看不到任何标签（`papers.tags_json` 全局缓存已弃用，改为按当前用户实时 JOIN 计算）。
- **free Q&A**：默认只看自己的，登录用户可切换 all（按上述共享规则）；写操作仍 owner/admin。**QA 背景 preference 与两类阅读计数**始终只属于当前 viewer。模板问答（template）为公开共享（`user_id` 为空）。
- **迁移**：升级时把库中已有的标签、free Q&A、高亮、API token 一次性归属到新建的 admin。

### 5.4 External API Token

- 每个用户在 Settings 页（`components/settings/AccountSettings.vue` 的 **API Tokens** 卡片，`myTokensApi` → `/api/auth/me/tokens*`）管理自己的 personal token：列表掩码、「New token」后完整值只显示一次（黄色提示框 + 复制）、撤销前 `confirm`；同时显示 MCP URL（`<origin>/mcp`）。下方一行 **Codex agent token**：只显示创建 / 重置时间和「Reset」按钮（`confirm` 提示旧值立即失效、进行中回合后续工具调用会失败），不提供查看。
- 管理员在 "Settings" 页面查看全站 Token、签发 / 撤销自己的 personal token；agent token 行显示 "Hidden" + `Codex agent` 标记，不提供撤销（只能由本人重置）。
- 两种 token（`api_tokens.kind`）：personal 可用于 External API 与 `/mcp`，agent 只用于 `/mcp`（Deep Research 回合自动注入会话所有者的 agent token）。
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
| s2_paper_id | text (nullable, unique) | Semantic Scholar paperId（40 位十六进制小写；迁移 0029 从 `metadata.s2_url` 回填，S2 富化时回写） |
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
| prompt | text (nullable，仅历史不可恢复行为空) | 问题文本；free 创建后固定，template 每次运行前刷新为 config 最新文本 |
| status | text: "pending" \| "running" \| "done" \| "failed" | 执行状态 |
| error | text (nullable) | 错误信息 |
| created_at | datetime | 创建时间 |
| instruction | text (nullable) | system prompt 名称（`prompts/system/<name>.md`），null 用默认；追问默认沿用父 entry |
| inputs | text (JSON, nullable) | 不可变的有序 inputs：`text_selection`（`label`、`text`、`pdf: [{page,ts,te}]`）、`image`（`label`、`image_hash`、`url`、`pdf: {page,rx,ry,rw,rh}`）、至多一个 `history`（`result_id`）；标号在整条追问链内唯一 |
| parent_entry_id | integer (nullable, indexed) | 由 `history` input 派生的父 entry，用于树查询 |

`qa_entries.id` 即全站唯一的 QA 编号，界面显示为 `QA-<id>`。

### 6.4 QA Result

每个 QA Entry 关联一个 append-only results 数组；每个 Result 表示一次准确的模型运行，包含排队、Thinking、输出和终态。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| qa_entry_id | integer → QAEntry.id | 关联的 QA Entry |
| prompt | text | 实际发送的问题文本 |
| answer | text | 活动时为最新已持久化局部回答，done 时为 provider 权威全文 |
| model_name | text | 使用的模型名称 |
| completed_at | datetime | 回答完成时间 |
| execution_id | integer (nullable) → ServiceExecution.id | 新 Result 精确关联本次 pure-service execution；历史歧义值不猜测重写 |
| content_hash | text (nullable) | 完成回答的稳定指纹：去除全部空白后 MD5；用于高亮归属与笔记锚点计数 |
| status | queued / awaiting_output / streaming / done / failed / cancelled | 本次运行的精确状态 |
| error | text (nullable) | 本次失败/取消原因，不覆盖兄弟 Result |
| requested_by_user_id | integer (nullable) → User.id | 本次发起人；用于共享 preset 的取消授权，用户删除时置空 |
| streaming_capable | boolean | provider 是否能提供真实增量输出 |
| created_at / started_at / first_chunk_at / finished_at / updated_at | datetime | 排队、Thinking 开始、首输出、终态及最后持久化时间 |
| deleted_at | datetime (nullable) | 软删除时间：删除回答只写这一列，所有面向用户的读取（列表、详情、SSE、计数）都排除；后端拼追问历史时仍读取 |

`#cite:<id>` 引用不单独建表：引用关系以回答 Markdown 为唯一来源，元数据由 `s2_papers` 缓存提供（回答完成时预热）；原 `qa_result_cites` 表已删除（迁移 0033）。

**S2 论文元数据缓存**（`s2_papers`，与论文库无关，删除论文不影响）：`POST /api/s2/papers/resolve`，body `{ "ids": string[] }`（paperId / CorpusId / `CorpusId:<n>` / S2 URL，上限 `s2_cache.max_ids_per_request`，超出或格式错误 400），返回 `{ results: S2ResolveResult[] }`，与请求一一对应、同序，重复 id 只解析一次。每项：`id`（原样）、`status`（`resolved` | `not_found` | `unavailable` | `invalid`）、`source`（`library` | `cache` | `s2` | `stale_cache` | null）、`paper`（`S2PaperMeta`：s2_paper_id、corpus_id、arxiv_id、doi、title、authors、year、venue、abstract、tldr、citation_count、influential_citation_count、url、open_access_pdf_url、fetched_at）、`library_paper_id`（按 paperId/CorpusId/arXiv id 匹配到的站内论文）。解析顺序：论文库 → 新鲜缓存（`ttl_days`，`not_found` 用 `not_found_ttl_days`）→ 合并成一次 S2 batch 请求。接口公开：匿名只读论文库与缓存（过期数据返回 `stale_cache`），需要抓取的 id 返回 `unavailable`；登录用户会抓取缺失项。

Internal serializer 额外返回派生的 `thinking_duration_ms` 和当前 viewer 的 `can_cancel`，不存 duration 计数：首输出前为 server-now − started，输出后为 first-chunk − started，无输出终止时为 finished − started。

### 6.4A QA User Preference

`qa_user_preferences` 以 `(user_id, qa_entry_id)` 为复合主键，保存当前 viewer 的 `background_color`（gray/brown/orange/yellow/green/blue/purple/pink/red）及时间戳；`null`/无行表示默认背景，entry 删除时级联清理。QA API 每条还返回 viewer-private 的 `background_color`、`highlight_count`、`note_anchor_count`。

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
         ├── 该模板已有 done Result → 跳过
         ├── 该模板已有 pending/running 的 Service Execution → 跳过
         └── 无结果且无进行中任务 → 创建 QA Entry + 提交 Service Execution
```

### 手动重新生成

- [重新生成] 按钮：强制提交新任务
- 模板提问：每次运行前从 `config.yml` 读取最新模板 prompt，并先写入 QA Entry
- 自由提问：创建 QA Entry 时先持久化原始问题；之后始终从 Entry 读取，问题不可更改，不依赖已有成功 Result
- 新 QA Result 追加到 results 数组
- 问题文本在提交 Service Execution 前已经落库；即使第一次模型调用失败或进程重启，列表仍能显示原问题并允许重新生成

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

## 笔记 (Notes)

按用户私有的、面向整篇论文的笔记。每 (用户, 论文) = **一篇 Markdown 大笔记**（单文档）。UI 文案统一用英文（Notes）。思维导图与 Walk-through 都是这篇文档的**派生视图**（由其 Markdown 标题结构推导），不再有笔记树。

### 数据模型

单表 `notes`（见 tech-stack.md）：每 (用户, 论文) 至多一行，整篇笔记就是一个 `body` 字符串；`(user_id, paper_id)` 唯一索引。无 `kind`/`parent_id`/`title`/`sort_order`、无结构化 anchor 字段（锚点写在 `body` 里，见下）。

- **惰性创建**：没有内容的论文在库中零行，首次写入时才建行。`PUT /api/papers/:id/note` upsert 整篇 body，乐观 `updated_at`（首次创建无需 `updated_at`，409 返回最新）。
- **可见性（公开/私有）**：`is_public`（整数 0/1，默认 0=私有，经 `toNote()` 在 API 边界转布尔）。`PUT /api/papers/:id/note/visibility { is_public }` 由属主切换（需已存在非空笔记，否则 400；匿名 401；**与 body 自动保存解耦**，不走乐观锁）。公开后任何人（含匿名）可读，详见下方「公开笔记」。
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
paperland://paper/<id>?pdf=<page>&rx=&ry=&rw=&rh=      // 跳到该页并高亮某个矩形区域（归一化 [0,1]，框选截图生成）
paperland://paper/<id>?qa=<entryId>[&result=<resultId>] // 某条 QA（及其某个回答），按 entry id 解析，链接里的论文 id 只作展示
```

- **QA 目标**：带 `qa` 时按 QA 处理，忽略 `h/s/e/pdf`。`MarkdownContent` 先调 `GET /api/qa/entries/:id/locate[?result=]` 找到 entry 实际所属论文再跳转（`/papers/<实际 id>?qa=…&result=…`），不可见/已删除时只 toast；`PaperDetail` 收到 `?qa=` 后用 `useBlockAnchor().revealQAEntry` 展开该 entry、切到指定回答 tab 并闪烁（本人列表里没有时自动切到 All 再找一次）。回答内某段文字仍用 `h/s/e` 定位。

- 目标分两类且互斥：**Markdown 块**（`h`/`s`/`e`）或 **PDF 页/选区/矩形**（`pdf` + `ts/te` 或 `rx/ry/rw/rh`）。同时带 `h` 和 `pdf` 时 **`pdf` 优先**；PDF 内 **`rect` 优先于 `ts/te`**，坐标非法则退化为仅跳页。跨论文点击把这些参数带进 `router.push` 的 query，`PaperDetail.handleAnchorFromRoute` 再还原成 `{page,rect}`/`{page,ts,te}` 导航。
- 定位基于**块的 `content_hash`**（与高亮同一指纹），不依赖问题/回答的 id 或下标——多模型多回答、重新生成、重排序都不会跑偏。
- `MarkdownContent` 给渲染容器挂 `data-content-hash`，并拦截 `paperland://` 链接点击：本页直接 `locateBlock`，跨页 `router.push('/papers/:id?h=...')`。
- `composables/useBlockAnchor.ts` 的 **`locateBlock(paperId, hash, range?)`**：① DOM 命中 → 滚动 + 闪烁；② 未命中（折叠 / 未激活 tab）→ 遍历 Q&A store 现算 hash 反查归属，展开 `Collapsible` + 激活对应 result tab（`requestedResultId`）后再定位；③ 找不到 → toast 失效、不跳转。有 `s`/`e` 时在块内按 offset 高亮该片段（复用 `useHighlight` 的 segment 逻辑）。
- 选区浮动工具栏（登录态）提供**两个复制按钮**，二者复制的都是同一个 `paperland://paper/<id>?h=<hash>&s=<start>&e=<end>` 锚点的 `[#]` 链接，区别只在**带不带正文**：
  - **复制内容和锚点链接**（`Copy` 图标，`copyContentAndAnchorLink`）：把**整段选区还原成 Markdown** 后，再追加一个紧凑的 `[#](paperland://...)` 锚点链接（形如 `<选区 Markdown> [#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)`）。还原用 `turndown` + `turndown-plugin-gfm`（整表→GFM 管道表）；数学公式从各 KaTeX 元素的 `x-tex` annotation 还原为 `$…$`（行内）/独立成行的 `$$…$$`（行间），并用占位符在 turndown 转义后再回填，保证 LaTeX 不被破坏；选区内的高亮 `<mark>` 会被剥离。
  - **复制锚点链接**（`Link2` 图标，`copyAnchorLinkOnly`）：只复制定位链接、不带正文，仍是紧凑的 `[#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)`（普通链接、**无** `!` 前缀，不是图片）。因为是普通 `[#]` 链接，粘贴进笔记后照样被点击拦截而可跳转（与「内容+锚点链接」走同一渲染/拦截路径）。

  两者都从 `pendingAnchorUrl()` 取同一个 URL，登录态（`paperId` 存在）才显示。锚点的 `s`/`e` 仍取渲染态偏移，跳转逻辑不变。
- **PDF 目标**走嵌入式 pdf.js 查看器（见 1.4「嵌入式 pdf.js 查看器」）：`MarkdownContent` 解析出 `pdf`/`ts`/`te` 后，本页直接调 `requestPdfNavigation(...)`（`composables/usePdfNavigation.ts` 的模块级 `requestedPdfTarget` ref，仿 `requestedResultId`），跨页 `router.push('/papers/:id?pdf=...&ts=...&te=...')`；`PaperDetail.handleAnchorFromRoute` 加载后读 query 设置同一 ref。`PaperViewerPanel` 监听该 ref 自动切到 "PDF" Tab，`PdfViewer` 监听后滚动到该页、把 `ts/te` 偏移映射回文本层矩形并画**临时高亮**（不落库，类似块锚点的闪烁）。`ts`/`te` 是该页**文本内容的字符偏移**（pdf.js `getTextContent()` 顺序，与高亮同一偏移模型），缩放无关。
- 锚定面覆盖 `MarkdownContent` 渲染文本（Q&A 回答、摘要/FAQ、笔记自身）**与 PDF 正文页/选区**；外部翻译 iframe 不可锚定。

### 共享状态与并发模型（`stores/notes.ts`）

整篇笔记在 store 里只有**一份响应式 `body` 字符串**（单一数据源），`tree = computed(parseNoteDoc(body))` 派生 heading-section 树。所有编辑面都直接写穿这份 body，无各自的本地快照；持久化是**整篇防抖保存**（1.2s）+ 乐观 `updated_at`，409 → 重载最新并关窗 + toast。

- **模态编辑上下文**（`panelMode: 'render' | 'edit' | 'split'`）：render 时左面板只读、靠思维导图/浮窗编辑；进入 edit/split（整篇直接编辑）会**先关闭所有浮窗**（`setPanelMode` → `closeForPaper`）。
- **结构变更关窗**：思维导图的拖拽/增/删/改名都是结构性改动（`applyStructural` → 快照入 undo 栈 + 写穿 + 关闭本论文所有浮窗）；`undo()` 弹栈回退。
- **浮窗严格绑定（防覆盖兜底，design D7）**：浮窗打开时记录 ① 结构指纹 `structureKey()`（仅 heading 层级+文本+顺序，排除正文）② 本小节正文基线。每次写回前比对，任一不符即**拒绝写回 + 弹冲突提示**（保留窗内文本供拷贝）。同标签页内靠关窗已避免冲突；该绑定主要兜跨标签页/异常（重载后指纹/基线不符）。
- **浮窗只改叶子、不产生结构**：窗内输入的任何 heading 在写穿时经 `demoteHeadings` 转加粗，故浮窗永不改文档结构。

### 浮动编辑窗口（`components/notes/`）

- **全站浮动窗口共用一套机制**：`stores/windows.ts`（store id `floating-windows`）管理所有浮动窗口——笔记 `section` / `doc`、Q&A 树 `qa-tree`、提问框 `qa-ask`——同一个 z-index 栈（从 200 起，按下即置顶）、同一种几何（`x/y/w/h`），可任意多个同时打开。尺寸记忆按种类（笔记 `paperland_note_window_size`，Q&A 树 `paperland_qa_tree_window_size`；提问框不记忆）。笔记窗口按 `${paperId}:${sectionId ?? 'preamble'}` 唯一键——一个 section 至多一个窗（再次打开只聚焦）；`closeForPaper` 只关笔记窗口，`closeKind(kind)` 关某一类。
- `components/FloatingWindow.vue`：**唯一的浮窗外壳组件**。默认外观带标题栏（拖标题栏移动、右侧关闭、`#actions` 插槽）；`bare` 外观无任何外壳，插槽内容（提问框卡片）本身就是窗口，按空白处拖动。两者都有右下角缩放手柄，手机端全屏。
- `NoteEditor.vue`：编辑**单个 section 的叶子正文**（中心节点 → 编辑前言）；三显示模式（Editor / Split / Preview）；编辑面用共享的 `MonacoMarkdownEditor`；预览用 `demoteHeadings(editBody)` 渲染（所见即所存）；写穿到 `store.updateLeaf(sectionId, text)` / `store.updatePreamble(text)`，1.2s 防抖 + 失焦/Ctrl+S/关窗即提交，IME 安全；冲突时顶部红条提示。标题栏显示该 section 的标题（只读——改名是结构操作，在思维导图里做）。
- `MonacoMarkdownEditor.vue`：**全站笔记编辑统一用的 Markdown 编辑器**（Monaco，替代原 `<textarea>`），同时用于浮窗（section/doc，`NoteEditor`）与左面板 edit/split（`NoteWalkthrough`）。Markdown 语法高亮（含 **LaTeX 数学**：`lib/monaco.ts` 用 `withMath` 扩展 Monaco 自带 markdown Monarch 文法，给 `$…$` 行内 / `$$…$$` 块级数学加 token，块内还高亮 `\命令` 与花括号——KaTeX 用的就是这套定界符）、**显示行号**、跟随明暗主题（`stores/theme` → 透明背景融入面板，`*.math` token 配色随主题）、**按需懒加载**（`lib/monaco.ts` 动态 `import()` 仅取 `editor.api` + markdown 文法；用 `editor.worker?worker` 注册到 `MonacoEnvironment`，Vite `worker.format:'es'`，故 Monaco 是独立 async chunk，不进首包）。散文化配置（自动换行、无 minimap/补全弹窗）。对外暴露 `v-model` 及 `compositionstart/end`、`blur`、`save`(Ctrl/Cmd+S)、`paste`(原生 `ClipboardEvent`) 事件与 `insertAtCursor()`/`focus()`/`getEditor()`，内部在 IME 合成期间不触发 `update:modelValue`（同 Vue v-model 语义）——**自动保存/IME 守卫/粘贴上传/heading 降级/冲突检测全部仍留在父组件**，零行为回归。注意 markdown 是自行 `register` + `setMonarchTokensProvider`（不走 `.contribution` 的惰性 loader），以免扩展文法被覆盖。
- `components/FloatingWindowHost.vue`：在 `App.vue` 挂载一次，用 `FloatingWindow` 渲染笔记窗口（`NoteEditor`）和 Q&A 树窗口（`QATreeView`）；提问框窗口由 `QAInput` 自己用同一外壳渲染。

### 分支思维导图（heading 派生）

`components/notes/NoteMindmap.vue` + 递归 `NoteNode.vue`：由文档 heading 结构派生的分支导图。**中心节点标为 `(root)`（其内容是前言）**，点它编辑前言；每个 heading 是一个节点（按相对深度成树），叶子正文非空时标题后显示灰色字符数徽章 `(N)`。连线由真实 DOM 位置量出的 SVG 曲线绘制（`data-nid` 用 section id）。点节点开其叶子浮窗；拖拽改父子（落到节点 → 成其子、落到中心/空白 → 顶层）= `store.reparent` 改写 heading。**节点操作收进 tooltip（节点正下方）**：四个操作（增子 `addChild`、增兄 `addSibling`、改名 `rename`、删除 `remove`；中心节点只有增子）不再内联在节点里，而在节点**正下方**弹出 tooltip（`Teleport` 到 body + `position:fixed`，避开 `.mm-canvas` 的 `overflow` 裁剪）。**桌面**（`(hover:none)` 为 false）：hover 出面板（140ms 延迟桥接、移进不消失），点击节点 = 编辑。**触屏**（无 hover）：为避免误触，点击节点改为**弹面板而非直接编辑**，面板额外带一个 **Edit** 按钮（`SquarePen`）打开编辑器，点击面板外（`document` capture pointerdown）关闭。中心节点不可拖拽/删除/增兄。表头 Undo 回退最近一次结构改动。**节点尺寸**：标题/中心节点与内容节点共用 `--nn-node-max-width`（`360px`，定义在 `.nn-node` 上）作为最大宽度；标题文本超宽时**换行显示完整内容**（`.nn-box { white-space: normal }` + `.nn-title { overflow-wrap: anywhere }`），不再用 `…` 省略号截断，字符数徽章 `(N)` 仍贴在标题旁（`.nn-count { flex-shrink: 0 }`）；节点因换行变高时，连线由 `NoteMindmap` 的 `ResizeObserver` 自动重新锚定。

**内容节点（leading blockquote）**：每个节点的内容块（中心=前言，heading 节点=叶子正文）开头若是连续的 blockquote（`>`），由 `lib/markdown-doc.ts` 的 `leadingBlockquotes()` 抽取成只读**内容节点**——`MarkdownContent` 渲染（纯文本/图文/公式），排在该节点所有 heading 子节点**之前**，不可点击/拖拽/编辑（合成 id `<parentId>#c<i>`，不作 drop target）。视觉上：标题节点整圈边框，内容节点只有「下半托盘」边框（`.nn-content::after`：左右下半 + 底边 + 下圆角），内容盛在上方；连到内容节点的连线也更细（`stroke-width` 1，与边框同宽，标题节点连线为 1.5）。最大宽度与标题节点共用 `--nn-node-max-width`（`360px`）。

### Walk-through / 文档视图（左面板，`NoteWalkthrough.vue`）

左侧面板对整篇大笔记的三模式视图（`store.panelMode`）：
- **render（默认）**：阅读型渲染——前言 + 各 section 的可点击、自动编号标题（`1.`、`1.1.`、`1.1.1.`，由 heading 层级在渲染时推导）+ 叶子正文（`MarkdownContent`，`:disable-highlights="true"`，因动态编号内容与基于内容哈希的高亮不兼容）。点标题开该 section 的浮窗。标题层级 `min(2+depth, 6)`，阅读型绝对 rem 字号（仅本视图）。
- **edit**：整篇 Markdown 编辑器（共享的 `MonacoMarkdownEditor`，`v-model` → `store.setBody`），可自由增删/重排 heading。
- **split**：编辑器 + render 并排。
- 进入 edit/split 关闭所有浮窗；任一改动（叶子/结构/整篇）都实时重渲染。无内容时显示「No notes yet」。

**功能栏**（`NoteWalkthrough` 顶部）：左侧 = 精读状态 button group（`Circle` In progress / `CircleCheck` Done，绑 `store.completed`/`store.toggleCompleted`；空笔记时 Done 禁用）+ Last updated 时间；右侧 = `?` 帮助（`NoteHelpDialog`：讲 heading+blockquote 生成思维导图、PDF 框选得图片链接）、**Pop out**（`store.openDocEditor()` 开整篇浮窗编辑器）、三模式开关。

**整篇浮窗编辑器**：`store.openDocEditor()` 开一个 `kind:'doc'` 浮窗（`windows.ts` 按 `${paperId}:doc` 唯一、与 section 浮窗互斥），`NoteEditor` 的 doc 分支直接绑 `store.body`（三视图、不降级 heading）。开启时左侧锁定 render（`store.docWindowOpen` → `NoteWalkthrough` 禁用 edit/split），避免同页两个活跃整篇编辑器；进 edit/split 或开 section 浮窗则关掉它。右栏 notes card 也有同一个入口。

### 入口与归属

- 论文详情页右栏 `PaperNotesCard`：即思维导图（中心节点 `(root)` + 各 heading）+ 标题栏一个 `ExternalLink` 打开整篇浮窗编辑器；匿名显示「Sign in to take notes」。**Kimi 自动摘要 card 紧贴 notes card 下方**。左侧查看器 `PaperViewerPanel` 的「Note」Tab（始终可用、由 Walk-through 改名）即三模式文档视图。
- **论文列表 note-status 列**（`views/PaperList.vue`）：按当前用户的 `GET /api/notes`（含 `completed`）建 `paperId → completed` 映射，每行显示三态图标——无笔记 `CircleDashed`（灰）、有笔记 `Circle`、精读完成 `CircleCheck`（primary）；点击 `?view=note` 跳到该论文 Note Tab。
- 独立 `/notes` 页（`views/NotesPage.vue`，`requiresAuth`）：每条笔记一行 + 客户端搜索（论文标题 + body + 作者）。**范围切换 Mine / All**（Mine = 自己的；All = 已发布 + 属主开启笔记共享的 + 自己的，admin 为全部，`GET /api/notes?scope=all`），别人的笔记显示作者 `username`；已发布显示 **Published**，`shared: false` 显示 **Private**（`include_private` 参数已废弃并被忽略）。点击：别人的笔记走 `?note=<id>` 深链（右侧面板自动展开该笔记），自己的笔记直接跳 `/papers/:id`（自己的笔记本就在自己的 Note Tab）。
- 访问控制沿用 auth：owner-scoped 读（匿名 `{ note: null }` 200）、写 `requireUser` + 属主校验；公开笔记的跨用户读是单独的、对匿名开放的路由（见下）。

### 公开笔记 (Public notes)

属主可把整篇笔记设为公开，供任何人（含未登录）只读查看其思维导图 + 全文。

- **后端跨用户读**（都不需要登录、各自在 handler 内做授权）：
  - `GET /api/papers/:id/public-notes` → 该论文**其他用户**中当前访问者可读的非空笔记的**无 body** 摘要列表（`{ id, user_id, username, is_public, shared, updated_at }`）：已发布（任何人）+ 属主开启笔记共享（登录用户）+ 全部（admin）；匿名只得已发布的、不排除任何作者。供右侧面板懒加载用。
  - `GET /api/notes/:noteId` → 单篇笔记全文 + 作者（`NoteWithAuthor`，含 `shared`）。授权：已发布 OR 属主 OR 管理员 OR（已登录且属主开启笔记共享），否则 **404**（不泄露存在性）。
- **右侧面板「Notes from others」**（`components/notes/PublicNotesPanel.vue`，挂在 `NoteWalkthrough` render 区底部）：挂载时拉 `public-notes` 列表，每条显示作者 + Published / Private 标记，**默认折叠 + 不渲染**；首次展开才 `GET /api/notes/:noteId` 取 body 并渲染。永不列出自己的笔记。匿名也可见。
- **只读渲染**（`components/notes/PublicNoteView.vue`）：**先思维导图、后全文**。思维导图复用 `NoteMindmap` 的 `readonly` + `doc` 模式（传入外部解析的文档树，禁用拖拽/undo/节点操作/点开编辑器；`NoteNode` 同步加 `readonly`）。全文用 `MarkdownContent` 的 `:public-note` 模式渲染——**Q&A/块锚点（`?h=`）失活为普通文本**（`.anchor-inert`，因为它只会对**当前查看者**的 Q&A 寻址、对别人的笔记无意义），**PDF 锚点（`?pdf=`）仍可点**。
- **属主操作**（`NoteWalkthrough` 顶部功能栏，仅自己的非空笔记可见）：发布/取消发布开关（`Globe`「Published」/`GlobeLock`「Publish」，绑 `store.setPublic`；发布 = 生成免登录可读链接，与 Account → Sharing 的笔记共享开关相互独立）；公开后出现 "Copy note link"（`Link2`，复制 `store.shareLink` = `<origin>/papers/<paperId>?note=<noteId>`）。
- **分享深链 `?note=<id>`**：`PaperDetail.handleNoteDeepLink` 先 `notesApi.getById` 取该笔记——若是**自己的**笔记则 toast 提示 "This is your own note — open it from the Note tab" 并**不自动展开**（它本就在自己的 Note Tab）；否则 `requestPublicNote(noteId)`。模块级 `composables/usePublicNoteOpen.ts` 的 `requestedPublicNote` ref（仿 `usePdfNavigation`）解耦：`PaperViewerPanel` 监听后切到「Note」Tab，`PublicNotesPanel` 监听（`immediate`，兼容「面板在请求之后才挂载」）后展开该条 + 懒取 body + 滚动到它，处理完清空请求。取不到（删了/不可读）→ toast「Note unavailable」并停留在论文页。

### 后端 API（`api/notes.ts`，owner-scoped + 公开读）

`GET /api/papers/:id/note`（返回 `{ note }` 或 `{ note: null }`；匿名 200 空；含 `completed` + `is_public` 布尔）、`PUT /api/papers/:id/note`（upsert 整篇 body + 乐观 `updated_at`；首次创建无需 `updated_at`，stale → 409 带最新；唯一索引冲突回读胜出者；**保留 `completed`/`is_public` 不动**）、`POST /api/papers/:id/note/completed`（`{ completed }` 切换精读完成；需已存在笔记行，否则 400；匿名 401；内联鉴权）、`PUT /api/papers/:id/note/visibility`（`{ is_public }` 切换公开；需已存在非空笔记，否则 400；匿名 401；内联鉴权）、`GET /api/papers/:id/public-notes`（其他用户公开非空笔记的无 body 摘要；免登录）、`GET /api/notes/:noteId`（单篇全文 + 作者；公开/属主/管理员可读，否则 404；免登录）、`GET /api/notes`（跨论文聚合，每篇一条 + `paper_title` + `username` + `completed` + `is_public`，排除空 body；`?scope=mine|all`（默认 mine；mine 匿名 401；all = 已发布 + 共享 + 自己，admin 全部，匿名仅已发布；每条带 `shared`；`include_private` 已废弃被忽略）；**鉴权在 handler 内联判断而非 `requireUser` preHandler**）。`completed`/`is_public` 在 SQLite 为 0/1，API 边界经 `toNote()` 转布尔。已移除旧的 tree 端点（create/move/subtree-delete/`PUT /root`）与 `ensureRoot`。

## Deep Research（`/research`）

独立的迭代式文献调研：agent（仅 Codex 模型，开启联网搜索）每轮输出一份完整的 Markdown **报告** + 一个分段的**论文列表**，二者构成一个**版本**；用户用自由文本反馈，agent 产出新的完整版本。openspec `deep-research`。

### 页面

- **`/research`**（`views/ResearchList.vue`，`AppPage` 收窄布局，侧边栏 Research / `Telescope`，需登录）：会话卡片（标题 = 当前版本的列表标题，未有版本时为截断的 topic；topic 摘要、步骤数、版本数、最新状态、更新时间；All 视图显示属主），右上 `ScopeToggle` + 「New research」。新建对话框：Topic + Codex 模型下拉（`/api/config/models` 中 `type: codex` 的模型，默认取 `models.default`，否则第一个）。
- **从 QA 回答起步**：`QAResultBody` 操作栏（done 且已登录）有 `Telescope`「Deep Research from this answer」链接 → `/research?new=1&seed_result=<resultId>`；列表页读取 query，调 `GET /api/research/seed-preview` 预填（topic 默认为原问题），对话框里显示来源论文与问题，并注明 "The answer is copied into this session; later changes to the Q&A do not affect it."。创建时后端再校验可见性并保存快照（`seed`：论文 id/标题、问题、回答、模型、result id）。
- **`/research/:id`**（`views/ResearchDetail.vue`，自管布局，标题经 `usePageTitle` 设为会话标题）：
  - 桌面（≥900px）两栏：左侧为**步骤时间线** + 下一轮输入框（owner 可见；Textarea + Codex 模型下拉，默认沿用最近一轮的模型，⌘/Ctrl+Enter 发送；有进行中回合时禁用），右侧为**版本视图**。窄屏单栏，版本视图在前。
  - 时间线：agent 回合显示序号、状态、模型、`Repaired` 标记（列表来自自动修复）、用户文本、`changes` 说明、「Version n」跳转；进行中回合流式渲染报告（`QAStreamingMarkdown`），`paperlist` 块开始后隐藏原始 JSON，显示「Generating paper list…」（自动修复期间为「Fixing paper list…」）；未产出版本的回合显示原因与可展开的原始回答；最新 agent 回合可 **Retry**（对话框可改文本和模型，替换该回合）、进行中可 **Cancel**。标题编辑步骤显示为一行虚线记录（改了哪些标题）。
  - **工具调用进度**：研究回合的 SSE 有 `tool` 事件（`ResearchToolEvent`：`server`、`tool`、`status`，不落库）。`stores/research.ts` 的 `toolActivity` 记录每个进行中回合的最近一次工具调用与调用次数（回合结束清除）；回合还没有输出文字时，占位从「Agent is thinking…」换成「Calling `s2_search`…」/「Searching the web…」，并附「· N tool calls」。工具本身见 tech-stack.md「Agent 工具（MCP）」。
  - 版本视图：版本下拉（所有历史版本可查看，默认当前版本）、Report / Papers 两个 tab。Report 以 `MarkdownContent` 的 qa-answer 模式渲染（`#cite` 一律经 S2 解析接口成 chip + 卡片，不依赖所属论文），下方折叠「References · N」（`PaperRefList`）。Papers 用 `ResearchPaperList.vue` → `PaperRefList` 的 sections 形态。
  - **从历史版本继续**：查看非当前版本时，owner 可点「Continue from this version」，确认框写明将**永久删除**的版本号范围与步骤数（不可撤销），确认后 `POST /api/research/:id/truncate`。在历史版本上点「Edit titles」也先走同一确认框。
  - **编辑标题**：只能改当前版本的列表总标题与各段标题（对话框），保存为一个新版本（`title_edit` 步骤，条目、comment、报告原样复制）；论文条目的增删改完全交给 agent。
  - 非 owner（他人共享的会话）只读：无输入框、重试、编辑、继续；admin 可删除。

### 论文列表的展示

- `PaperRefList`（与 QA 引用列表共用）支持：论文行（元数据由 `useS2Papers` 按 S2 id 解析）、**链接行**（agent 按 BibTeX @misc 填写的 `citation`：标题 + 作者 · 年月 · howpublished 或域名，新标签页打开，`Link` 标记）、`Unverified` 标记（id 解析不到时显示 id 与 S2 链接）、`New` 标记，以及每段下方折叠的「Removed · N」。comment 与 section description 是 Markdown，用 `MarkdownContent` qa-answer 模式渲染（可含 `#cite` chip）。
- **版本对比**（`lib/research-list.ts` 的 `sectionsForDisplay`）：与上一版本**逐段**比较——section 依次按「同位置同标题 → 同标题 → 同位置（改名）」匹配；条目键为论文 `s2_id`、链接规范化 URL；新条目标 `New`，该段消失的条目进入 Removed。同一条目可出现在多个 section。
- 列表格式相关的前端逻辑集中在 `lib/research-list.ts`（流式时拆分报告与 `paperlist` 块、版本对比、条目映射），视图不直接解析格式。

### 数据流

- `stores/research.ts`：会话列表（scope）、当前会话详情、Codex 模型列表；对当前会话中每个进行中的步骤开 SSE（`researchApi.stream`，`start` / `delta` / `repairing` / `done` / `error`，断线最多重连 5 次），步骤结束后重新拉取会话以更新标题与版本。
- Internal API（会话认证，全部需登录）：`GET/POST /api/research`、`GET /api/research/seed-preview`、`GET/DELETE /api/research/:id`、`POST /api/research/:id/steps`、`POST /api/research/:id/steps/:stepId/retry|cancel`、`PUT /api/research/:id/titles`、`POST /api/research/:id/truncate`、`GET /api/research/steps/:stepId/stream`（SSE）。409：有进行中回合时提交/编辑/回退、重试非最新步骤；400：非 Codex 模型、标题编辑带了标题以外的字段或空标题。


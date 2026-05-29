## Why

当前前端的"UI 框架"是一组手写的 Vue 组件 + 自定义 Tailwind 类（颜色 token、按钮 / 输入框 / 对话框等都是逐个 inline 写）。结果：

- 样式不一致：同样语义的按钮在 8 个文件里有 8 种不同的 `class`（`rounded-md p-1 text-gray-400 hover:...`）
- 可访问性缺失：原生 `<button>` / `<input>` 没有 focus ring、disabled、aria 状态的统一处理
- 维护成本高：调整一个视觉细节要在 26 个文件里逐个改
- 与生态脱节：用不上 shadcn 庞大的设计参考、reka-ui 提供的可访问性原语

shadcn-vue 提供了一套**已经做好可访问性、暗色模式、变体管理**的 Vue 组件库（基于 reka-ui），它的"代码即资产"理念让组件代码就在我们仓库里，能直接调整。同时 shadcn-vue 当前主线只支持 Tailwind v4，所以这次连带把 Tailwind v3 升到 v4。

## What Changes

- **BREAKING**（视觉）：颜色 token 从 HSL 蓝色体系换成 OKLCH olive 体系（preset `reka-mira`），现有页面整体配色会有改变
- **基础设施切换** —— 已实施（在本次 change 内提交）：
  - 移除 `tailwind.config.js`、`postcss.config.js`、`autoprefixer`、`postcss`
  - 升级 `tailwindcss` 至 v4，新增 `@tailwindcss/vite` 插件接管 Tailwind 处理
  - 新增 `shadcn-vue`、`reka-ui`、`tw-animate-css`、`@lucide/vue`
  - 移除 React 版本误装的 `lucide-react`、`radix-ui`、`shadcn`
  - `src/assets/main.css` 改写为 v4 风格（`@import "tailwindcss"` + `@theme inline` + OKLCH 主题变量）
  - 新增 `components.json`（shadcn-vue 配置，preset `reka-mira` / base `olive` / font `noto-sans`）
- **组件迁移**：将 13 个 component 与 6 个 view（共 26 个 `.vue`、3351 行）逐个改用 shadcn-vue 原生组件
  - 添加常用 primitive：`Button` / `Input` / `Textarea` / `Card` / `Dialog` / `Select` / `Tabs` / `Badge` / `Tooltip` / `DropdownMenu` / `Table` / `Alert` / `Separator` / `ScrollArea` / `Sheet` / `Command` / `Sonner` / `Collapsible`
  - 替换 96 个原生 `<button>` 为 `<Button>`、13 个 `<input>` 为 `<Input>`、4 个 `<textarea>` 为 `<Textarea>`、4 个 `<table>` 为 `<Table>`、2 个 `<select>` 为 `<Select>`
  - 用 shadcn-vue 的 `<Dialog>` / `<Sheet>` 替代手写的 modal / 抽屉
  - 删除组件级别手写的封装（自定义按钮、card 容器、tag 等），保留布局结构
  - 图标库统一到 `@lucide/vue`（preset 默认），逐步删除 `lucide-vue-next` 依赖
- **样式收敛**：每个组件迁移后，移除该组件文件里只为模仿 button / input / card 视觉而存在的 Tailwind utility，让组件 class 主要承担**布局**职责
- **标签统一外观**：所有 tag（包括论文 tag 和筛选 pill）统一走 shadcn-vue `<Badge>` 样式，不再使用 `tagsStore.getTagColor()` 的每标签自定义颜色。后端 `tag.color` 字段保留，颜色选择器仍可调，但显示层在本次重构期间统一使用 `variant="secondary"` 风格；后续可能再做统一调整
- **折叠 disclosure 统一**：HTML5 原生 `<details>/<summary>`（共 8 处，分布在 `QAList` Template/Free Q&A 条目和 `PaperDetail` Kimi 自动摘要 FAQ）全部换成 shadcn-vue `<Collapsible>` + `<CollapsibleTrigger>` + `<CollapsibleContent>`，外部用 reactive `openMap` 管理展开状态、保留 localStorage 持久化（QAList）和"全部展开/折叠"批量操作
- **列表整行按钮**：`InboxView` idea 选择项与 `QAFeedPanel` 卡片头部的 `<button>` 改用 `<Button variant="ghost">`，获得 shadcn focus ring / hover 状态
- **idea-forge 类别映射 DRY**：`IDEA_CATEGORIES` / `IDEA_CATEGORY_LABELS` / `IDEA_CATEGORY_VARIANT` 从 4 个组件的重复定义提取到 `src/lib/idea-categories.ts`
- **`IdeaDetail` 删除无效 `prose prose-sm` class**：项目未安装 `@tailwindcss/typography`，这两个 class 之前是 dead utility；`MarkdownContent` 的 scoped CSS 已经处理排版
- **Collapsible 动画补全**：shadcn-vue 装出的 `CollapsibleContent.vue` 是裸壳，本次为其补 `overflow-hidden` + `data-[state=open]:animate-collapsible-down` / `data-[state=closed]:animate-collapsible-up` 动画 class（依赖 `tw-animate-css` 已注册的 `--animate-collapsible-*` 主题 token），并改为接受外部 `class` prop via `cn()` 合并
- **TabsTrigger line variant 下划线偏移修正**：`TabsTrigger.vue` cva 中 `group-data-horizontal/tabs:after:bottom-[-5px]` → `-1px`。原偏移针对 TabsList 自带 border 的默认场景，在"wrapper 持有 border-b + TabsList 透明"的布局下会让 active 下划线落到分割线**下方**；改 1px 后下划线正好覆盖 wrapper 1px border
- **`MarkdownContent` 高亮工具栏 / 菜单 shadcn 化**：保留这套自定义浮动 widget（无对应 primitive），但 emoji（📝/🗑）替换为 lucide 图标（`StickyNote` / `Trash2` / `Save`），UI 文案改英文（Note / Delete / Save / Add note / Yellow/Green/Blue/Pink），CSS 配色（背景 / 边框 / hover / focus ring / destructive）全部主题 token 化；高亮调色板四色（yellow/green/blue/pink）作为内容语义保留
- **`QAPanelNav.vue` 主题化**：dot / label 颜色全部基于 `var(--foreground)` + 透明度梯度（解决之前 `--muted-foreground` olive 色相和 `--foreground` 中性灰色相不一致），active 改 `var(--primary)`；展开面板背景 `color-mix(in oklch, var(--popover) 96%, transparent)`；hover 用 `var(--accent)`；触发热区从 40px 缩减到 20px
- **视觉目标**：布局结构（栅格、分栏、间距大方向）保持基本一致；细节配色 / 圆角 / 字体随 shadcn-vue 默认走
- **`docs/frontend-architecture.md` 同步更新**：登记新的 UI 框架、新增的 primitive 清单、字体与主题变更

## Capabilities

### New Capabilities
（无，本次不引入新功能能力）

### Modified Capabilities
- `tailwind-ui`: 把"Tailwind CSS + Lucide icons + 自定义 Vue 组件"更新为"Tailwind v4 + shadcn-vue（reka-ui 原语）+ Lucide icons"，并把"原生 HTML 表单 / 按钮"的描述换为"shadcn-vue primitive"。各页面（sidebar / paper list / settings / service dashboard）的行为本身不变，但要求实现使用 shadcn-vue 组件并以 OKLCH 主题变量为颜色来源。

## Impact

- **Frontend 源码**：26 个 `.vue` 文件全部需要修改，主要集中在 `packages/frontend/src/components/*.vue` 与 `packages/frontend/src/views/*.vue`
- **新增目录**：`packages/frontend/src/components/ui/`（shadcn-vue add 生成的 primitive，每个组件一个目录或单文件）
- **构建配置**：`vite.config.ts`（新增 tailwindcss 插件）；删除 `tailwind.config.js`、`postcss.config.js`
- **依赖**：见上方依赖增删清单
- **图标**：`lucide-vue-next` → `@lucide/vue`（导入语句要全量替换）
- **视觉回归**：颜色 / 字体 / 圆角细节会变化；布局保持基本一致。需要肉眼回归所有页面：`/`、`/papers/:id`、`/qa/*`、`/services`、`/settings`、`/tags`、`/idea-forge/*`
- **后端 / API / 数据库**：不受影响
- **docs**：`docs/frontend-architecture.md` 与 `docs/tech-stack.md` 需要同步更新

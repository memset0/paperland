## Context

标签管理页 (`packages/frontend/src/views/TagManagement.vue`) 现状：用 `AppPage` 包裹，内部是 `space-y-1` 的竖排 `Card` 列表，一行一个标签，包含左侧色点 (`Popover` 调色板)、纯文本标签名（重命名时切换为行内 `Input`）、`Badge` 论文数、`#id`、可见性按钮、重命名/删除按钮（hover 显隐），以及合并/删除两个 `Dialog`。store (`stores/tags.ts`) 已有 `fetchTags / renameTag / mergeTag / deleteTag / updateTagColor / toggleVisibility`，但**没有 `createTag`**；后端 `api/tags.ts` 有 `GET / PATCH / POST :id/merge / DELETE`，**没有 `POST /api/tags` 创建端点**。

shadcn-vue 已完整集成，`components/ui/` 下已有本次需要的全部原语：`Table / DropdownMenu / Tooltip / Badge / Popover / Input / Button / Dialog / Sonner`。暗色模式由 `stores/theme.ts` 经 `.dark` 类 + OKLCH 变量驱动，页面自动继承。

约束：`tag-color-system` spec 已要求"所有标签展示处（含管理页）用标签自身颜色渲染"——当前管理页只在色点上体现颜色、标签名是纯文本，属欠实现；`docs/frontend-architecture.md` 里"管理页用 secondary Badge、不渲染 tag 颜色"的旧注释与该 spec 冲突，需一并更正。`tailwind-ui` spec 要求一律使用 shadcn 原语、主题色用语义 token（逐标签颜色属数据驱动 inline style，不受此限）。

## Goals / Non-Goals

**Goals:**
- 把页面重构为 shadcn `Table` 数据表格：列 = 颜色 / 名称 / 论文数 / 可见 / 操作。
- 名称列把每个标签渲染成**带其自身颜色的 Badge chip**，与论文列表/详情中的标签外观一致。
- 行内操作收进 `DropdownMenu`（⋯）；`title` → `Tooltip`；增删改结果用 `Sonner` toast 反馈。
- 顶部工具栏：按名称实时搜索、点击表头排序（名称/论文数/ID）、`+ 新建` 行内创建标签。
- 新增 `POST /api/tags` 后端端点 + store `createTag`，创建时分配随机调色板颜色。
- 同步 `docs/frontend-architecture.md`、`docs/external-api.md`。

**Non-Goals:**
- 不引入 `AlertDialog`——删除/合并确认沿用现有 `Dialog`。
- 不做批量多选/批量删除隐藏。
- 不改数据库 schema、不改 `tags` / `paper_tags` 表结构。
- 不改动论文列表/详情里标签的渲染（`TagBadge` 已按颜色渲染，本次仅复用）。
- 不引入分页（标签数量级小，搜索+排序足够）。

## Decisions

### 表格实现：shadcn `Table` 原语 + Vue computed 排序/过滤（不引入 @tanstack/vue-table）
用 `Table / TableHeader / TableBody / TableRow / TableHead / TableCell` 直接搭表，过滤与排序用本地 `computed`：`query` (ref, 名称大小写不敏感子串)、`sortKey` (`'name' | 'paper_count' | 'id'`)、`sortDir` (`'asc' | 'desc'`)，派生 `displayTags`。
- **为什么不用 @tanstack/vue-table**（论文列表用了它）：标签集规模小，且每行是交互密集单元（行内重命名 `Input`、调色板 `Popover`、`DropdownMenu`）。手写 computed 比让 tanstack 的列模型承载这些行内编辑更简单、更可控；引入 tanstack 反而要为 cell 渲染与编辑态额外绕路。
- 行以 `:key="tag.id"` 标识，保证排序/过滤重渲染时行内编辑态（按 id 记录）不丢失。

### 名称列 = 真彩 Badge chip，复用 `TagBadge.vue`
名称列直接复用论文列表/详情已在用的 `TagBadge.vue`，使全站标签外观一致（DRY）。若 `TagBadge` 当前未按 `color` 渲染或不接受所需 props，则做最小扩展（apply 阶段先核实其 API）。
- chip 配色采用**淡色调**方案（标签色低透明度背景 + 标签色文字/描边），而非实心填充 + 按亮度计算黑/白前景。理由：任意 hex 颜色在亮/暗两套主题下都需保证可读，淡色调无需逐色亮度运算即可在两种主题下都清晰，实现更稳。
- 重命名时该单元格切换为行内 `Input`（Enter 确认 / Esc 取消），逻辑沿用现有 `startRename/confirmRename/cancelRename`。

### 颜色编辑入口：保留色点 `Popover` 调色板
"颜色"列是一个小色块按钮，点击弹出现有 20 色 `Popover` 调色板（沿用 `TAG_COLOR_PALETTE` 与 `setColor`）。同一改色操作也在 `⋯` 菜单提供"修改颜色"项。
- 色点（编辑器）与名称 chip（预览）并存看似重复，但职责不同：一个是改色入口、一个是所见即所得预览。保留两者更易发现；若日后觉得冗余可合并为"点击 chip 改色"。

### 行操作收进 `DropdownMenu`
每行末列一个 `⋯` 触发的 `DropdownMenu`，项：重命名 / 修改颜色 / 显示·隐藏（随 `visible` 切换文案与图标）/ 删除（`destructive` 样式）。`title` 提示统一改用 `Tooltip`。

### 行内新建：表格顶部插入可编辑新行
点击 `+ 新建`（置于 `AppPage` 的 `#actions` 槽）在表体顶部插入一行：autofocus `Input` + 默认随机色块 + 保存/取消。
- 空名禁用保存；保存调用 store `createTag(name)`。
- 重名沿用 409：后端返回冲突时前端用 `toast.error` 提示"标签已存在"，不静默吞掉。
- 选择行内而非 `Dialog`：贴合用户明确选择的"行内新建"，少一层模态。

### 后端 `POST /api/tags`
新增路由：要求登录 (`requireUser`)、仅操作当前用户标签。body `{ name: string; color?: string }`；`name` 去空校验；按 `(user_id, name)` 查重，冲突返回 `409 { error: { code: 'TAG_NAME_CONFLICT' }, target_tag }`（与 PATCH 一致）；`color` 缺省时分配随机调色板颜色（复用现有标签创建路径的随机取色逻辑；若无共享 helper 则抽一个小函数）；插入后返回 `{ id, name, color, visible: true, paper_count: 0 }`。
- 前端：store 增加 `createTag(name)`（POST 后 `fetchTags()` 刷新缓存）；`client.ts` 已有 `api.post`，可直接复用，无需新封装。

### 工具栏与状态
- 搜索 `Input`（带 search 图标）置于表格上方一行；`+ 新建` 在 `#actions`；排序由表头点击驱动并显示升/降序 chevron。
- 三种空态分明：加载中（`Loader2` 旋转）、无标签（引导文案，沿用现有空态）、搜索无匹配（"无匹配标签"）。

## Risks / Trade-offs

- [任意标签色在暗色模式下对比度不足] → 名称 chip 用淡色调（标签色透明背景 + 标签色文字/描边），不做实心填充，避免逐色亮度计算；周围 UI 一律用语义 token。
- [行内编辑/新建态在排序或过滤重渲染时丢失] → 行 `:key` 用 `tag.id`，编辑/新建态按 id 记录于组件局部 state，重排不影响。
- [`POST /api/tags` 越权或重名] → 完全镜像 `PATCH /api/tags/:id` 的用户隔离与 409 逻辑；查重限定在当前 `user_id` 范围内。
- [复用 `TagBadge` 时其 props 不匹配] → apply 阶段先读 `TagBadge.vue` 确认 API，必要时做向后兼容的最小扩展，不破坏论文列表/详情既有用法。
- [色点列与名称 chip 视觉重复] → 接受此轻微冗余（编辑器 vs 预览职责不同），保留可发现性；列为后续可选优化。

## Migration Plan

纯前端重写 + 一个后端附加端点，无数据迁移、无 schema 变更。逐文件改动，回滚即还原文件。新端点为附加项，不影响既有 `GET/PATCH/merge/DELETE` 行为与其他用户数据。

## Open Questions

无阻塞项——布局（数据表格）与增强范围（搜索/排序/行内新建，不含批量）已与用户确认。

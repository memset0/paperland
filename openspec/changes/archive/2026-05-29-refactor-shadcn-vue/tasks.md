## 1. 基础设施切换（已完成）

- [x] 1.1 移除 React 版 shadcn 误装产物（`button.tsx`、原 `components.json`、`lucide-react`、`radix-ui`、`shadcn`）
- [x] 1.2 用 preset `a1Fgyxse` 跑 `bunx shadcn-vue@latest init`，生成 Vue 版 `components.json` 与 `utils.ts`
- [x] 1.3 装 `tailwindcss@4` + `@tailwindcss/vite`；卸 `autoprefixer`、`postcss`
- [x] 1.4 删 `tailwind.config.js`、`postcss.config.js`
- [x] 1.5 `vite.config.ts` 加 `tailwindcss()` 插件
- [x] 1.6 改写 `src/assets/main.css` 为 v4 风格（`@import "tailwindcss"` + `@theme inline` + OKLCH 变量）
- [x] 1.7 `bun run build` 通过

## 2. 安装 shadcn-vue primitive

- [x] 2.1 添加表单与基础原语：`bunx shadcn-vue@latest add button input textarea label`
- [x] 2.2 添加容器原语：`bunx shadcn-vue@latest add card separator scroll-area`
- [x] 2.3 添加交互原语：`bunx shadcn-vue@latest add dialog sheet dropdown-menu popover tooltip`
- [x] 2.4 添加导航与展示原语：`bunx shadcn-vue@latest add tabs badge alert table select checkbox`
- [x] 2.5 检查 `src/components/ui/` 下生成的所有 primitive 能正常 `import` 且 `bun run build` 通过

## 3. 迁移叶子组件

- [x] 3.1 `components/TagBadge.vue` —— 用 `Badge` 替换自定义 `<span>`，保留颜色映射逻辑
- [x] 3.2 `components/SourceTag.vue` —— 用 `Badge` 替换；arxiv → `destructive`，其他 → `secondary`
- [x] 3.3 `components/GlobalAlert.vue` —— 删除，改用 `sonner` Toaster；`error-bus.ts` 改为直接调用 `toast.error`；`App.vue` 引入 `<Toaster />`
- [x] 3.4 该阶段 `bun run build` 通过、人工过页面：tag 显示位置、警告弹窗

## 4. 迁移中层组件

- [x] 4.1 `components/QAInput.vue` —— `<input>` → `Input`、textarea → `Textarea`、发送按钮 → `Button`、容器 → `Card`、模型 chip → `Button` variant 切换
- [x] 4.2 `components/TagSelector.vue` —— 重构为 Combobox 模式：`Popover` + `Input` + `Button` 列表项；选中标签换 `Badge`，去除自定义弹窗 / pill / 蓝色配色
- [x] 4.3 `components/QAPanelNav.vue` —— 保持原样（自定义浮动 minimap 控件，shadcn-vue 无等价 primitive；scoped CSS 即组件定义）
- [x] 4.4 `components/QAResultView.vue` —— 多模型切换换 `Tabs`，单结果模型徽章换 `Badge`，所有操作按钮换 `Button`，删除 hover 用 `text-destructive`
- [x] 4.5 `components/MarkdownContent.vue` —— LaTeX 复制 toast 改用 `vue-sonner`，删除手写 toast Teleport + CSS；高亮工具栏/菜单保留（自定义浮动 widget）
- [x] 4.6 该阶段 `bun run build` 通过

## 5. 迁移大组件

- [x] 5.1 `components/QAList.vue` —— 两个外层卡片 → `Card`，状态徽章 → `Badge`，操作按钮 → `Button`，两个 modal → `Dialog`；颜色统一到 `text-primary`/`text-destructive`/`text-muted-foreground`
- [x] 5.2 `components/QAFeedPanel.vue` —— 外层卡片 → `Card`，徽章 → `Badge`，按钮 → `Button`，regen modal → `Dialog`
- [x] 5.3 `components/PaperViewerPanel.vue` —— viewer mode 切换 → `Tabs`，empty state SVG → `FileText` 图标
- [x] 5.4 `components/PdfViewer.vue` —— empty state SVG → `FileText` 图标；颜色用 `text-muted-foreground` / `bg-muted/40`
- [x] 5.5 该阶段 `bun run build` 通过

## 6. 迁移 views

- [x] 6.1 `views/PaperList.vue` —— `Table`、`Input`、`Button`、`Dialog`、`DropdownMenu`、`Tabs` 全用上
- [x] 6.2 `views/PaperDetail.vue` —— `Card` / `Button` / `Input` / `Textarea` / `Label` / `Badge` / `Dialog`；wide/narrow 双路径同步重写
- [x] 6.3 `views/Settings.vue` —— `Card` + `Table` + `Button` + `Badge` + `Alert`
- [x] 6.4 `views/ServiceDashboard.vue` —— `Card` + `Table` + `Badge` + `Select` + `Alert`
- [x] 6.5 `views/TagManagement.vue` —— `Card` 列表 + `Popover` 调色板 + `Dialog` 确认
- [x] 6.6 `views/QAPage.vue`
- [x] 6.7 `App.vue` —— 桌面侧栏用 `Tooltip` + `Button as-child`，移动抽屉用 `Sheet`
- [x] 6.8 该阶段 `bun run build` 通过

## 7. 迁移 idea-forge 子模块

- [x] 7.1 `views/idea-forge/IdeaManager.vue` —— `Tabs` 切换视图，`Button`+`Input`+`Badge`
- [x] 7.2 `views/idea-forge/ProjectList.vue` —— `Card` + `Button` + `Dialog`
- [x] 7.3 `components/idea-forge/ListView.vue` —— `Table` 重构，`Badge` variants 替代 categoryColors
- [x] 7.4 `components/idea-forge/KanbanView.vue` —— `Card` 卡片，**保留 `vuedraggable`**，丢掉 category 色块
- [x] 7.5 `components/idea-forge/InboxView.vue` —— `Badge` variants，accent token 高亮选中
- [x] 7.6 `components/idea-forge/IdeaDetail.vue` —— `Alert` 冲突提示，`Button`/`Input`/`Textarea`/`Label`/`Badge`
- [x] 7.7 `components/idea-forge/PaperDumpDialog.vue` —— `Dialog` + `Tabs` + `Input` + `Checkbox` + `Button` 重构
- [x] 7.8 `components/idea-forge/ScoreInput.vue` —— 颜色统一到 `text-foreground` / `text-muted-foreground/30`
- [x] 7.9 该阶段 `bun run build` 通过

## 8. 图标与依赖收尾

- [x] 8.1 全仓库 sed 替换 `from 'lucide-vue-next'` → `from '@lucide/vue'`
- [x] 8.2 处理被弃用的 `Github` brand 图标：App.vue 用 inline SVG 替代（lucide v1 因商标原因下架）
- [x] 8.3 `bun remove lucide-vue-next`
- [x] 8.4 `bun run build` 通过

## 9. 样式清理

- [x] 9.1 全局搜索 `text-gray-*` / `bg-gray-*` / `text-indigo-*` / `bg-indigo-*` / `text-emerald-*` / `text-amber-*` 等具体色阶——确认 `src/components` 与 `src/views` 下 `.vue` 文件均无残留
- [x] 9.2 删除残余仅为模仿组件视觉而写的 utility 串；保留布局相关的 utility
- [x] 9.3 `main.css` 滚动条 `bg-gray-*` 换成 `bg-muted-foreground/40`，所有页面背景文字颜色都用语义 token

## 10. 文档同步

- [x] 10.1 更新 `docs/frontend-architecture.md`：登记 shadcn-vue + reka-ui、Tailwind v4 主题机制、`src/components/ui/` 目录约定、新字体、迁移约定
- [x] 10.2 更新 `docs/tech-stack.md`：依赖清单替换

## 11. 最终验证

- [x] 11.1 `bun run build` 全绿
- [ ] 11.2 `bun run dev` 启动，逐页过：`/`、`/papers/:id`、`/qa/*`、`/services`、`/settings`、`/tags`、`/idea-forge/*`，关键交互（添加论文、编辑标签、Q&A、删除）跑通 —— 需要用户自行肉眼验收
- [x] 11.3 `git status` 清单内的 `packages/frontend/data/` 不存在（一致性检查）
- [x] 11.4 `npx openspec validate refactor-shadcn-vue` 通过

## 12. 追加迁移（用户复审后）

- [x] 12.1 装 `bunx shadcn-vue@latest add collapsible` primitive
- [x] 12.2 `QAList.vue` × 4 `<details>` → `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent`；改用 reactive `openMap` 管理展开状态（替代 DOM 查询）；`setAllOpen` 改为遍历 entry 列表
- [x] 12.3 `PaperDetail.vue` × 4 Kimi summary `<details>` → `Collapsible`（wide / narrow 路径各 2 处共享 `kimiOpenMap`）；`setAllKimiOpen` 同步改写
- [x] 12.4 `InboxView.vue` idea 选项整行 `<button>` → `<Button variant="ghost">`
- [x] 12.5 `QAFeedPanel.vue` 卡片头部整行 `<button>` → `<Button variant="ghost">`
- [x] 12.6 删除 `IdeaDetail.vue` line 206 的无效 `prose prose-sm` class（项目未装 typography 插件）
- [x] 12.7 新增 `src/lib/idea-categories.ts` 集中 `IDEA_CATEGORIES` / `IDEA_CATEGORY_LABELS` / `IDEA_CATEGORY_VARIANT`；`InboxView` / `ListView` / `KanbanView` / `IdeaDetail` / `IdeaManager` 全部改导入
- [x] 12.8 `bun run build` 通过

## 13. 验收 / 跟随调整

- [x] 13.1 `CollapsibleContent.vue` 补 `overflow-hidden` + `data-[state=*]:animate-collapsible-*` 动画 class（shadcn-vue 装出来是裸壳无动画），并接受外部 `class` prop via `cn()`
- [x] 13.2 `QAList.vue` `CollapsibleTrigger` 加回 `:data-qa-entry="entry.key"`；`QAPanelNav.vue` 改用 `[data-qa-entry]` + `data-state="closed"` 判断 + `trigger.click()` 打开折叠，并删除重复 localStorage 写入
- [x] 13.3 `QAPanelNav.vue` 配色全部用主题 token：dot/label 统一基于 `var(--foreground)` + 透明度梯度（避免 `--muted-foreground` olive 色相和 `--foreground` 中性灰的色相不一致），active 用 `var(--primary)`；展开面板背景 `color-mix(in oklch, var(--popover) 96%, transparent)`；hover 行用 `var(--accent)`
- [x] 13.4 `QAPanelNav.vue` 触发热区 `left: -40px` → `-20px`，宽度减半
- [x] 13.5 `PaperViewerPanel.vue` Tabs 重做：外层 wrapper 提供 `border-b` + `justify-center` + `bg-background`，`TabsList` 改 `variant="line"` 去掉默认 muted 背景，`TabsTrigger` override `data-active:text-primary data-active:after:bg-primary`
- [x] 13.6 `TabsTrigger.vue` cva 中 `after:bottom-[-5px]` → `-1px`，line variant 的 active 下划线对齐 wrapper border-b（之前默认偏移针对 TabsList 自带 border 的场景，不适合 wrapper-bordered 布局）
- [x] 13.7 `MarkdownContent.vue` 高亮工具栏 / 菜单：emoji（📝 / 🗑）→ lucide 图标（`StickyNote` / `Trash2` / `Save`）；UI 文案中文 → 英文（Add note / Note / Delete / Save / Yellow/Green/Blue/Pink）；CSS 配色全部主题 token 化（`var(--popover)` / `var(--border)` / `var(--accent)` / `var(--input)` / `var(--ring)` / `var(--destructive)` / `var(--radius-sm)`）；高亮调色板四色（yellow/green/blue/pink）作为内容语义保留不变
- [x] 13.8 `bun run build` 通过

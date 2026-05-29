## Context

Paperland 前端目前是 Vue 3 + Vite + Pinia + Tailwind v3，UI 组件全部手写——按钮 / 输入框 / 对话框 / Tag 等都通过 inline Tailwind utility 拼出来。

清单：
- 26 个 `.vue` 文件，3351 行（13 个 component + 6 个 view + 7 个 idea-forge 子组件）
- 96 个原生 `<button>`、13 `<input>`、4 `<textarea>`、4 `<table>`、2 `<select>`
- 颜色 token 在 `tailwind.config.js` 用 HSL 定义；图标用 `lucide-vue-next`

约束：
- 后端 / API / DB 不变，本次只动 frontend
- 整体布局结构（栏宽、分栏比例、间距大方向）保持基本一致，方便用户继续使用
- 单人维护项目，全量切换可以接受，不需要长期共存的过渡层

阶段 0（已实施）：
- 移除 React 版 shadcn 误装产物（`button.tsx`、`components.json`、`lucide-react`、`radix-ui`、`shadcn`）
- 用 preset `a1Fgyxse`（reka-mira / olive / noto-sans）跑通 `bunx shadcn-vue@latest init`
- Tailwind v3 → v4：删 `tailwind.config.js` / `postcss.config.js` / `autoprefixer` / `postcss`，加 `tailwindcss@4` + `@tailwindcss/vite`，重写 `main.css` 为 v4 风格

## Goals / Non-Goals

**Goals:**
- 所有 button / input / dialog / select / tag / card / table 等表单与容器原语统一用 shadcn-vue 组件
- 每个 `.vue` 文件内的 Tailwind utility 主要承担**布局**职责（grid / flex / spacing / responsive），不再承担"模仿 button 视觉"的职责
- 视觉风格统一到 shadcn-vue 默认（OKLCH olive 主题 + Noto Sans 字体）
- 所有页面布局可用，关键交互路径无回归
- 图标库统一到 `@lucide/vue`，删除 `lucide-vue-next` 依赖

**Non-Goals:**
- 不重构业务逻辑、Pinia store、路由结构
- 不动后端 / API / 数据库
- 不引入新功能能力（新增页面 / 新增交互）
- 不强求像素级还原原来配色——颜色 / 圆角 / 字体细节按 shadcn-vue 默认走
- 不做暗色模式的具体调优（preset 已带 `.dark` 变量，但不在本次范围内做暗色模式 QA）

## Decisions

### 决策 1：选 shadcn-vue 而非 PrimeVue / Naive UI / Element Plus

- **选 shadcn-vue 的原因**：
  - "代码即资产" —— primitive 代码直接落在 `src/components/ui/`，需要调整时直接改文件，不用 fork 第三方包
  - 基于 reka-ui（radix-vue 改名），可访问性原语扎实
  - 和 shadcn (React) 同源，未来切平台或参考资料丰富
  - 主题系统与 Tailwind 深度集成，CSS 变量直接驱动
- **其他方案的缺点**：
  - PrimeVue：组件丰富但定制能力受限，主题切换麻烦
  - Naive UI：API 强但是黑盒组件，不便于 inline 调整
  - Element Plus：风格偏中后台，需要大量样式 override

### 决策 2：Tailwind v3 → v4 一起做，不分两次

- **理由**：shadcn-vue 主线（2.x）只支持 v4；如果停在 v3 就用不上最新组件、`@theme inline`、CSS-first 配置
- **代价**：`tailwind.config.js` 删掉，颜色/字体配置移到 `main.css` 的 `@theme inline` 块；`bg-primary` 等 utility 仍可用，行为一致
- **回滚成本**：低 —— 改回 v3 等于把 `@theme inline` 反向写回 `tailwind.config.js`

### 决策 3：迁移按"叶子 → 中层 → views"分阶段，单 change

- **方案**：本次 OpenSpec change 内分阶段提交 commit，而不是多个 OpenSpec change
- **理由**：单人开发、目标一致、不存在中途换方向风险；分多个 change 反而增加 OpenSpec 元数据负担
- **阶段**：
  1. 安装 primitive（Button / Input / Card / Dialog / Select / Tabs / Badge / Tooltip / DropdownMenu / Table / Textarea / Alert / Separator / ScrollArea / Sheet）
  2. 迁移叶子组件：`TagBadge`、`SourceTag`、`GlobalAlert`
  3. 迁移中层组件：`QAInput`、`TagSelector`、`QAPanelNav`、`QAResultView`、`MarkdownContent`（顶栏部分）
  4. 迁移大组件：`QAList`、`QAFeedPanel`、`PaperViewerPanel`、`PdfViewer`
  5. 迁移 views：`PaperList`、`PaperDetail`、`Settings`、`ServiceDashboard`、`TagManagement`、`QAPage`
  6. 迁移 idea-forge：`IdeaManager`、`ProjectList`、`ListView`、`KanbanView`、`InboxView`、`IdeaDetail`、`PaperDumpDialog`、`ScoreInput`
  7. 清理：删除 `lucide-vue-next`、删除残余自定义按钮 / 容器样式
- **每阶段 commit**：每个阶段结束后跑 `bun run build` + 肉眼过相关页面，通过再 commit，便于回滚

### 决策 4：图标从 `lucide-vue-next` 切到 `@lucide/vue`

- shadcn-vue preset 默认引入 `@lucide/vue`，组件内部也用它
- 现有代码导入语句要全量替换：`from 'lucide-vue-next'` → `from '@lucide/vue'`
- 图标名一致（PascalCase 同名），不需要改图标名
- 在阶段 7 清理完所有 `lucide-vue-next` 引用后，移除该依赖

### 决策 5：保留 `vuedraggable` 不替换

- shadcn-vue 没有拖拽 primitive，且 `vuedraggable` 在 idea-forge 看板里被深度使用
- 跨框架切换成本大于收益，本次不动

### 决策 6：自定义滚动条 CSS 保留

- `main.css` 里的 `::-webkit-scrollbar` 规则保留，是 app-wide 视觉细节，不属于组件级样式

## Risks / Trade-offs

- **[视觉回归] 颜色 token 从 HSL 蓝换到 OKLCH olive，所有 `bg-primary` / `text-primary` 等位置整体偏移** → 接受。用户已认可"配色随 shadcn-vue 默认"。每阶段结束后过一遍页面截图对比
- **[视觉回归] 字体从 Inter 换到 Noto Sans Variable，全局排版有差异** → 接受，是 preset 的一部分。如果后期不满意可在 `@theme inline` 里换 `--font-sans`
- **[隐藏依赖] 某些手写组件依赖了具体的 Tailwind class 行为（如 `peer-checked` / `group-hover`），换组件后失效** → 迁移每个组件时单独测试该组件涉及的交互
- **[primitive 缺位] shadcn-vue 没有某个需要的组件（如分页、复杂日历）** → 现有用法以基础 primitive 为主，缺位概率低；如真缺，用基础 primitive 自己拼，不引入额外库
- **[`@lucide/vue` 与 `lucide-vue-next` 同时存在] 中间阶段 bundle 会膨胀** → 接受，最后阶段（任务 7）清理掉
- **[Vuetify 残留] 历史上是 Vuetify，可能有遗漏的 import** → grep 一遍确认；上次的 spec 已说明替换为 Tailwind，应该已清除
- **[暗色模式被引入但未测试]** → preset 带的 `.dark` 变量会被引入。如果暂时不切换 `.dark` class，亮色模式不受影响。明确写在 Non-Goals

## Migration Plan

按 Decisions 决策 3 的阶段顺序推进。每个阶段后：

1. 跑 `bun run build`（必须通过）
2. 跑 `bun run dev`，肉眼过相关页面
3. 该阶段单独 commit

无需 feature flag —— 是单纯的代码替换，没有 runtime 切换需求。

回滚：以 commit 为单位 `git revert`。最差情况整批 revert，回到阶段 0 完成的状态。

## Open Questions

- **是否保留 `@fontsource-variable/noto-sans`？** 已确认走 shadcn-vue 默认，保留。
- **是否在本次顺便清理已存在但未使用的 `MarkdownContent.vue` 内大量自定义 CSS？** 倾向于保留 —— 该文件用 v-html 渲染 Markdown，CSS 是给生成内容用的，不属于"模仿组件"范畴。后续如果需要可单开 change。
- **`PdfViewer.vue` 是否需要换 primitive？** 该组件只是 `<iframe>` 容器，几乎没有 UI，迁移工作量最小。

## 1. 后端：创建标签端点

- [x] 1.1 在 `packages/backend/src/api/tags.ts` 新增 `POST /api/tags` 路由：`requireUser`，body `{ name: string; color?: string }`，对 `name` 去空白校验
- [x] 1.2 在当前 `user_id` 范围内查重 `(user_id, name)`，冲突时返回 `409 { error: { code: 'TAG_NAME_CONFLICT', message }, target_tag: { id, name, color } }`（与 PATCH 行为一致）
- [x] 1.3 未提供 `color` 时分配一个随机调色板颜色（复用 `utils/tag-colors.ts` 的 `randomTagColor()`），插入后返回 `{ id, name, color, visible: true, paper_count: 0 }`（成功 201）

## 2. 前端：store 与 client

- [x] 2.1 在 `packages/frontend/src/stores/tags.ts` 新增 `createTag(name, color?)`：裸 `fetch` POST `/api/tags`（与 `renameTag` 一致以就地处理 409），成功后 `await fetchTags()`，返回值暴露冲突信息供页面提示
- [x] 2.2 确认 `client.ts` 现有 `api.post` 足够通用 POST；但 `createTag` 为就地处理 409、避免全局错误 toast，刻意改用裸 `fetch`（无需新增封装）

## 3. 前端：标签管理页重写为数据表格

- [x] 3.1 读 `TagBadge.vue` 确认其原本仅渲染中性 `secondary`；为其加可选 `color` prop（向后兼容）：传入时渲染淡色调真彩 chip，论文列表/详情不传 → 外观不变
- [x] 3.2 用 shadcn `Table / TableHeader / TableBody / TableRow / TableHead / TableCell` 重写 `TagManagement.vue` 主体，列顺序：可见 / ID / 名称 / 论文数（+ 末尾 `⋯` 操作列）；**不单设颜色列**（颜色由名称真彩 chip 体现）；不分页、不内部滚动，默认展示全部；保留 `AppPage` 包裹
- [x] 3.9 该页所有 UI 文案改为英文（New / Visible / ID / Name / Papers / Rename / Change color / Hide·Show / Delete / 占位符 / toast / 对话框 / 空态）
- [x] 3.3 改色入口：收在 `⋯` 菜单的「修改颜色」`DropdownMenuSub` 子菜单 + 新建行的行内色块 `Popover`（沿用 `TAG_COLOR_PALETTE` 与 `setColor`）
- [x] 3.4 "名称"列：用 `TagBadge`（传 `color`）渲染真彩 chip；重命名时切换为行内 `Input`（Enter 确认 / Esc 取消），沿用现有重命名与合并冲突流程
- [x] 3.5 "操作"列：`⋯` 触发的 shadcn `DropdownMenu`，项为 重命名 / 修改颜色（`DropdownMenuSub` 子菜单调色板）/ 显示·隐藏 / 删除（`variant="destructive"`）；移除行内常驻图标按钮组
- [x] 3.6 把原生 `title` 提示替换为 shadcn `Tooltip`（可见性按钮）；页面内复用 `App.vue` 已挂的 `TooltipProvider`，不再本地套
- [x] 3.7 增 / 改 / 合并 / 删除的成功与失败接入 `vue-sonner` `toast`；保留重命名行内错误兜底
- [x] 3.8 删除 / 合并确认沿用现有 `Dialog`（改为从 `DropdownMenu` 触发），不引入 AlertDialog

## 4. 前端：工具栏（搜索 / 排序 / 行内新建）

- [x] 4.1 表格上方加搜索 `Input`（search 图标），`query` ref 按名称大小写不敏感子串实时过滤；右侧统计「可见 N / 共 M」（`visibleCount` / 总数）
- [x] 4.2 表头可点击排序：`sortKey ∈ {name, paper_count, id}`、`sortDir ∈ {asc, desc}`，点击切换并显示升/降序 chevron（非激活态显 `ArrowUpDown`），默认按名称升序；派生 `displayTags` computed 供 `TableBody`
- [x] 4.3 行 `:key="tag.id"`，确保排序/过滤重渲染时行内编辑/新建态（按 id 记录）不丢失
- [x] 4.4 `AppPage` 的 `#actions` 槽加 `+ 新建` 按钮：点击在表体顶部插入可编辑新行（autofocus `Input` + 默认随机色块，可点开调色板改色 + 保存/取消）
- [x] 4.5 新建行：空名禁用保存；保存调用 `createTag`；重名 409 用 `toast.error` 提示"标签已存在"，不静默吞掉
- [x] 4.6 三种空态分明：加载中（`Loader2`）、无标签（引导文案）、搜索无匹配（"无匹配标签"）

## 5. 文档同步

- [x] 5.1 更新 `docs/frontend-architecture.md` 标签管理页一节（数据表格 + 真彩 chip + 工具栏 + 行内新建 + store `createTag`），并修正"管理页用 secondary Badge、不渲染 tag 颜色"的过时约定为"`TagBadge` 默认中性、传 `color` 时真彩，管理页用真彩"
- [x] 5.2 在 `docs/frontend-architecture.md` 标签管理 Internal API 小节记录 `POST /api/tags`（请求体、随机配色、201、409 冲突、401 匿名）。说明：内部 `/api/tags` CRUD 属 Internal API，记于 `frontend-architecture.md`；`external-api.md` 仅覆盖 Bearer/Zotero 的 External API，故不写在那里（对原计划的落点修正）

## 6. 验证

- [x] 6.1 `vite build` 前端构建通过（SFC 编译 + 导入解析无误）。交互式 UI 走查（真彩 chip / 搜索 / 排序 / 改色 / 重命名+合并 / 可见性 / 删除 / 行内新建 / 暗色模式可读）需人工 `bun run dev` 眼检——后台环境无浏览器，留待用户确认
- [x] 6.2 新增 `packages/backend/src/api/tags.test.ts`（HTTP 层 `app.inject`）：创建+随机配色 / 显式配色 / 空名 400 / 重名 409 无重复 / 跨用户同名隔离 / 匿名 401，**6/6 通过**（仅运行该文件，无外部调用）

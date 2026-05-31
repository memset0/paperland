## Why

标签管理页 (`/tags`, `TagManagement.vue`) 目前是一个朴素的"一行一标签"竖排卡片列表：标签名是纯文本，颜色只体现在左侧一个小圆点上，重命名/可见性/删除三个图标按钮常驻行内（hover 显隐），且没有搜索、排序、或在本页新建标签的能力。当标签变多时既不易浏览也不易管理。本次重构把它升级为一个更美观、信息密度更高、操作更聚合的 **shadcn 数据表格**，并补齐"在本页新建标签"这一长期缺失的入口。

## What Changes

- 页面布局由竖排卡片列表改为 **shadcn `Table` 数据表格**，列为：颜色 / 名称 / 论文数 / 可见 / 操作。
- **名称列把每个标签渲染成带其自身颜色的 shadcn `Badge` 药丸**（真彩 chip 预览），让管理页与论文列表/详情中的标签外观一致——这本就是 `tag-color-system` 已有的要求，当前实现只在小圆点上体现颜色，属于欠实现。
- 行内的重命名 / 改色 / 可见性 / 删除操作收进 **shadcn `DropdownMenu`（⋯ 菜单）**，行内不再平铺多个图标按钮。
- 原生 `title` 提示统一改为 **shadcn `Tooltip`**；新建 / 重命名 / 改色 / 合并 / 删除的结果反馈接入 **`Sonner` toast**（成功与失败均有提示，替代当前仅有的行内红字）。
- 顶部新增工具栏：**按名称实时搜索过滤**、**可点击表头按 名称 / 论文数 / ID 排序**（默认按名称升序）、**「+ 新建」按钮以行内方式创建新标签**。
- **新增 Internal API `POST /api/tags`** 创建标签端点（创建时按 `tag-color-system` 既有规则分配一个随机调色板颜色），并在前端 store / client 增加对应 `createTag` 方法。
- 删除 / 合并确认沿用现有 shadcn `Dialog`（不引入 AlertDialog，保持范围聚焦）。
- 同步更新 `docs/frontend-architecture.md`（标签管理页一节 + 修正"管理页用 secondary Badge、不渲染 tag 颜色"的过时约定 + 在标签管理 Internal API 小节记录新增的 `POST /api/tags`）。注：内部 `/api/tags` CRUD 属 Internal API，文档归 `frontend-architecture.md`；`external-api.md` 仅覆盖 Bearer/Zotero 的 External API，故不在此处改动。

## Capabilities

### New Capabilities
<!-- 无新增 capability —— 全部为既有 capability 的需求修订 -->

### Modified Capabilities
- `tag-management`: 标签列表展示由列表改为数据表格并新增 搜索 / 排序 / 行内新建 三项能力；新增 `POST /api/tags` 创建端点。
- `tag-color-system`: 明确管理页把每个标签渲染为其自身颜色的 Badge chip（不再只是色点），且新建端点按既有规则分配随机调色板颜色。

## Impact

- **前端**：`packages/frontend/src/views/TagManagement.vue`（重写为数据表格 + 工具栏 + 行内新建）、`packages/frontend/src/stores/tags.ts`（新增 `createTag`）、`packages/frontend/src/api/client.ts`（如需新增 POST 封装）。复用既有 shadcn 原语：`Table`、`DropdownMenu`、`Tooltip`、`Badge`、`Popover`、`Input`、`Button`、`Dialog`、`Sonner`（均已在 `components/ui/`）。
- **后端**：`packages/backend/src/api/tags.ts` 新增 `POST /api/tags` 路由（要求登录、按用户隔离、`(user_id, name)` 唯一冲突返回 409、分配随机颜色）。
- **API**：新增 Internal API `POST /api/tags`，无破坏性变更。
- **数据库**：无 schema 变更（沿用 `tags` / `paper_tags` 表）。
- **文档**：`docs/frontend-architecture.md`（标签管理页 + Internal API 小节）。
- 非破坏性变更，不影响其他用户或现有标签数据。

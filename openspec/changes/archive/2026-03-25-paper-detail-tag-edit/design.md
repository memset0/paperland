## Context

PaperDetail.vue 有两处标签展示（宽屏 split view 的右侧面板、窄屏 single column），均使用 TagBadge 组件渲染。需要在标签区域增加编辑能力。已有 TagSelector 组件和 `PUT /api/papers/:id/tags` API 端点可复用。

## Goals / Non-Goals

**Goals:**
- 在详情页点击编辑按钮进入标签编辑模式
- 编辑模式下使用 TagSelector 组件（搜索、选择、创建标签）
- 保存后刷新论文详情和标签颜色缓存

**Non-Goals:**
- 标签重命名/删除/颜色修改（在标签管理页面完成）
- 批量操作

## Decisions

### 1. 编辑模式切换

**选择**: 标签区域标题旁加 Pencil 图标按钮，点击切换为编辑模式。编辑模式下显示 TagSelector + 保存/取消按钮。保存后退出编辑模式。

### 2. 保存方式

**选择**: 使用 `PUT /api/papers/:id/tags` 全量替换。TagSelector 的 v-model 维护完整的标签名列表，保存时一次性提交。

### 3. 两处标签展示共用逻辑

**选择**: 提取为同一个 `editingTags` ref 和 `saveTags()` 函数，两处模板共用状态。只有当前可见的那一处会渲染编辑 UI。

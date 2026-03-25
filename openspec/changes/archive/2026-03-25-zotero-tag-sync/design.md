## Context

Zotero 插件（`packages/zotero-plugin/`）当前通过 `resolvePaperId()` 调用 `GET /external-api/v1/papers/full?arxiv_id={id}&auto_create=true` 获取/创建 Paperland 中的论文记录，然后在侧边栏 iframe 中显示论文详情页。标签同步需要在此流程中增加一步。

后端 External API 已有 `PATCH /external-api/v1/papers/:id/tags` 端点，接受 `{ add: string[] }` 参数，自动创建不存在的标签并分配随机颜色。

## Goals / Non-Goals

**Goals:**
- Zotero item 标签自动同步到 Paperland（增量添加）
- 同步在用户选中论文时自动触发
- 面板状态行展示同步结果

**Non-Goals:**
- 双向同步（不从 Paperland 同步标签回 Zotero）
- 删除标签（Zotero 中移除标签不会从 Paperland 删除）
- 标签颜色映射（Zotero 标签颜色与 Paperland 独立）
- 标签管理 UI（Paperland 前端已有标签管理页面）
- 批量标签同步（每次只处理当前选中的论文）

## Decisions

### 1. 仅增量添加，不同步删除

**选择**: `PATCH` with `{ add: [...] }`，不传 `remove`。

**理由**: 用户可能在 Paperland 中手动添加了标签，删除逻辑会误删。Zotero 标签和 Paperland 标签不一定完全对应。增量添加是最安全的策略。

### 2. 同步时机：面板渲染时

**选择**: 在 `panel.ts` 的 `onAsyncRender` 中，resolve paper ID 成功后立即同步标签。

**替代方案**: 独立的定时同步 → 过于复杂，且 Zotero 插件沙箱限制不利于后台任务。

### 3. Zotero 标签提取方式

**选择**: `item.getTags()` 返回 `Array<{ tag: string, type: number }>`，提取所有标签名。type 0 = 用户手动标签，type 1 = 自动标签，均同步。

### 4. 空标签列表不发请求

**选择**: 如果 Zotero item 没有标签，跳过 API 调用，不做无意义的请求。

### 5. 同步失败不阻塞面板

**选择**: 标签同步失败（网络错误等）不影响面板正常显示论文详情。错误静默记录到 console，面板状态行不展示错误。

## Risks / Trade-offs

- **重复同步**: 每次选中同一论文都会重新同步标签。但 API 端点是幂等的（重复 add 是 no-op），开销很小。
- **Zotero 自动标签**: type=1 的自动标签（如 Zotero 从 PDF 元数据提取的标签）也会被同步，可能引入噪声。但过滤它们会丢失用户有意保留的自动标签。目前不过滤。

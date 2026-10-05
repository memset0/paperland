## Why

用户需要像 Notion callout 一样，用非常淡的背景色快速区分重要 QA；该标记是个人阅读状态，同一条 QA 在不同用户视角下应当互不影响，并需要跨设备持久化。

## What Changes

- 新增 `qa_user_preferences` 表，以 `(user_id, qa_entry_id)` 唯一保存 `background_color` 和时间戳。
- 固定 Notion 风格 palette 为 `gray`、`brown`、`orange`、`yellow`、`green`、`blue`、`purple`、`pink`、`red`；`null` 表示清除并删除/归零 preference。
- 登录用户可给任何可见 QA entry 设置个人背景色，包括 Preset Q&A 和 all scope 中其他用户提出的 QA。
- API 只返回当前 viewer 的颜色，不暴露其他用户 preference；匿名 viewer 不读取或写入颜色。
- PaperDetail 与 `/qa` feed 的折叠/展开容器使用同一淡色、主题感知样式，并提供紧凑颜色选择器。
- 删除 QA entry 时清理相应 preferences；论文删除级联保持事务安全。
- 不改变 QA 所有权、回答内容、Service 状态或 scope 行为。
- 同步更新三份 `docs/` 架构文档。

## Capabilities

### New Capabilities

- `qa-entry-background-colors`: 每用户 QA 背景色的 palette、API、持久化和前端呈现。

### Modified Capabilities

- `database-schema`: 新增 `qa_user_preferences` 表、唯一键和删除关系。
- `data-ownership`: QA preference 严格按当前 viewer 私有。
- `qa-display-split`: PaperDetail QA entry 增加背景色控制与折叠/展开样式。
- `qa-feed-page`: Feed entry 使用同一背景色与控制。

## Impact

- Backend/database: Drizzle schema/migration、QA preference API、QA read enrichment、paper deletion。
- Frontend/shared: QA response types、store、QAList/QAFeedPanel 的 palette control 与主题样式。
- Docs: `frontend-architecture.md`、`external-api.md`、`tech-stack.md`。

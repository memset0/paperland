## Why

User Q&A 当前默认按 owner 隔离，只有管理员 feed 能切换查看全部用户；普通登录用户无法在论文详情或 Q&A feed 中选择查看其他人的问题。将“读取范围”和“写入所有权”分开，可以让回答成为可共享阅读资源，同时保留个人管理边界。

## What Changes

- `GET /api/papers/:id/qa` 与 `GET /api/qa/free` 支持 `scope=mine|all`，默认 `mine`。
- 所有登录用户均可选择 `all`；匿名访问论文 QA 时仍只返回公开 Preset Q&A。
- all scope 中每条 User Q&A 返回 `user_id` 与 `username` 并在前端标示提问者。
- 查看别人 User Q&A 不授予写权限：owner 可管理自己的 entry/result，管理员保留管理能力，普通查看者不显示 regenerate/delete 操作且后端继续校验。
- 论文详情 User Q&A card 与 `/qa` feed 都提供 mine/all 选择；切换 scope 从第一页/当前论文重新读取。
- 不改数据库 schema：`qa_entries.user_id` 与 `users` 已足够。
- Preset Q&A 的公开读取、ServiceRunner、模型执行和 External API 行为不变。
- 同步更新三份 `docs/` 架构文档。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-ownership`: User Q&A 从严格 owner-only read 改为默认 mine、登录用户可显式 all；写操作仍 owner/admin。
- `qa-display-split`: 论文详情 User Q&A card 增加 scope 选择、提问者标签和只读操作门控。
- `qa-feed-page`: `/qa` feed 的 all scope 从管理员专属改为所有登录用户可用。

## Impact

- Backend: `api/qa.ts` 查询、鉴权、分页与批量 username 解析。
- Frontend/shared: QA store scope、PaperDetail User Q&A card、QAPage/QAFeedPanel、共享响应类型。
- Database: 无迁移。
- Docs: `frontend-architecture.md`、`external-api.md`、`tech-stack.md`。


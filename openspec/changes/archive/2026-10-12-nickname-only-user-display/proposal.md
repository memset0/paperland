## Why

首页排行榜目前同时显示昵称和登录用户名，与其他共享列表的昵称优先规则不一致。普通用户看到其他用户姓名时，应只看到已设置的昵称。

## What Changes

- 普通用户可访问的姓名标签、排行榜领奖台和后续排名表、悬停提示使用昵称；没有昵称时回退到用户名。
- 核查 Q&A、笔记、引用链接及高亮等共享列表，确保遵循同一规则。
- 保留账户编辑和管理员用户管理中用于管理登录账户的字段。
- 同步更新三份架构文档。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-accounts`: 明确普通用户看到其他用户姓名时只显示昵称，不附加用户名。
- `home-dashboard`: 排行榜和悬停提示改为只显示昵称，缺省回退用户名。

## Impact

Frontend: Home usage display formatter and audit of shared attribution UI. Docs: frontend-architecture.md, external-api.md, tech-stack.md. No API payload, database, authentication or dependency changes.

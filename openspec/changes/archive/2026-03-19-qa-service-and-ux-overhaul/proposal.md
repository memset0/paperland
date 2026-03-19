## Why

QA 目前独立于服务体系之外运行——不记录到 `service_executions`、不在服务面板展示、不受 `max_concurrency` 限制。重启后进行中的 QA 永久卡死（status 停留在 running/pending），且所有服务都存在此问题。前端 UX 方面，Free QA 与 Template QA 分区展示增加了认知负担，输入框嵌在列表底部不便操作。

## What Changes

- **QA 服务集成**: 将 QA 纳入 `service_runner` 体系，每次 QA 调用记录到 `service_executions` 表，遵守 `max_concurrency` 和 `rate_limit_interval`，在服务面板可见并可重新提交
- **启动时清理卡住的服务**: 后端启动时将所有 `pending`/`running` 状态的 `service_executions` 和 `qa_entries` 重置为 `failed`（标注 "interrupted by restart"），用户可在服务页面或 QA 页面手动重新提交
- **统一 QA 列表**: Free QA 条目与 Template QA 合并到同一个折叠列表中（free 在上方），每条均为可折叠展开，折叠状态通过 `localStorage` 持久化
- **浮动输入框**: 提问输入区域改为页面底部固定悬浮，圆角多行输入框 + 模型选择 + 提交按钮，支持 Ctrl+Enter 提交。双栏布局时悬浮在右侧面板底部，单栏布局时悬浮在整个页面底部
- **Free QA 重新生成**: 每个 free QA 条目支持"重新生成"操作（与 template 一致）

## Capabilities

### New Capabilities
- `qa-service-integration`: QA 作为 pure service 注册到 service_runner，使用 service_executions 追踪，服务面板可见
- `stale-execution-cleanup`: 启动时清理所有中断的服务执行记录（不限于 QA）
- `floating-qa-input`: 底部悬浮输入框，响应式定位（跟随布局模式）
- `unified-qa-list`: Free QA 与 Template QA 合并展示，localStorage 持久化折叠状态

### Modified Capabilities
- `service-runner`: 支持注册 pure service（无 depends_on/produces），QA 执行走 service_executions

## Impact

- **Backend**: `service_runner.ts`（新增 pure service 注册）、`qa_service.ts`/`qa.ts`（改用 service_runner 执行）、`index.ts`（启动清理逻辑）
- **Database**: `service_executions` 表新增 QA 类型记录；`qa_entries` 表 status 字段仍保留但与 service_executions 关联
- **Frontend**: `TemplateQA.vue` 和 `FreeQA.vue` 合并为统一组件、新增浮动输入框组件、`PaperDetail.vue` 和 `QAPage.vue` 布局调整
- **Shared types**: `ServiceDef` 扩展支持 pure 类型

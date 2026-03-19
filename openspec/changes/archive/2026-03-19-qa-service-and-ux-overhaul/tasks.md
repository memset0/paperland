## 1. Service Runner: Pure Service 支持

- [x] 1.1 在 `service_runner.ts` 中新增 `PureServiceDef` 类型和 `executePureService(serviceName, paperId, executeFn)` 方法——获取信号量、速率限制、创建 `service_executions` 记录、返回 execution_id
- [x] 1.2 修改 `getServiceInfo()` 使 pure service 出现在服务列表中（含 running/pending/max_concurrency）
- [x] 1.3 更新 `packages/shared/src/types.ts` 中的相关类型定义

## 2. DB 迁移: qa_results 新增 execution_id

- [x] 2.1 在 `packages/backend/src/db/schema.ts` 的 `qaResults` 表中新增 `execution_id` 字段（nullable integer, 引用 `service_executions.id`）
- [x] 2.2 运行 `bunx drizzle-kit generate` 生成迁移文件

## 3. QA 服务集成

- [x] 3.1 在 `packages/backend/src/index.ts` 中将 QA 注册为 pure service 到 service_runner
- [x] 3.2 重写 `packages/backend/src/api/qa.ts` 中的 `runQA()` 函数，改用 `serviceRunner.executePureService()` 执行，完成后写入 `qa_results`（含 execution_id）并更新 `qa_entries.status`

## 4. 启动时清理卡住的执行

- [x] 4.1 在 `packages/backend/src/index.ts` 的 `main()` 中，`initDatabase()` 之后执行 SQL：将 `service_executions` 中 status 为 pending/running 的记录更新为 failed（error: 'interrupted by server restart', finished_at: now）
- [x] 4.2 同时将 `qa_entries` 中 status 为 pending/running 的记录更新为 failed（error: 'interrupted by server restart'）

## 5. 后端: QA 结果删除 API

- [x] 5.1 新增 `DELETE /api/qa/results/:resultId` 路由，删除指定 qa_result 记录

## 6. 前端: 统一 QA 列表组件 (QAList.vue)

- [x] 6.1 创建 `QAList.vue`，合并 free QA（时间倒序，在上方）和 template QA（config 顺序，在下方）到同一个折叠列表
- [x] 6.2 实现 localStorage 持久化折叠状态（key: `qa-collapse-{paperId}-{entryKey}`），新条目有结果则默认展开，无结果默认折叠
- [x] 6.3 提交后立即创建条目显示（只有问题+转圈动画），回答生成完成后追加显示
- [x] 6.4 多模型 tab 展示：每个 tab 显示模型名 + human readable 完成时间（"刚刚"/"3分钟前"等），按完成时间升序排列（最快的在前）；单模型结果直接显示不用 tab
- [x] 6.5 置顶功能：点击某个 tab 的置顶按钮将其移到最前，状态存 localStorage
- [x] 6.6 删除功能：每个 tab 支持删除该模型回答，调用后端 DELETE API
- [x] 6.7 重新生成：点击后检查是否有同问题+同模型的执行正在运行，若有则弹窗确认（"关于「{question}」的 {model} 正在生成中，是否需要重新提交？"），确认后提交；不删除旧回答

## 7. 前端: 浮动输入框 (QAInput.vue)

- [x] 7.1 创建 `QAInput.vue` — `position: sticky; bottom: 0`，圆角多行 textarea + 模型选择 chips + 提交按钮，支持 Ctrl+Enter
- [x] 7.2 在 `PaperDetail.vue` 中集成：双栏时 sticky 在右侧面板底部，单栏时 sticky 在滚动区域底部
- [x] 7.3 在 `QAPage.vue` 中集成：sticky 在内容区域底部

## 8. 清理与文档

- [x] 8.1 删除 `FreeQA.vue` 和 `TemplateQA.vue`（已被 QAList + QAInput 替代）
- [x] 8.2 更新 qa store 适配新组件结构（统一数据获取、删除 result action 等）
- [x] 8.3 更新 `docs/frontend-architecture.md` 和 `docs/tech-stack.md` 反映 QA 服务集成和新组件结构

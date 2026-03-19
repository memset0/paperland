## Context

QA 当前作为独立模块运行，有自己的追踪表（`qa_entries`/`qa_results`），不经过 `service_runner`。服务面板只展示 paper-bound 服务（arxiv、semantic_scholar、pdf_parse）。重启后所有 in-flight 执行（包括 QA 和其他服务）永久卡在 running/pending 状态。前端 QA 页面将 Template QA 和 Free QA 分为两个独立区域。

## Goals / Non-Goals

**Goals:**
- QA 执行通过 `service_runner` 调度，受 `max_concurrency`/`rate_limit_interval` 控制
- QA 执行记录写入 `service_executions` 表，在服务面板可见
- 后端启动时清理所有中断的执行记录（通用，不限于 QA）
- Free QA 条目与 Template QA 合并到同一个折叠列表
- 浮动输入框固定在页面/面板底部
- 折叠状态 localStorage 持久化

**Non-Goals:**
- 不重构已有 paper-bound 服务的执行逻辑
- 不做 WebSocket/SSE 实时推送（仍用轮询）
- 不做不绑定论文的 QA（未来功能）

## Decisions

### 1. QA 作为 pure service 注册

**选择**: 在 `service_runner` 中新增对 pure service 的支持。Pure service 不参与依赖图调度，但使用 `service_runner.executeService()` 获得并发控制和执行记录。

**替代方案**: 让 QA 直接写 `service_executions` 而不经过 service_runner → 放弃，会导致并发控制逻辑重复。

**实现**: `service_runner.ts` 新增 `executePureService(serviceName, paperId, executeFn)` 方法：
- 获取信号量，等待速率限制
- 创建 `service_executions` 记录（status: pending → running → done/failed）
- 返回 execution ID
- `qa.ts` 路由中调用此方法替代直接调用 `askQuestion()`

### 2. QA entries 与 service_executions 的关系

**选择**: 在 `qa_results` 表新增 `execution_id` 字段关联到 `service_executions.id`。QA 调用流程：
1. 创建 `qa_entries` 记录（如不存在）
2. 通过 `executePureService('qa', paperId, fn)` 执行，获得 execution_id
3. 完成后写入 `qa_results`（含 execution_id）
4. `qa_entries.status` 仍然维护（由 runQA 函数更新）

这样 QA 在服务面板通过 `service_executions` 可见，而 QA 页面通过 `qa_entries`/`qa_results` 展示详细内容。

### 3. 启动时清理卡住的执行

**选择**: 在 `initDatabase()` 之后、服务注册之前，执行一次清理：
```sql
UPDATE service_executions SET status='failed', error='interrupted by server restart', finished_at=NOW() WHERE status IN ('pending', 'running')
UPDATE qa_entries SET status='failed', error='interrupted by server restart' WHERE status IN ('pending', 'running')
```

**理由**: 简单直接，启动时一次性执行。用户可以在服务页面或 QA 页面看到 failed 状态并手动重试。

### 4. 统一 QA 列表

**选择**: 将 `FreeQA.vue` 组件拆分为输入部分（浮动框）和历史部分（合并入 TemplateQA）。合并后的组件名为 `QAList.vue`，按以下顺序排列：
1. Free QA 条目（按时间倒序，新的在上）
2. Template QA 条目（按 config.yml 中定义顺序）

每个条目都用 `<details>` 折叠。折叠状态以 `qa-collapse-{paperId}-{entryId}` 为 key 存储到 localStorage。

### 5. 浮动输入框

**选择**: 新建 `QAInput.vue` 组件，使用 `position: sticky; bottom: 0` 固定在滚动容器底部。

**双栏布局**（PaperDetail.vue, ≥900px）: sticky 在右侧面板底部
**单栏布局**（PaperDetail.vue, <900px 或 QAPage.vue）: sticky 在页面滚动区域底部

组件内容：圆角输入框（`rounded-2xl`）+ 模型选择 chips + 提交按钮。支持多行文本和 Ctrl+Enter 提交。

## Risks / Trade-offs

- **双写问题**: QA 同时写 `qa_entries` 和 `service_executions` → 可接受，两张表用途不同（QA 详情 vs 服务监控），且通过 `execution_id` 关联
- **启动清理的粗暴性**: 直接标记为 failed 可能误杀已完成但还未写回结果的任务 → 实际场景极少（Bun 进程崩溃时子进程也会被终止），且用户可手动重试
- **localStorage 膨胀**: 折叠状态可能积累很多 key → 可以在存储时限制为最近 50 篇论文

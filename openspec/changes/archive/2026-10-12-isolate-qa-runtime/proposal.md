## Why

QA 问题文本过去只存在于成功后的 `qa_results`，导致首次调用失败时 free question 无法恢复；同时并发运行通过“该论文最新 QA execution”关联 `execution_id`，无法可靠追踪一次具体模型调用。现有 `qa_entries → qa_results` 结构无需重构，本 change 只负责持久化问题和修正 Result↔Service 精确关联。

## What Changes

- 保留现有 `qa_entries` / `qa_results` 表、ID 和一对多关系，不新建替代主表。
- `qa_entries` 增加 `prompt`：free 创建后不可变；preset 每次运行前读取 `config.yml` 最新文本并刷新；模型调用开始前问题必须已落库。
- 同一 entry 可由不同 Agent/model 或同一 Agent/model 反复运行；每次成功结果追加新 result，不覆盖旧回答。
- QA 继续作为 ServiceRunner pure service，保留统一并发、限流和服务面板。ServiceRunner 将本次创建的精确 execution id 传给 QA 回调，成功 result 直接保存该 id，禁止 latest-by-paper 查询。历史错误关联不猜测、不重写。
- prompt migration 先在线备份，再从最新历史 result 回填可恢复 entry。用户明确授权的 8 条 `free + failed + prompt IS NULL + 无 result` 历史 entry 已在第二份备份后按精确 ID 删除；不删除论文、results 或 service executions。
- 保留现有 Internal/External API 兼容行为；`/papers/full` 继续可返回 QA。
- 明确拆分：
  - 多用户 mine/all → `add-qa-all-users-scope`
  - 个人背景色 → `add-qa-entry-background-colors`
  - 高亮/笔记锚点计数 → `add-qa-reading-indicators`
  - QA 流式输出状态延后，待翻译功能的流式实现稳定后另开 change 复用
  - 追问树与多轮 prompt formatter 另开独立 change
- 所有实现阶段同步更新 `docs/frontend-architecture.md`、`docs/external-api.md` 和 `docs/tech-stack.md`。

## Capabilities

### New Capabilities

- `qa-runtime`: QA 问题文本持久化、可重复运行、失败后的可靠重试与精确 Service execution 追踪。

### Modified Capabilities

- `database-schema`: 为 `qa_entries` 增加 prompt，并定义精确 execution 关联、备份回填及用户授权的不可恢复历史清理。
- `service-runner`: pure-service callback 获得本次精确 execution id，QA 保持统一服务调度和可见性。

## Impact

- Backend: QA 创建/重跑/列表逻辑、ServiceRunner pure-service callback、External API QA 路径。
- Database: `qa_entries.prompt`、现有 `qa_results.execution_id` 的新写入规则、一次性安全回填/清理。
- Shared/frontend: QA entry prompt 类型与失败条目的现有展示/重试路径。
- Compatibility: 不移除现有 API、Service dashboard、配置或历史结果。

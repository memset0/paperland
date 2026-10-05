## Why

`QAResultView` 的多回答 Tabs 同时使用受控 `v-model` 和 `default-value`，但受控值初始为空，导致默认 tab 不可靠；结果列表还按旧到新排序。用户进入一个有多次回答的 QA 时，应首先看到最终最新一次回答。

## What Changes

- 多结果首次渲染时，默认激活 `completed_at` 最新的 Result；时间相同则选择 id 最大者。
- Tab 顺序改为最新到最旧，除非现有 pin 规则将某个模型组置前；pin 不改变“默认选择最新回答”的规则。
- 当轮询/重新生成带来一个新的 Result id 时，自动切换到新的最新回答。
- 仅发生等价刷新、数组实例替换或顺序变化，而 Result id 集合未增加时，保留用户手动选择，不反复跳回最新。
- 当前选中 Result 被删除时，回退到剩余最新回答。
- `requestedResultId` 锚点导航优先级最高，仍可显式选择历史回答并覆盖默认选择。
- 单回答显示、复制、Pin、重新生成、删除、高亮和 PaperDetail/feed 复用行为不变。
- 更新三份 `docs/` 架构文档；无后端、API 或数据库变更。

## Capabilities

### New Capabilities

- `qa-result-tab-selection`: 多回答 tab 的最新默认、更新、删除回退、手动选择保持与锚点覆盖语义。

### Modified Capabilities

None.

## Impact

- Frontend: `components/QAResultView.vue` 及一个可独立测试的 result-selection helper/test。
- Backend/database/API: 无变更。
- Docs: `frontend-architecture.md`、`external-api.md`、`tech-stack.md`。

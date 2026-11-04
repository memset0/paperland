## Why

反复运行的单元测试必须可预测且不消耗外部服务额度，模型便宜或免费也不构成例外。现有规则仅提示费用风险，需改为明确的离线要求。

## What Changes

- 明确所有日常单元/回归测试使用本地 fixture、mock 或依赖注入，禁止实际外部网络、模型与真实外部 CLI 调用，包括 luna。
- 如需真实服务集成测试，必须单独区分、默认不运行，仅在用户明确授权时执行。
- 更新 AGENTS.md 和 OpenSpec 任务生成规则，并审查现有外部服务测试的替身用法。

## Capabilities

### New Capabilities

None. Workflow documentation only; skip_specs is enabled.

### Modified Capabilities

None.

## Impact

AGENTS.md and openspec/config.yaml task-authoring guidance. No application behavior, API or database changes. Existing service/provider tests use mocked responses, injected model functions or fake CLI fixtures.

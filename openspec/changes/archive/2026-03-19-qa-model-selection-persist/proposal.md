## Why

用户在 QA 页面选择的模型（可能多个）在刷新页面或切换到其他页面后会丢失，每次都需要重新选择。应将用户的模型选择持久化到浏览器 localStorage 中，使其跨页面刷新和导航保持不变。

## What Changes

- **模型选择持久化**：将 `selectedModels` 状态同步到 `localStorage`，初始化时从缓存读取，变更时自动写入。
- **首次加载回退**：如果 localStorage 中没有缓存（首次使用），则保持现有逻辑——默认选中第一个可用模型。

## Capabilities

### New Capabilities

- `qa-model-persist`: QA 模型选择的 localStorage 持久化——保存、恢复、与可用模型列表校验

### Modified Capabilities

## Impact

- `packages/frontend/src/stores/qa.ts` — `selectedModels` 的初始化和更新逻辑
- `packages/frontend/src/components/QAInput.vue` — 可能需要调整模型初始化时的默认选择逻辑

## Context

QA store 中 `selectedModels` 是一个 `ref<string[]>([])`，每次页面加载时为空数组。QAInput 组件的 `onMounted` 中获取可用模型列表后，如果 `selectedModels` 为空则默认选中第一个。这意味着用户手动选择的模型每次刷新都会丢失。

## Goals / Non-Goals

**Goals:**
- 用户选择的模型持久化到 localStorage，刷新/导航后自动恢复
- 缓存的模型需与当前可用模型列表做交叉校验，移除已下线的模型

**Non-Goals:**
- 不做服务端持久化（这是纯前端偏好设置）
- 不改变模型选择的 UI 交互方式

## Decisions

### 1. 使用 localStorage 直接读写

**选择**: 在 qa store 中用 `watch` 监听 `selectedModels` 变化时写入 localStorage，初始化时从 localStorage 读取。

**理由**: 简单直接，Pinia 没有内置 persist 插件（不引入额外依赖）。localStorage key 用 `paperland_selected_models`。

**替代方案**: 使用 pinia-plugin-persistedstate → 需要额外依赖，对单个字段来说过重。

### 2. 可用模型校验在 QAInput onMounted 中进行

**选择**: QAInput 获取到可用模型列表后，过滤 `selectedModels` 中不存在于可用列表的模型。如果过滤后为空，回退到默认选中第一个。

**理由**: 可用模型列表从后端获取，只有在获取后才能校验。保持校验逻辑在一个地方。

## Risks / Trade-offs

- **[localStorage 不可用]** → 某些隐私模式下 localStorage 可能不可用。用 try-catch 包裹读写，失败时静默回退到默认行为。

## Why

前端通过 `api/client.ts` 发起的请求在失败时虽然会 throw Error，但各调用点的 catch 处理不一致——有些静默吞掉错误，用户完全看不到请求失败的反馈。需要一个全局兜底机制，确保任何 API 错误都至少以一条红色浮动提示告知用户。

## What Changes

- 在 API client (`packages/frontend/src/api/client.ts`) 的 `request` 函数中加入全局错误钩子，在 throw 之前触发一个事件/回调
- 新增一个 `GlobalAlert` 组件，挂载在 `App.vue` 顶层，监听错误事件并以红色浮动 toast 形式展示错误信息，几秒后自动消失
- 该提示是补充性的全局兜底，不替代各页面已有的具体错误处理逻辑

## Capabilities

### New Capabilities
- `global-error-toast`: 全局 API 错误浮动提示 — 拦截所有失败的 API 请求，在页面顶部展示红色 toast 通知

### Modified Capabilities

_(none)_

## Impact

- `packages/frontend/src/api/client.ts` — 在 request 函数中添加错误通知钩子
- `packages/frontend/src/App.vue` — 引入 GlobalAlert 组件
- 新增 `packages/frontend/src/components/GlobalAlert.vue` 组件
- 纯前端改动，不影响后端或 API 契约

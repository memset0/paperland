## Context

当前前端的 `api/client.ts` 在请求失败时会 throw Error，但错误处理完全依赖各调用点的 catch。部分调用点未做用户可见的错误提示，导致请求静默失败。需要一个全局兜底机制，在 API client 层统一拦截错误并展示给用户。

现有架构：Vue 3 + Pinia，无 toast/notification 库。App.vue 是根组件，所有页面通过 `<RouterView />` 渲染。

## Goals / Non-Goals

**Goals:**
- 所有 API 错误自动在页面顶部展示红色浮动 toast
- toast 自动消失（约 5 秒），支持手动关闭
- 多条错误可同时堆叠展示
- 纯前端实现，零依赖新增

**Non-Goals:**
- 不替换各页面已有的具体错误处理（如 QA 页面的 inline error state）
- 不做成功/info 类型的 toast（仅错误）
- 不引入第三方 toast 库

## Decisions

### 1. 事件机制：自定义 EventTarget

使用一个简单的 `EventTarget` 单例作为事件总线，API client 在 throw 前 dispatch 错误事件，GlobalAlert 组件监听该事件。

**为什么不用 Pinia store**：toast 是瞬时 UI 状态，不需要持久化或跨组件共享复杂状态。EventTarget 更轻量，避免 store 膨胀。

**为什么不用 Vue provide/inject**：API client 是纯 TS 模块，不在 Vue 组件树内，无法访问 inject。

### 2. GlobalAlert 组件挂载位置

放在 App.vue 的 `<main>` 之上，使用 `fixed` 定位浮动在页面顶部。使用 `z-50` 确保在所有内容之上。

### 3. Toast 自动消失

每条 toast 5 秒后自动移除，同时提供 X 按钮手动关闭。使用 Vue `<TransitionGroup>` 实现进出动画。

## Risks / Trade-offs

- **重复提示风险**：某些调用点已有自己的错误 UI，用户可能看到两条提示 → 可接受，proposal 明确定位为「补充性」兜底，宁可多提示也不静默
- **高频错误刷屏**：短时间大量请求失败时 toast 可能堆叠过多 → 限制最多同时展示 5 条，超出时最旧的自动移除

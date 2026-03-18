## 1. 错误事件总线

- [x] 1.1 创建 `packages/frontend/src/lib/error-bus.ts` — 导出 EventTarget 单例和 `dispatchApiError(message: string)` 辅助函数，以及事件类型常量

## 2. API Client 集成

- [x] 2.1 修改 `packages/frontend/src/api/client.ts` 的 `request` 函数 — 在 throw Error 之前调用 `dispatchApiError`，并用 try/catch 包裹整个 fetch 以捕获网络错误并 dispatch "网络错误，请检查连接"

## 3. GlobalAlert 组件

- [x] 3.1 创建 `packages/frontend/src/components/GlobalAlert.vue` — 监听 error-bus 事件，维护 toast 列表（最多 5 条），每条 5 秒自动消失，支持手动关闭，使用 TransitionGroup 做进出动画，fixed 定位在页面顶部居中，红色样式

## 4. 挂载与集成

- [x] 4.1 在 `packages/frontend/src/App.vue` 中引入并挂载 `GlobalAlert` 组件，放置在根 div 内 main 标签之前

## 5. 文档更新

- [x] 5.1 更新 `docs/frontend-architecture.md` — 添加全局错误提示机制的说明

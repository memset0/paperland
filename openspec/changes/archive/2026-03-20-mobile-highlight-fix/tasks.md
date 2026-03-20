## 1. 选择检测机制重构

- [x] 1.1 在 MarkdownContent.vue 中添加触摸设备检测（`isTouchDevice` 变量），复用 QAPanelNav.vue 中相同的检测逻辑
- [x] 1.2 将 `@mouseup="onMouseUp"` 替换为 `selectionchange` 事件监听：在 `onMounted` 中注册 `document.addEventListener('selectionchange', onSelectionChange)`，在 `onBeforeUnmount` 中移除
- [x] 1.3 实现 `onSelectionChange` 函数：防抖处理（桌面 50ms，移动 300ms），检查选择是否在 `containerRef` 内，调用 `getSelectionOffsets` 获取偏移量，定位并显示工具栏
- [x] 1.4 工具栏定位增加视口边界 clamp 逻辑，确保在窄屏上不超出容器左右边缘

## 2. 弹窗关闭适配

- [x] 2.1 在 `onMounted` 中同时注册 `mousedown` 和 `touchstart`（passive）事件用于关闭弹窗，`onBeforeUnmount` 中同时移除
- [x] 2.2 确保关闭逻辑幂等——两个事件触发同一个 `closeAllPopups` 不会产生副作用

## 3. 触摸设备交互适配

- [x] 3.1 触摸设备上禁用 `@mouseover`/`@mouseout` tooltip 逻辑（通过 `isTouchDevice` 判断提前 return）
- [x] 3.2 触摸设备上 tap 高亮标记直接显示 click menu（复用 `onMarkClick` 逻辑），menu 中显示已有 note 内容
- [x] 3.3 确保 `onMarkClick` 在触摸设备上不与 `selectionchange` 冲突——如果 tap 高亮标记时没有活跃选择，走 menu 逻辑；如果有选择，走工具栏逻辑

## 4. Touch-friendly UI

- [x] 4.1 工具栏和菜单添加 `user-select: none` 防止误选

## 5. 测试与文档

- [ ] 5.1 在 Android Chrome 和 iOS Safari 上手动测试：文本选择 → 工具栏弹出 → 选色 → 高亮创建
- [ ] 5.2 在 Android Chrome 和 iOS Safari 上手动测试：tap 已有高亮 → menu 弹出 → 编辑/删除
- [ ] 5.3 验证桌面端行为无回归：鼠标选择、hover tooltip、click menu 均正常
- [x] 5.4 更新 `docs/frontend-architecture.md` 中高亮相关章节，补充移动端交互说明

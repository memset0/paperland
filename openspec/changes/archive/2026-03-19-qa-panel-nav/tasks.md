## 1. Scroll Spy Composable

- [x] 1.1 创建 `packages/frontend/src/composables/useScrollSpy.ts`，接收滚动容器 ref 和目标元素选择器，使用 IntersectionObserver 返回响应式的 `activeIndex`
- [x] 1.2 处理多个元素同时可见时，取最靠近顶部的元素作为 active

## 2. QAPanelNav 组件

- [x] 2.1 创建 `packages/frontend/src/components/QAPanelNav.vue` 基础结构：接收 entries props（key + title 数组）和滚动容器 ref
- [x] 2.2 实现未展开状态：垂直排列的小灰点，`position: sticky`，半透明，`pointer-events: none`（圆点除外）
- [x] 2.3 实现 hover 展开：CSS transition 从圆点列展开为 ~260px 面板，显示单行截断的问题标题
- [x] 2.4 实现 active 高亮：集成 useScrollSpy，当前可见条目对应的圆点颜色更深
- [x] 2.5 实现点击导航：点击项滚动到对应 QA panel（通过 `data-qa-entry` 属性查找），若折叠则自动展开并更新 localStorage
- [x] 2.6 实现移动端触摸支持：click toggle 展开/收起，点击导航项后自动收回

## 3. 集成到 PaperDetail

- [x] 3.1 在 PaperDetail.vue 的右侧面板滚动容器中引入 QAPanelNav，传入从 qaStore 派生的 entries 数据和滚动容器 ref
- [x] 3.2 确保宽屏（split view）和窄屏（单列）模式下均正常显示
- [x] 3.3 处理 QA 条目动态增减时导航组件的响应式更新

## 4. 文档更新

- [x] 4.1 更新 `docs/frontend-architecture.md`，记录 QAPanelNav 组件和 useScrollSpy composable

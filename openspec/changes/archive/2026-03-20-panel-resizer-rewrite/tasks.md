## 1. 重写拖动逻辑

- [x] 1.1 替换 `mousemove`/`mouseup` 事件监听为 `pointerdown`/`pointermove`/`pointerup`，在 `pointerdown` 时调用 `setPointerCapture`，在 `pointerup` 时调用 `releasePointerCapture`
- [x] 1.2 移除 `onMounted`/`onUnmounted` 中的 `document.addEventListener('mousemove')` 和 `document.addEventListener('mouseup')`，改为在分隔条元素上直接绑定 pointer 事件
- [x] 1.3 拖动过程中在 split-container 上添加 `select-none` 和 `pointer-events-none`（对子元素），拖动结束后移除

## 2. 缩窄分隔条

- [x] 2.1 将分隔条可见宽度从 `w-1.5`（6px）改为 2px（`w-0.5`）
- [x] 2.2 使用 padding 或绝对定位伪元素将点击热区扩展到 12px，确保易于抓取
- [x] 2.3 更新分隔条颜色：默认 `bg-gray-300`，hover `bg-indigo-400`，active/dragging `bg-indigo-500`

## 3. 折叠/展开按钮

- [x] 3.1 添加 `collapsed` ref 和 `savedWidth` ref 状态管理
- [x] 3.2 导入 lucide-vue-next 的 `PanelLeftClose` 和 `PanelLeftOpen` 图标
- [x] 3.3 在分隔条垂直中间位置添加圆形 icon button，展开时显示 `PanelLeftClose`，折叠时显示 `PanelLeftOpen`
- [x] 3.4 实现 toggle 逻辑：点击时切换 collapsed 状态，折叠前保存当前宽度到 savedWidth，展开时恢复
- [x] 3.5 折叠状态下禁止拖动

## 4. 过渡动画

- [x] 4.1 在左面板上添加 CSS transition（`transition: width 300ms ease`），用于折叠/展开动画
- [x] 4.2 拖动过程中禁用 transition（添加/移除 class），拖动结束后恢复

## 5. 文档更新

- [x] 5.1 更新 `docs/frontend-architecture.md` 中关于 PaperDetail 双栏布局的描述，记录 pointer capture 拖动逻辑和折叠功能

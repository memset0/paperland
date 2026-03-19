## 1. QAInput 组件定位与样式修改

- [x] 1.1 修改 QAInput.vue：移动端使用 `fixed bottom-0 left-0 right-0` 定位，桌面端（`md:` 以上）使用 `sticky bottom-0` 定位
- [x] 1.2 桌面端阴影从 `shadow-lg` 升级为 `shadow-2xl`，增加外层 padding（`p-3` → `md:p-5`）
- [x] 1.3 桌面端内部卡片增加 padding，增强间距感

## 2. QAPage 布局适配

- [x] 2.1 QAPage.vue 中 QA 内容列表底部增加足够 padding（`pb-36` 或更大），防止 fixed 提问框遮挡内容
- [x] 2.2 验证桌面端 sticky 在当前滚动容器结构中正常工作

## 3. 文档更新

- [x] 3.1 更新 `docs/frontend-architecture.md` 中 QA 页面相关描述

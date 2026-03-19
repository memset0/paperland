## 1. Store 层持久化逻辑

- [x] 1.1 在 qa store 中初始化 `selectedModels` 时从 localStorage 读取缓存值（key: `paperland_selected_models`），用 try-catch 包裹
- [x] 1.2 添加 `watch` 监听 `selectedModels` 变化，自动写入 localStorage，用 try-catch 包裹

## 2. 模型校验逻辑

- [x] 2.1 修改 QAInput.vue 的 onMounted：获取可用模型后，过滤 `selectedModels` 中不存在于可用列表的模型；如果过滤后为空则回退默认选中第一个

## 3. 文档更新

- [x] 3.1 更新 `docs/frontend-architecture.md` 中 QA store 相关描述

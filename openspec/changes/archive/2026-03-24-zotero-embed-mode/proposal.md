## Why

Paperland 的页面在 Zotero 侧边栏通过插件嵌入加载时，默认的 appbar、论文标题导航栏等 UI 元素占用了宝贵的侧边栏空间，且背景色与 Zotero 原生 UI 不统一（Zotero 使用 `#f2f2f2`）。此外，嵌入的页面无法方便地刷新，用户遇到页面问题时需要手动操作。

## What Changes

- **新增 embed 查询参数**：通过 `?embed=1` URL 参数激活嵌入模式，隐藏不必要的 UI 元素（appbar、论文标题导航栏），使页面更适合在侧边栏中展示
- **新增 bg 查询参数**：通过 `?bg=f2f2f2` URL 参数允许外部指定页面背景色，使嵌入页面与宿主应用的配色保持一致
- **缩小内容边距**：embed 模式下将单栏布局的内边距从 `p-5` 缩小到 `p-2`，去掉 max-width 限制，最大化利用侧边栏空间
- **新增刷新按钮**：在 embed 模式下，页面顶部显示一个紧凑的刷新按钮，点击即可重新加载当前页面内容

## Capabilities

### New Capabilities
- `embed-mode`: 前端 embed 模式检测（URL 参数解析）及 UI 适配（隐藏 appbar、标题栏、显示刷新按钮、应用自定义背景色）

### Modified Capabilities
_(none — this is purely additive frontend behavior triggered by URL parameters)_

## Impact

- **前端 App.vue**：需要检测 `embed` 参数，条件性隐藏桌面侧边栏和移动端导航栏
- **前端 PaperDetail.vue**：需要检测 `embed` 参数，条件性隐藏论文标题 header，并在 embed 模式下显示刷新按钮
- **前端全局样式/根元素**：需要检测 `bg` 参数并应用为背景色
- **Zotero 插件**：加载页面 URL 时需追加 `?embed=1&bg=f2f2f2` 参数
- **无后端变更**，无 API 变更，无数据库变更

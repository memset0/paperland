## Why

站点 favicon 仍是 Vite 默认的 `/vite.svg`，而且 `packages/frontend/` 下并不存在 `public/` 目录，该引用大概率 404——浏览器标签上没有可识别的 Paperland 站点图标。刚完成的「按页面区分标签标题」让标签文字可辨，但缺一个配套的品牌图标。需要一个代表 Paperland（论文管理）的 favicon，进一步提升多标签时的辨识度与品牌感。

## What Changes

- 新增品牌 favicon：**品牌蓝底（`--primary`，≈ `#0069A8`）+ 白色文档图标**（圆角页面 + 右上折角 + 2–3 条文字线），与侧边栏「论文管理」的 lucide `FileText` 图标呼应，以 **SVG 矢量**为主资产，16px 仍清晰。
- 在 `packages/frontend/` 新建 `public/` 目录，放置 `favicon.svg`；尽量附带 `apple-touch-icon.png`（180×180，iOS 主屏）作为光栅补充（依赖本机有 SVG→PNG 工具，缺失时降级为仅 SVG 并说明）。
- 更新 `index.html`：移除失效的 `<link rel="icon" href="/vite.svg">`，改为引用 `/favicon.svg`（`type="image/svg+xml"`），并在有光栅图时补 `apple-touch-icon` link。
- 确保仓库中不再有对 `vite.svg` 的引用。

## Capabilities

### New Capabilities
- `favicon`: 站点 favicon / 品牌图标资产（品牌蓝底白文档 SVG，及可选光栅回退）与 `index.html` 中的图标引用规则。

### Modified Capabilities
<!-- 无既有 capability 的 spec 级行为发生变化 -->

## Impact

- **Frontend**：新增 `packages/frontend/public/favicon.svg`（及可选 `apple-touch-icon.png`）；`index.html` 的 `<link rel="icon">` 更新。Vite 会把 `public/` 下文件原样拷到 `dist/` 根。
- **无后端 / API / DB / config 改动**；**无新增运行时依赖**（生成光栅图若需 `rsvg-convert`/`magick` 属构建期一次性、可选）。
- **Docs**：`docs/frontend-architecture.md` 的「UI 技术栈 / 全局导航结构」补充 favicon 与品牌图标说明（品牌主色、资产位置）。

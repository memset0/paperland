## ADDED Requirements

### Requirement: Brand favicon SVG asset
前端 SHALL 提供 `packages/frontend/public/favicon.svg`：一个主题色文档图标（`#0069A8`，即 `--primary = oklch(0.5 0.134 242.749)`；竖版页面铺满画布高度、保持竖版比例、上下无留白，右上折角，文档内含白色文字线镂空）置于**透明背景**之上，以可缩放 SVG 编写。该资产 SHALL 代表 Paperland，而非 Vite 默认 logo。

#### Scenario: 构建/运行时可取到品牌 favicon
- **WHEN** 前端被构建或运行
- **THEN** `/favicon.svg` SHALL 在站点根路径可访问，且呈现 Paperland 文档图标（非 Vite 默认 logo）

#### Scenario: 构建产物包含 favicon
- **WHEN** 执行 `vite build`
- **THEN** `dist/favicon.svg` SHALL 存在（由 `public/` 拷贝而来）

### Requirement: index.html 引用 favicon 且不再引用 vite.svg
`packages/frontend/index.html` SHALL 通过 `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` 引用 favicon，且 SHALL NOT 包含任何对 `/vite.svg` 的引用。

#### Scenario: 图标引用已更新
- **WHEN** 加载 `index.html`
- **THEN** 文档 `<head>` SHALL 以 `/favicon.svg` 作为 icon 链接
- **AND** SHALL NOT 出现 `/vite.svg` 引用

### Requirement: 小尺寸下清晰可辨
favicon SHALL 在 16×16 px 下保持清晰：透明背景上的蓝色文档 + 白色文字线，无在小尺寸会消失的过细细节。

#### Scenario: 浏览器标签内渲染
- **WHEN** favicon 以 16×16 px 显示在浏览器标签
- **THEN** 蓝色文档轮廓与白色文字线 SHALL 在浅色与深色浏览器主题下都清晰可辨

## 1. favicon 资产

- [x] 1.1 新建 `packages/frontend/public/favicon.svg`：**主题色文档图标**（`#0069A8` = `--primary`，竖版页面铺满高度/竖版比例不拉伸/水平居中，右上折角 dog-ear `#004F7E`）+ **3 条白色文字线镂空** + **透明背景**，viewBox 32（经多轮迭代确定：颜色定为页面主题色，文档铺满高度去掉上下留白）
- [x] 1.2 （可选增强）光栅回退 `apple-touch-icon.png`：**本机无 `rsvg-convert`/`magick`/`resvg`/`inkscape`，按设计降级为仅 SVG，未生成**（常青浏览器 + Safari ≥16.4 已覆盖）

## 2. 接入 index.html

- [x] 2.1 `packages/frontend/index.html`：`<link rel="icon">` 的 `href` 由失效的 `/vite.svg` 改为 `/favicon.svg`（无光栅图，故不加 `apple-touch-icon` link）

## 3. 清理

- [x] 3.1 确认源码无残留 `vite.svg` 引用（且仓库中本就不存在 `vite.svg` 文件——旧引用一直是 404）；`dist/` 为构建产物，已随重建刷新

## 4. 文档

- [x] 4.1 `docs/frontend-architecture.md`「UI 技术栈」新增「Favicon / 品牌图标」条目：资产位置、品牌蓝 `#0069A8`（源自 `--primary`）、颜色硬编码、变更主色需重生成、仅 SVG 的取舍

## 5. 验证

- [x] 5.1 `vite build` 通过：`dist/favicon.svg` 存在、`dist/index.html` 引用 `/favicon.svg`、源码无 `vite.svg` 残留

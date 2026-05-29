## Context

`packages/frontend/index.html` 原引用 `/vite.svg` 作为 favicon，但 `packages/frontend/` 下没有 `public/` 目录，该文件不存在（引用 404）。Vite 默认把 `public/` 目录原样拷贝到 `dist/` 根，根路径引用（`/favicon.svg`）即可命中。页面主题色 `--primary = oklch(0.5 0.134 242.749)`，换算 sRGB = `#0069A8`。侧边栏「论文管理」用 lucide `FileText`，favicon 采用同一「文档」母题以保持一致。最终方案（经多轮迭代确定）：**透明背景 + 主题色 `#0069A8` 竖版文档 + 白色文字线镂空**，文档铺满画布高度（上下无留白）、保持竖版比例（不拉伸）、水平居中。

## Goals / Non-Goals

**Goals:**
- 一个代表 Paperland 的品牌 favicon，标签页一眼可辨，16px 清晰。
- 颜色用页面主题色 `--primary`（`#0069A8`），与站点一致。
- 矢量优先、单文件、零运行时依赖；浅色/深色浏览器标签栏都可见。
- 移除失效的 `vite.svg` 引用。

**Non-Goals:**
- 不做完整 PWA（manifest、多尺寸 icon set、安装体验）。
- 不引入图像构建依赖到 `package.json`（光栅图若生成，用本机一次性工具）。
- 不做深色模式专属 favicon 变体。

## Decisions

### 决策 1：SVG 矢量为主资产
favicon 以 `favicon.svg` 为主。现代浏览器（Chrome/Edge/Firefox、Safari ≥16.4）均支持 SVG favicon，矢量在任意 DPI 清晰且体积小。**备选**：仅 `.ico`/`.png`（非矢量、需多尺寸、体积大）——否决。

### 决策 2：透明背景 + 蓝色文档 + 白色文字线镂空
**蓝色页面**（圆角 + 右上折角 dog-ear）置于**透明背景**上，文档内 3 条**白色文字线**作为镂空，与 `FileText` 呼应、直观表达「论文」。不用底色方块。
> 演进：最初为「白文档 + 蓝色圆角底块」，但底块方案折角后视觉重心偏低、四周留白不匀。改为透明背景 + 蓝色文档，并让文档铺满画布高度后更干净、更居中。**备选**（已否决）：「P」字母标、叠放书页、实色底块。

### 决策 3：颜色用主题色 `#0069A8`（白色文字线）
favicon 在浏览器中独立渲染，**无法**引用应用的 CSS 变量，故颜色直接写入 SVG。文档体 `#0069A8`（即 `--primary = oklch(0.5 0.134 242.749)`，与站点主题色一致），折角 `#004F7E`（同色加深），文字线 `#FFFFFF`。
> 颜色经多轮确认：曾试 `#2563EB`（皇家蓝）、`#004171`/`#1E3A5F`（藏蓝/海军蓝），用户最终明确要用页面主题色 `#0069A8`。因 favicon 硬编码该值，**若 `--primary` 变更需同步重生成 favicon**。

### 决策 4：竖版文档铺满高度、不拉伸、水平居中
文档 bbox `y:[0,32]`（上下无留白），保持竖版纸张比例（宽 `x:[5,27]`，**不**拉伸成正方形），水平居中（左右各留 5 的对称边距，用户只要求上下无留白）。右上折角 6×6。3 条白色文字线竖直方向居中（块中心 ≈ y16，上下空白基本均衡）。

### 决策 5：光栅回退为可选增强
`apple-touch-icon.png`（180×180，iOS 主屏）与可选 `favicon.ico`（16/32）由 SVG 用本机工具（`rsvg-convert` / `magick` / `resvg`）生成；**本机无此类工具，按设计降级为仅 SVG**（不阻塞、不新增依赖）。SVG-only 已覆盖目标用户的常青浏览器。

### 决策 6：资产置于 `packages/frontend/public/`
新建 `public/` 目录；Vite 构建时原样拷到 `dist/`，`index.html` 用根路径 `/favicon.svg` 引用。

### 最终资产（`public/favicon.svg`）

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Paperland">
  <path d="M7 0 H21 L27 6 V30 a2 2 0 0 1 -2 2 H7 a2 2 0 0 1 -2 -2 V2 a2 2 0 0 1 2 -2 Z" fill="#0069A8"/>
  <path d="M21 0 L27 6 H21 Z" fill="#004F7E"/>
  <g fill="#FFFFFF">
    <rect x="8" y="9.5" width="16" height="3" rx="1.5"/>
    <rect x="8" y="14.5" width="16" height="3" rx="1.5"/>
    <rect x="8" y="19.5" width="10" height="3" rx="1.5"/>
  </g>
</svg>
```

主题色 `#0069A8` 竖版文档（铺满高度、竖版比例、水平居中）+ 右上折角（深一档 `#004F7E` 的 dog-ear）+ 3 条白色文字线（末行略短）。透明背景。

## Risks / Trade-offs

- [老浏览器 / iOS 主屏不支持 SVG favicon] → 可补 `apple-touch-icon.png`（及 `.ico`）；常青浏览器有 SVG 即可。本机无光栅工具，暂仅 SVG。
- [`--primary` 主题色调整后 favicon 不同步] → favicon 颜色硬编码自当前 `--primary`（`#0069A8`）；在 docs 注明「改主题色需重生成 favicon」。
- [文字线在 16px 过细] → 文字线取偏粗值（高 3、rx 1.5），已按浏览器小尺寸校准。

## Migration Plan

纯前端、可即插即用。部署即生效；回滚＝恢复 `index.html` 原 `vite.svg` 引用并删除 `public/` 新增资产。无数据 / 接口迁移。

## Open Questions

- 是否要加完整 PWA manifest / apple-touch-icon 光栅图——当前不做（本机无光栅工具），后续可补。

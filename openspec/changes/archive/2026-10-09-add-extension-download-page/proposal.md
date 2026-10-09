## Why

浏览器插件（`add-arxiv-browser-extension`）目前只存在于代码仓库里，用户必须能访问服务器上的 `packages/browser-extension/` 才能安装。需要在网站里提供一个下载与安装引导的入口，且下载即可用、尽量免去手动填写配置。

## What Changes

- 新增侧边栏页面 **Extension**（`/extension`，需登录，使用 `AppPage`）：下载按钮、Chrome/Edge 与 Firefox 安装步骤、站点地址与 token（复制 / 重新生成）、支持的网站与快捷键说明。
- 新增 `GET /api/extension/download?base_url=<origin>`（需登录）：服务端即时把插件运行文件（`manifest.json`、`icons/`、`src/`）打包成 zip 返回，并写入 `src/preset.json`（当前用户的 `base_url` 与 token），使下载的插件装好即可使用。
- 插件读取配置时，若同步存储里没有值，则回退到 `preset.json`；用户在选项页保存的值优先。
- 账户设置中的 token 区块保持不变（与新页面显示同一 token）。

## Capabilities

### New Capabilities
- `extension-download-page`: 侧边栏 Extension 页面与个性化 zip 下载接口。

### Modified Capabilities
- `browser-extension`: 「Extension options」需求增加 preset 回退行为。

## Impact

- 后端：新增 `api/extension.ts`（路由 + 无依赖的 zip 打包）及测试，`index.ts` 注册路由。
- 前端：`router/index.ts`、`App.vue` 侧边栏条目、新视图 `views/ExtensionPage.vue`、`api/client.ts`。
- 插件：`src/settings.js` 预设回退；`manifest.json` 版本号 0.1.0 → 0.2.0。
- 文档：`docs/frontend-architecture.md`、`docs/external-api.md`、`docs/tech-stack.md`、`docs/browser-extension.md`。
- 无新依赖。

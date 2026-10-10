## Why

账户相关设置目前藏在侧边栏头像菜单打开的 `AccountDialog` 弹窗里，而 `/settings` 页面只对管理员开放，两处"设置"割裂且弹窗空间局促。把它们合并成一个所有登录用户都能访问的 Settings 页面更直观；同时站点适合作为独立窗口长期使用，需要一个显式的"安装为 App"入口。

## What Changes

- `/settings` 改为所有登录用户可访问（路由与侧边栏的 Settings 项由 admin-only 改为 login-required）。
- Settings 页面自上而下：**Install app**（安装为 App）→ 账户设置（Account：用户名 / 昵称 / 密码、Sharing、API Tokens、Browser Extension）→ 管理员区块（用户管理、全站 API Token 列表，仅 admin 可见，内容与现有一致）。
- 删除 `AccountDialog.vue`；头像菜单的 "Account settings" 与移动端抽屉中的用户名按钮改为跳转 `/settings`。
- 新增 PWA 支持：Web App Manifest（`manifest.webmanifest`）、PNG 图标（192 / 512 / maskable 512）、最小 Service Worker（仅为满足可安装性，不缓存、不拦截请求）、`index.html` 中的 manifest / theme-color / apple-touch-icon 链接。
- "Install app" 区块：浏览器触发 `beforeinstallprompt` 时显示 "Install" 按钮调用原生安装；已在独立窗口中运行时显示已安装；不支持原生提示的浏览器（iOS Safari、Firefox 等）显示手动安装说明。

## Capabilities

### New Capabilities
- `settings-page`: 统一 Settings 页面的访问规则与区块顺序（Install app → Account → Admin）。
- `pwa-install`: Web App Manifest、图标、Service Worker 注册与 Settings 中的安装入口。

### Modified Capabilities
- `responsive-nav`: Settings 项由 admin-only 改为 login-required；账户菜单的 "Account settings" 跳转到 Settings 页面而不是打开弹窗。
- `auth`: Personal token / Codex agent token 的管理 UI 从"account dialog"移至 Settings 页面的 Account 区块。
- `data-sharing-preferences`: Sharing 开关 UI 从账户弹窗移至 Settings 页面。
- `arxiv-quick-open`: Browser Extension 区块（Site URL + token）从账户弹窗移至 Settings 页面。

## Impact

- 前端：`views/Settings.vue`（重构为多区块）、新增 `components/settings/AccountSettings.vue`（由 `AccountDialog.vue` 迁移）、`components/settings/InstallAppCard.vue`、`composables/usePwaInstall.ts`、`App.vue`、`router/index.ts`、`main.ts`、`index.html`、`public/`（manifest、图标、`sw.js`）。
- 后端：无 API 变化；生产静态托管 (`frontend_hosting.ts`) 已按文件名直接返回 `dist/` 根目录文件，`sw.js` / manifest 以 `no-cache` 提供，无需改动。
- 文档：`docs/frontend-architecture.md`、`docs/tech-stack.md`、`docs/external-api.md`（无 API 变化，确认无需修改或仅补充说明）、`docs/browser-extension.md` 中的入口描述。

## Context

- `AccountDialog.vue` 包含个人资料表单、Sharing、API Tokens（personal + Codex agent）、Browser Extension 四块，由 `App.vue` 的头像菜单 / 移动端抽屉打开。
- `views/Settings.vue` 只对 admin 开放（路由 `meta.requiresAdmin`、侧边栏 `requiresAdmin`），包含用户管理与全站 API Token 表。
- 生产环境由 `frontend_hosting.ts` 托管 `packages/frontend/dist`：根目录下存在的文件直接返回（非 `/assets/` 一律 `no-cache`），登录墙只作用于 `/api`，所以 `public/` 下的 manifest、图标、`sw.js` 无需后端改动即可匿名获取。
- 项目没有 PWA 相关依赖（无 `vite-plugin-pwa`）。

## Goals / Non-Goals

**Goals:**
- 一个 Settings 页：Install app → Account → Admin（仅 admin）。
- 站点满足 Chromium 的可安装性条件，并在 Settings 顶部提供安装入口。

**Non-Goals:**
- 离线缓存、推送通知、后台同步。
- 改动任何后端 API 或权限。

## Decisions

1. **组件拆分**：`AccountDialog.vue` 的逻辑原样迁入 `components/settings/AccountSettings.vue`，去掉 Dialog 外壳，按 Settings 页现有的 `Card` 风格（标题栏 + 内容）分成 Account / Sharing / API Tokens / Browser Extension 四张卡片；挂载时加载数据（替代原 `watch(open)`）。保存成功后不再关闭弹窗，而是清空密码字段并重新填入用户名/昵称。
2. **管理员区块**：保留 `Settings.vue` 中的用户管理与全站 Token 代码，包在 `v-if="auth.isAdmin"` 里；`onMounted` 仅 admin 才调用 `store.fetchTokens()` / `fetchUsers()`，避免普通用户请求 admin 接口触发 403 toast。为区分两组 token，全站表标题改为 "All API Tokens (admin)"，并加一个小节标题 "Administration"。
3. **路由与导航**：`/settings` 的 `meta.requiresAdmin` 改为 `requiresAuth`；`App.vue` 中 Settings 项改为 `requiresAuth`；"Account settings" 菜单项和抽屉用户名按钮改为 `router.push('/settings')`；删除 `accountOpen` 和 `<AccountDialog>`。待审批数量徽标仍只对 admin 显示（`pendingCount` 仅 admin 刷新，保持不变）。
4. **PWA 实现选择手写而不是 `vite-plugin-pwa`**：需求只是可安装，不需要 Workbox 预缓存；手写 `public/manifest.webmanifest` + `public/sw.js` 无新依赖、无构建期副作用。
   - `sw.js`：`install` 时 `skipWaiting()`，`activate` 时 `clients.claim()`，注册一个不调用 `respondWith` 的 `fetch` 监听器（所有请求照常走网络，不影响 SSE / WebSocket / 会话 cookie）。
   - 注册：`main.ts` 中仅在 `import.meta.env.PROD` 且 `'serviceWorker' in navigator` 时于 `load` 后注册 `/sw.js`，开发环境不注册以免干扰 Vite HMR。
   - 图标：由 `favicon.svg` 的几何形状用 Python Pillow 一次性绘制生成 `icon-192.png`、`icon-512.png`、`icon-maskable-512.png`（maskable 版在品牌色 `#0069A8` 背景上缩放至安全区内）以及 `apple-touch-icon.png`(180)，作为静态资源提交。
   - `index.html`：`<link rel="manifest">`、`<meta name="theme-color">`、`<link rel="apple-touch-icon">`。
5. **安装状态 composable `usePwaInstall`**：模块级（单例）监听 `beforeinstallprompt`（`preventDefault` 并保存事件）与 `appinstalled`，在 `main.ts` 中尽早 import 以免事件在进入 Settings 前触发而丢失。暴露 `canInstall`、`installed`（`display-mode: standalone` 或 iOS `navigator.standalone` 或已触发 `appinstalled`）、`install()`。`InstallAppCard.vue` 根据状态显示按钮 / 已安装 / 手动说明。

## Risks / Trade-offs

- [Chromium 之外的浏览器不触发 `beforeinstallprompt`] → 显示手动安装说明。
- [Service Worker 一旦注册会长期存在] → 它不缓存、不拦截，升级只需替换 `sw.js`（`no-cache` 返回，浏览器每次导航都会检查更新）。
- [普通用户可访问 `/settings`] → 管理员区块在前端隐藏，后端 admin 接口本就独立鉴权，不扩大权限。

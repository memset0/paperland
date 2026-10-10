## 1. PWA 基础

- [x] 1.1 生成 PNG 图标（192 / 512 / maskable 512 / apple-touch 180）放入 `packages/frontend/public/`
- [x] 1.2 新增 `public/manifest.webmanifest` 与 `public/sw.js`（不缓存、不拦截）
- [x] 1.3 `index.html` 加 manifest / theme-color / apple-touch-icon 链接
- [x] 1.4 新增 `composables/usePwaInstall.ts`（单例监听 `beforeinstallprompt` / `appinstalled`、standalone 检测、`install()`），`main.ts` 中尽早引入并在生产环境注册 `/sw.js`

## 2. Settings 页合并

- [x] 2.1 新增 `components/settings/InstallAppCard.vue`（Install 按钮 / 已安装 / 手动说明）
- [x] 2.2 将 `AccountDialog.vue` 迁移为 `components/settings/AccountSettings.vue`（卡片布局、挂载时加载、保存后留在页面），删除 `AccountDialog.vue`
- [x] 2.3 重构 `views/Settings.vue`：Install app → Account → Administration（`v-if="auth.isAdmin"`，仅 admin 加载 admin 数据）
- [x] 2.4 `router/index.ts`：`/settings` 改为 `requiresAuth`
- [x] 2.5 `App.vue`：Settings 导航改为 `requiresAuth`；"Account settings" 菜单项与抽屉用户名按钮跳转 `/settings`；移除 AccountDialog

## 3. 文档与验证

- [x] 3.1 更新 `docs/frontend-architecture.md`、`docs/tech-stack.md`、`docs/external-api.md`（如需）、`docs/browser-extension.md` 中的入口描述
- [x] 3.2 `vue-tsc` 类型检查与 `bun run build:frontend --out-dir <scratch>` 验证构建，确认 dist 中含 manifest / sw.js / 图标

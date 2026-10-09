## Context

- 网站登录使用 httpOnly 会话 cookie（`paperland_session`, `SameSite=Lax`），`/api/*` 通过 `onRequest` hook 解析 `request.user`。
- 论文创建已有共享的 `ingestPaper()`（含去重 Map、元数据论文提升、触发服务依赖图）。库中 `arxiv_id` 以无版本号形式存储。
- 生产环境由后端托管前端构建；开发环境走 Vite（5173）并代理 `/api`。因此「GET 路径」做成前端 SPA 路由可同时覆盖两种部署。
- 登录是全局对话框（`useLoginPrompt`），不是独立页面；现有路由守卫在未登录时会把用户送回 `/`，会丢失目标地址。

## Goals / Non-Goals

**Goals:**
- 一个可被插件直接打开的稳定 URL，带 CSRF 防护，结果总是落在论文详情页。
- 插件零构建、零 host 权限，Chrome/Edge/Firefox 通用。

**Non-Goals:**
- 不发布到扩展商店（以「加载已解压扩展」/ 临时附加方式安装）。
- 不做右键菜单、批量导入、在页面内注入按钮。
- 不支持非 arxiv 的标识（DOI、Semantic Scholar corpus id）。

## Decisions

1. **GET 路径放在前端路由 `/open/arxiv/:arxiv_id(.*)`，由视图调用 `POST /api/papers/open-arxiv`。**
   备选：后端直接处理 GET 并 302。被否决：开发模式下 Vite 只代理 `/api`，需要额外代理规则；且未登录时后端无法弹出登录对话框。SPA 方案下有副作用的操作仍是同源 POST（cookie 自动携带，跨站页面无法读取 token）。路由不设 `requiresAuth`，由视图自己处理未登录（打开登录框并 `watch` 登录状态后继续），避免守卫把目标地址丢掉。完成后 `router.replace` 到详情页，带 token 的 URL 不留在历史记录。

2. **CSRF token 为每用户持久随机值，存在 `users.open_token`（nullable text）。**
   备选 a：复用 External API Bearer token —— 其权限远大于「打开论文」，放进 URL 风险高，否决。备选 b：HMAC(服务器密钥, user_id) —— 需要新增密钥配置且无法单独吊销，否决。token 单独不能做任何事（必须同时有会话 cookie），泄露影响仅限「诱导该用户创建一篇 arxiv 论文」，并可随时重新生成。比较使用 `crypto.timingSafeEqual`。懒生成：首次 `GET /api/auth/open-token` 时写入 `randomBytes(32).toString('hex')`。

3. **arxiv id 规范化放在后端 `utils/arxiv_id.ts`（`normalizeArxivId`）**，插件里有一份等价的提取逻辑（插件是独立包、无构建，不能 import 后端代码）。后端为最终权威，插件提取失败仅影响能否跳转。

4. **插件结构（`packages/browser-extension/`）**：
   - `manifest.json`（MV3）：`action`、`options_ui`、`commands._execute_action`（Alt+Shift+P）、权限 `activeTab` `scripting` `storage`；`background` 同时声明 `service_worker`（Chromium）与 `scripts`（Firefox），均为 `type: module`；`browser_specific_settings.gecko.id`。
   - `src/arxiv.js`：纯函数 `extractArxivIdFromUrl(url)` / `normalizeArxivId(raw)` / `buildOpenUrl(base, id, token)`，可在 bun 下单测。
   - `src/background.js`：`action.onClicked` → URL 提取 → 失败则 `scripting.executeScript` 读取 `citation_arxiv_id` meta → 读取 `storage.sync` 配置 → `tabs.create({ url, index: tab.index + 1 })`；无 id 时 `action.setBadgeText('?')` 2 秒后清除。
   - `src/options.html/.js`：表单保存 `base_url`、`token`。
   - 使用 `globalThis.browser ?? globalThis.chrome`，MV3 下两者都支持 Promise API。

5. **账户对话框新增区块**而不是在 Settings 页（Settings 仅管理员可见，而普通用户也需要 token）。

6. **生产托管的 SPA 回退**：`frontend_hosting.ts` 把带扩展名的路径视为静态文件（缺失即 404），而 `/open/arxiv/2401.12345` 的 id 恰好像扩展名。对 `/open/` 前缀豁免该规则（Vite 开发服务器本身已正确回退）。

## Risks / Trade-offs

- [token 出现在 URL 中，可能进入浏览器历史/代理日志] → 页面完成后 `replace` 掉；token 单独无效（需会话）；可一键重新生成。
- [Firefox 对 `background.service_worker` 支持有限] → 同时声明 `scripts`，Firefox 使用事件页，Chromium 忽略 `scripts`（仅告警）。
- [alphaXiv / HF 未来更改 URL 结构] → meta 回退兜底；提取模式集中在一个文件里便于更新。
- [首次在新标签页登录后需要继续] → 视图 watch `auth.user`，登录成功自动继续。

## Migration Plan

- Drizzle 生成迁移为 `users` 增加 `open_token` 列（nullable，无默认值），对现有数据无影响；回滚只需忽略该列。

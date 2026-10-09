## Why

在 arxiv / Hugging Face / alphaXiv 上读到论文时，想把它放进 Paperland 需要手动复制 arxiv id、打开网站、在添加对话框里粘贴。我们希望在任何带 arxiv id 的页面上一键跳转到 Paperland 中对应的论文（不存在则自动创建）。

## What Changes

- 新增前端 GET 路径 `/open/arxiv/<arxiv_id>?token=<csrf_token>`：打开后校验当前登录用户与 token，若库中不存在该 arxiv 论文则自动创建（触发已有的服务依赖图），然后跳转（`replace`）到 `/papers/:id`；已存在则直接跳转。未登录时弹出登录框，登录成功后继续。
- 新增后端接口 `POST /api/papers/open-arxiv`（需登录 + 校验 token），规范化 arxiv id（去掉版本号、`arXiv:` 前缀，支持旧式 `hep-th/9901001`）后复用 `ingestPaper` 完成查找或创建。
- 新增每用户的「快捷打开 token」（CSRF token）：`users.open_token` 列；`GET /api/auth/open-token` 获取（首次自动生成）、`POST /api/auth/open-token/regenerate` 重新生成。只有同时持有有效会话 cookie 与匹配 token 的请求才会创建论文，防止第三方页面通过链接诱导创建。
- 账户设置对话框中新增「浏览器插件」区块：显示 token、复制、重新生成，以及可直接复制的站点地址。
- 新增浏览器插件 `packages/browser-extension/`（Manifest V3，Chrome / Edge / Firefox，无需构建）：点击工具栏按钮（或快捷键 Alt+Shift+P）时从当前页面 URL 提取 arxiv id，支持 arxiv abs/pdf/html、Hugging Face papers、alphaXiv 等；URL 中没有时回退读取页面的 `citation_arxiv_id` meta；然后在新标签页打开上述 GET 路径。插件选项页配置 Paperland 地址与 token。

## Capabilities

### New Capabilities
- `arxiv-quick-open`: 快捷打开 GET 路径、`open-arxiv` 后端接口、arxiv id 规范化、每用户 CSRF token 的生成/校验/重新生成及账户对话框中的管理入口。
- `browser-extension`: 浏览器插件的页面识别（URL 模式 + meta 回退）、跳转行为、选项配置。

### Modified Capabilities

（无）

## Impact

- 后端：`packages/backend/src/db/schema.ts`（新列 + Drizzle 迁移）、`api/auth.ts`（token 接口）、`api/papers.ts`（open-arxiv 接口）、新增 `utils/arxiv_id.ts` 及单测。
- 后端前端托管：`frontend_hosting.ts` 的 SPA 回退不再把 `/open/` 下带「扩展名」样式的路径（如 `2401.12345`）当作静态文件 404。
- 前端：`router/index.ts` 新增 `/open/arxiv/:arxiv_id(.*)` 路由、新视图 `views/OpenArxiv.vue`、`components/AccountDialog.vue`、`api/client.ts`。
- 新包：`packages/browser-extension/`（manifest、background、options 页、id 提取模块与单测）。
- 文档：`docs/frontend-architecture.md`、`docs/external-api.md`、`docs/tech-stack.md`，新增 `docs/browser-extension.md`。
- 无新运行时依赖；无破坏性变更。

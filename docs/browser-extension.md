# Paperland 浏览器插件

在 arXiv / Hugging Face / alphaXiv 等论文页面一键跳转到 Paperland 中对应的论文；库中没有时自动创建。

代码位于 `packages/browser-extension/`（Manifest V3，纯 JS，无需构建），支持 Chrome / Edge 等 Chromium 浏览器与 Firefox ≥ 121。

## 安装

- **Chrome / Edge**：打开 `chrome://extensions`（Edge 为 `edge://extensions`）→ 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `packages/browser-extension/` 目录。
- **Firefox**：打开 `about:debugging#/runtime/this-firefox` →「临时载入附加组件」→ 选择 `packages/browser-extension/manifest.json`（临时载入在重启浏览器后失效）。

## 配置

1. 在 Paperland 中打开左下角头像 → **Account settings** → **Browser Extension**，复制 **Site URL** 与 **Token**。
2. 首次点击插件按钮会自动打开选项页（或在扩展管理页打开「选项」），填入两项并保存。

Token 可在同一处「重新生成」，旧 token 立即失效，需要回到插件选项页更新。

## 使用

在支持的页面点击工具栏的 Paperland 按钮，或按 **Alt+Shift+P**。插件在新标签页（紧邻当前页）打开：

```
<Site URL>/open/arxiv/<arxiv_id>?token=<token>
```

Paperland 会查找或创建该论文并跳转到论文详情页。未登录时先弹出登录框，登录后自动继续。

页面识别（`src/arxiv.js`，版本号会被去掉）：

| 站点 | URL 形式 |
| --- | --- |
| arXiv（含 `www.` / `export.`） | `/abs/<id>`、`/pdf/<id>[.pdf]`、`/html/<id>` |
| Hugging Face | `huggingface.co/papers/<id>` |
| alphaXiv（含 `www.`） | `/abs/<id>`、`/overview/<id>`、`/pdf/<id>` |
| 其他页面 | 回退读取 `<meta name="citation_arxiv_id">` |

新式 id（`2401.12345`）与旧式 id（`hep-th/9901001`）均支持。识别不到 id 时按钮短暂显示 `?` 角标，不打开标签页。

## 权限与安全

- 仅申请 `activeTab`、`scripting`、`storage`，没有常驻的站点权限；只有在用户点击时才读取当前页 URL / meta。
- Token 是每用户的 CSRF token：创建论文的请求同时需要 Paperland 会话 cookie 与匹配的 token，第三方页面无法凭链接让已登录用户创建论文。token 与 External API Token 无关，不能调用 External API。
- 跳转完成后带 token 的 URL 会被替换出浏览历史。

## 开发

```bash
cd packages/browser-extension && bun test   # URL → arxiv id 提取单测
```

修改 URL 规则时只需改 `src/arxiv.js` 中的 `SITES` 并补充 `test/arxiv.test.js`。后端对应接口与 id 规范化见 `docs/external-api.md`（Internal API 说明）与 `packages/backend/src/utils/arxiv_id.ts`。

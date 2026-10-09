## Context

插件是免构建的纯 JS 包，位于 `packages/browser-extension/`。后端始终从项目根目录运行（工作目录即仓库根），因此可以直接读取该目录。用户的快捷打开 token 已由 `auth/open_token.ts` 管理。

## Goals / Non-Goals

**Goals:** 一键下载、解压/载入即可用；不引入新依赖；不需要额外的构建步骤或发布流程。

**Non-Goals:** 不签名 / 不上架商店（Firefox 正式安装需 AMO 签名，仍以「临时载入」方式说明）；不做插件自动更新检查。

## Decisions

1. **服务端即时打包 zip，而不是预构建静态文件。** 这样可以写入每个用户自己的 `preset.json`，而且插件源码改动后无需单独构建。文件很少（约 10 个、几十 KB），每次请求打包的开销可以忽略。
   - 备选：前端构建时复制 zip 到 `dist/`。否决理由：无法个性化，并且多一步构建。
2. **自写最小 zip 写入器（STORE，不压缩）+ `Bun.hash.crc32`。** 约 50 行代码，无新依赖。
   - 备选：调用系统 `zip` 命令。否决理由：引入运行环境依赖。
   - 备选：引入 jszip/fflate 等库。否决理由：没有必要。
3. **`base_url` 由前端传 `window.location.origin`。** 后端不尝试从 `Host` / `X-Forwarded-*` 推断：在 Caddy 反代和 Vite 代理两种场景下，浏览器看到的 origin 才是正确的站点地址。后端只校验它是 http(s) 绝对 URL。
4. **下载用普通 `<a href>` 的 GET 请求。** 同源请求会携带会话 cookie；cookie 为 `SameSite=Lax`，第三方站点即使触发下载也读不到内容。
5. **preset 回退放在 `settings.js`。** 用 `fetch(runtime.getURL('src/preset.json'))` 读取，失败即视为空；读取顺序为 storage 值优先、preset 兜底。选项页保存后，storage 中的值覆盖 preset。
6. **账户对话框中的 token 区块保留。** 该文件正被其他工作并发修改，迁移它会增加冲突；两处显示的是同一个 token，不会不一致。

## Risks / Trade-offs

- [zip 中包含 token，文件被转发即泄露] → token 单独无效（还需要会话 cookie），且可在页面上一键重新生成。页面会提示该文件是个人专用。
- [STORE 格式文件稍大] → 总计约几十 KB，可忽略。

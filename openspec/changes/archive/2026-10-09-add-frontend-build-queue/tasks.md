## 1. Build queue

- [x] 1.1 新增 `scripts/build-frontend.sh`：meta 锁 + 全局构建锁、按输出目录登记序号、合并已覆盖请求、记录 `attempted`/`status`/日志；支持 `--out-dir`
- [x] 1.2 根 `package.json` 新增 `build:frontend`；`.gitignore` 新增 `data/build-queue/`

## 2. Rules and docs

- [x] 2.1 `AGENTS.md` 增加前端构建规则（只用 `bun run build:frontend`，验证构建用 `--out-dir`）
- [x] 2.2 更新 `docs/tech-stack.md`、`docs/frontend-architecture.md` 中的构建命令（`docs/external-api.md` 无需修改）

## 3. Verify

- [x] 3.1 用一个替身构建命令（`BUILD_QUEUE_CMD` 测试钩子）验证：并发请求串行执行、排队请求合并为一次、不同输出目录不合并、失败结果被共享、被 kill 后队列可继续
- [x] 3.2 用真实构建跑一次 `bun run build:frontend`

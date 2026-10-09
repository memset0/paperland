## Context

前端构建（`vite build`）在这台 2 核 / 3GB 机器上很重；多个 agent 共用工作区，常同时构建同一个 `packages/frontend/dist`。线上后端直接托管 `dist`。

## Goals / Non-Goals

**Goals:** 全机串行构建；排队；同一输出目录的排队请求合并为一次。

**Non-Goals:** 不做构建结果原子替换（`vite` 在写出阶段才清空 `dist`，窗口很短，维持现状）；不做跨机器队列；不管 `vue-tsc` 类型检查和 dev server。

## Decisions

- **Bash + `flock`**：util-linux 自带，锁随进程退出自动释放，无需清理陈旧锁；不需要守护进程。备选：Bun 写常驻队列服务——多一个要维护的进程，收益不大。
- **两把锁**：`data/build-queue/meta.lock` 只保护计数器读写（瞬时持有）；`data/build-queue/build.lock` 是全局构建锁（持有整个构建期间）。
- **按序号合并**（每个输出目录一个 key = 输出目录绝对路径的 sha1 前 12 位）：
  1. 登记：在 meta 锁内 `requested += 1`，记下自己的序号 `my`。
  2. 阻塞获取构建锁。
  3. 拿到锁后读 `attempted`：若 `attempted >= my`，说明在自己登记之后已经开始并完成过一次构建 → 直接以记录的 `status` 退出（打印日志路径）。
  4. 否则在 meta 锁内读 `cover = requested`，执行构建，写日志到 `<key>.log`；结束后写 `attempted = cover`、`status = 退出码`。
  这样运行中的构建 A 结束后，排队的 B 构建一次覆盖 B、C、D；C、D 拿到锁时发现已覆盖，立即退出。
- **失败也合并**：被覆盖的请求共享失败结果，不各自重试，避免失败时排队请求轮流重跑十几分钟。之后新登记的请求会重新构建。
- **构建命令**：默认 `bun run --filter '@paperland/frontend' build`；`--out-dir` 时在 `packages/frontend` 下执行 `bunx vite build --outDir <dir> --emptyOutDir`。输出同时 tee 到终端和日志。
- **测试钩子**：环境变量 `BUILD_QUEUE_CMD` 替换构建命令，用于在不跑真实 vite 的情况下验证排队与合并。
- **入口**：根 `package.json` 的 `build:frontend` → `bash scripts/build-frontend.sh`；`AGENTS.md` 要求只用此入口。

## Risks / Trade-offs

- 绕过入口直接跑 `vite build` 的进程不受控 → 用 `AGENTS.md` 规则约束。
- 构建锁只在本机有效 → 符合单机部署现状。
- 被合并请求拿到的是「登记之后开始的构建」的结果，代码在那次构建开始后又改过的话不会包含 → 这与「构建开始后才改的代码需要再构建一次」的常识一致，此时重新请求即可。

## Why

多个 agent 共用一台 2 核 / 3GB 内存的机器和同一个工作区，经常同时跑 `vite build`：互相抢内存导致单次构建长达十几分钟、被 OOM 或内存保护机制杀掉，而且几个构建产出的其实是同一份 `dist`。需要一个本地构建排队机制，让构建串行执行，并把排队中的重复请求合并成一次。

## What Changes

- 新增 `scripts/build-frontend.sh`，并在根 `package.json` 加 `build:frontend` 脚本作为唯一的前端构建入口：
  - 全机同一时刻最多执行一个前端构建（`flock` 全局锁，进程退出自动释放）。
  - 请求进入队列后阻塞等待；当前构建结束后，同一输出目录的所有排队请求合并为一次构建，被合并的请求直接以那次构建的结果退出（共享退出码并给出日志位置）。
  - 默认输出到 `packages/frontend/dist`（线上托管的产物）；`--out-dir <dir>` 用于只做验证的构建，同样排队，但只与相同输出目录的请求合并。
  - 状态与日志保存在 `data/build-queue/`（gitignore）。
- `AGENTS.md` 增加前端构建规则：必须通过 `bun run build:frontend` 构建，禁止直接运行 `vite build` / `bun run --filter '@paperland/frontend' build`。
- 更新 `docs/tech-stack.md`、`docs/frontend-architecture.md` 中的构建命令。

## Capabilities

### New Capabilities
- `frontend-build-queue`: 本地前端构建的串行执行、排队与合并。

### Modified Capabilities
（无）

## Impact

- 新增 `scripts/build-frontend.sh`；根 `package.json` 新增 `build:frontend` 脚本；`.gitignore` 新增 `data/build-queue/`。
- `AGENTS.md`、`docs/tech-stack.md`、`docs/frontend-architecture.md`。
- 不影响运行时代码、API、数据库；依赖系统自带的 `flock`（util-linux）。

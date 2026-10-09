## Context

`backup.ts` 每天把数据库复制成 `paperland_YYYY-MM-DD.db`，然后按 mtime 删除超过 `retention_days`（30）天的文件。用户希望保留近 7 天每天的备份，以及大约 14 天、28 天前的备份。

## Goals / Non-Goals

**Goals:** 分层保留，配置驱动，清理逻辑可单元测试。
**Non-Goals:** 不改备份频率；不改复制方式；不处理手工的 `pre-*.db` 备份。

## Decisions

### D1. 检查点用“区间内保留最老一份”，而不是“恰好 N 天那一份”
如果每天只保留“年龄恰好为 14 天”的那个文件，它第二天就变成 15 天而被删掉，28 天的检查点永远等不到文件。所以把检查点定义为区间：
- 日备份窗口是年龄 0..`keep_daily_days`（含）的文件，全部保留。
- 每个检查点 `c_i`（升序）对应区间 (`c_{i-1}`, `c_i`]，其中 `c_0 = keep_daily_days`。区间内只保留最老的一份。
- 年龄超过最大检查点的文件全部删除。

效果是：一份备份从日备份窗口出来后，先在 (7,14] 里停到 14 天，再进入 (14,28] 停到 28 天，然后被删除。其间新进入同一区间的文件因为不是最老的而被删。稳态下任何时刻都有 8 份日备份，加上一份 8–14 天前的、一份 15–28 天前的备份。
- *考虑过的替代方案*：经典的 GFS（按自然周、自然月保留）。没有采用，因为用户直接给出了 14、28 这两个天数，而且这样配置更直观。

### D2. 年龄来自文件名日期
`age = floor((今天 UTC 日期 - 文件名日期) / 1 天)`。文件名不符合 `paperland_YYYY-MM-DD.db` 的文件一律不处理。不用 mtime，因为复制、恢复备份目录时 mtime 会改变。

### D3. 纯函数 `selectBackupsToDelete(fileNames, today, keepDailyDays, checkpointDays)`
`cleanupOldBackups` 只负责读目录、调用这个纯函数、删除文件，方便用固定日期做单元测试，包括逐日推进的模拟。

### D4. 配置
```yaml
backup:
  enabled: true
  dir: ./data/backups
  keep_daily_days: 7
  keep_checkpoint_days: [14, 28]
```
zod 默认值分别是 `7` 和 `[14, 28]`。检查点会排序、去重，小于等于 `keep_daily_days` 的值会被忽略（例如写 7 等同于不写）。`retention_days` 从 schema 中移除，旧配置里的这个键会被 zod 静默忽略。

## Risks / Trade-offs

- [部署时一次性删除约 20 个旧日备份] → 这正是用户想要的；`pre-*.db` 手工备份不受影响。
- [检查点的实际年龄会在区间内浮动，例如“14 天”那份实际是 8–14 天前] → 已在文档和配置注释中说明。

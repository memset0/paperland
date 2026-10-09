## Why

现在每日备份按 `retention_days: 30` 全部保留，`data/backups/` 里常年有约 30 个、每个约 60MB 的完整副本，大约 1.8GB，而且服务器磁盘刚刚被写满过。较老的备份并不需要每天一份，改为“近期每日、远期稀疏”的分层保留就能大幅减少占用，同时保留找回两周前、四周前数据的能力。

## What Changes

- 自动备份的清理策略改为分层保留：
  - 最近 `keep_daily_days`（默认 7）天内的每日备份全部保留。
  - 再按 `keep_checkpoint_days`（默认 `[14, 28]`）各保留一份更老的检查点备份：在区间 (7, 14] 和 (14, 28] 里各保留最老的那一份，让它随时间往后推移，而不是每天被替换。
  - 超过最大检查点（28 天）的自动备份删除。
  - 稳态下约 10 个文件，原来是 30 个。
- 备份的“天数”改为按文件名里的 UTC 日期计算，不再依赖文件 mtime（复制或移动文件会改变 mtime）。
- 只清理 `paperland_YYYY-MM-DD.db` 格式的自动备份，`pre-*.db` 等手工备份不受影响（与现状一致）。
- **BREAKING（配置）**：`database.backup.retention_days` 由 `keep_daily_days` 和 `keep_checkpoint_days` 取代。旧键会被忽略，不配置时使用新的默认值。
- 备份频率不变，仍然是每天一次（启动时检查一次，之后每 24 小时一次）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities
- `database-backup`: Retention policy 从“删除超过 N 天的备份”改为分层保留（每日 + 检查点）。
- `config-loading`: Database configuration 的备份配置项由 `retention_days` 改为 `keep_daily_days` / `keep_checkpoint_days`。

## Impact

- 代码：`packages/backend/src/db/backup.ts`（清理逻辑抽成可测试的纯函数），`packages/backend/src/config.ts`（备份配置 schema），`packages/shared/src/types.ts`（如果有备份配置类型）。
- 配置：`config.example.yml`，以及本地 `config.yml` 的 backup 段。
- 文档：`docs/tech-stack.md` 的备份策略章节。
- 部署后第一次备份时，已有的 30 天每日备份会立即按新规则清理，只剩约 10 个文件。

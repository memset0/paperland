## Why

`loadConfig()` 使用 `process.cwd()` 定位 `config.yml`，但通过 `bun run --filter '@paperland/backend' dev` 启动时，`cwd` 是 `packages/backend/` 而非项目根目录。导致后端找不到位于项目根目录的 `config.yml`。

## What Changes

- **修复 config.ts 中的路径解析**：向上遍历目录查找 `config.yml`（从 cwd 开始，逐级向上直到找到或到达根目录），使后端无论从哪个目录启动都能找到配置文件

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `config-loading`: config.yml 路径解析改为向上遍历查找，不再依赖 cwd 必须是项目根目录

## Impact

- **后端**：仅修改 `packages/backend/src/config.ts` 中的路径解析逻辑
- **无 breaking change**：从项目根目录启动的行为不变

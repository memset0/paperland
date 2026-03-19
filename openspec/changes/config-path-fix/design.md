## Context

`config.ts` 第 68 行：`resolve(process.cwd(), 'config.yml')`。当 bun workspace 的 `--filter` 把 cwd 切到 `packages/backend/` 时，这个路径就找不到根目录的 `config.yml`。

## Goals / Non-Goals

**Goals:** 从任何子目录启动后端都能找到项目根目录的 `config.yml`
**Non-Goals:** 支持任意位置的 config 文件（仍然只查找名为 `config.yml` 的文件）

## Decisions

### Decision 1: 向上遍历查找 config.yml

**Choice**: 从 `process.cwd()` 开始，逐级向上查找 `config.yml`，直到找到或到达文件系统根目录。

**Rationale**: 简单可靠，不依赖环境变量或 package.json 位置。monorepo 中任何子目录启动都能找到根目录的配置文件。`configPath` 参数仍然优先（用于测试等场景）。

**Alternative considered**: 使用 `import.meta.dir` 相对路径 — 硬编码了目录层级，不够灵活。

## Risks / Trade-offs

- 无显著风险。最坏情况是遍历到根目录仍找不到，报错信息与现在一致。

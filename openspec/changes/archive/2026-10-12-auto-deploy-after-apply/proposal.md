## Why

Apply 完成后需要自动把实现部署给用户验收，再由用户决定继续修改还是归档，避免仅完成验证构建就结束。

## What Changes

- 在 AGENTS.md 明确 apply 完成后默认自动部署并验证部署结果。
- 报告结果后询问用户是否还需修改及是否可以归档；未获归档授权时保持 active。
- 明确部署失败不视为完成，不自动归档；纯文档变更说明无需运行时部署。

## Capabilities

### New Capabilities

None. Repository workflow documentation only; skip_specs is enabled.

### Modified Capabilities

None.

## Impact

Only AGENTS.md and this change's planning artifacts. Preserve CLAUDE.md as a relative symlink to AGENTS.md. No application code, schema or API change.

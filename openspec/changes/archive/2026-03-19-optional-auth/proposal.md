## Why

Paperland 目前强制要求 HTTP Basic Auth，但在本地开发或受信任的内网环境中，认证是不必要的摩擦。需要一个配置开关来可选地关闭网站认证。

## What Changes

- 在 `config.yml` 的 `auth` 配置段中新增 `enabled` 字段（布尔值，默认 `true`）
- 当 `auth.enabled` 为 `false` 时，`/api/*` 路由跳过 Basic Auth 检查，且 `auth.users` 变为可选
- 当 `auth.enabled` 为 `true` 时（或未设置），行为与现有完全一致，`auth.users` 仍然必填
- 前端无需改动（Vite proxy 透传，前端 API client 不涉及 auth header）
- External API 的 Bearer Token 认证不受影响

## Capabilities

### New Capabilities

_None — this is a modification of existing auth behavior._

### Modified Capabilities

- `auth`: Add `enabled` toggle to make HTTP Basic Auth optional; when disabled, `/api/*` routes require no authentication.

## Impact

- **Config**: `config.yml` schema change — `auth.enabled` field added, `auth.users` conditionally required
- **Backend**: `packages/backend/src/config.ts` — Zod schema update; `packages/backend/src/index.ts` — auth hook conditional; `packages/backend/src/auth/basic_auth.ts` — no change needed
- **Shared types**: `packages/shared/src/types.ts` — `AuthConfig` interface updated
- **Docs**: `docs/tech-stack.md` or relevant docs updated to reflect optional auth
- **No breaking changes** — default `enabled: true` preserves existing behavior

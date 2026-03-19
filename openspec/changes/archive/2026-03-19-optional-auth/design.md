## Context

Paperland 使用 HTTP Basic Auth 保护 `/api/*` 路由，凭据来自 `config.yml` 的 `auth.users` 数组。当前 `auth.users` 是必填的（Zod schema 要求 `min(1)`）。在本地开发或内网部署场景中，用户希望能完全关闭认证。

当前 auth hook 位于 `packages/backend/src/index.ts` 的 `onRequest` 钩子中，对三类路由分别处理：
- `/api/health` — 跳过
- `/external-api/*` — Bearer Token auth
- `/api/*` — Basic Auth

## Goals / Non-Goals

**Goals:**
- 在 `config.yml` 中增加 `auth.enabled` 开关，默认 `true`
- `enabled: false` 时 `/api/*` 路由完全跳过 Basic Auth
- `enabled: false` 时 `auth.users` 变为可选（可省略或为空数组）
- 零破坏性变更：不设置 `enabled` 字段等价于 `true`

**Non-Goals:**
- 不修改 External API 的 Bearer Token 认证机制
- 不实现更细粒度的权限控制（如按路由开关）
- 不实现前端登录页面或认证 UI 变更

## Decisions

### 1. `auth.enabled` 字段位置与默认值

将 `enabled` 放在 `auth` 对象内部（而非顶层），因为它只控制网站 Basic Auth。默认值为 `true` 以保持向后兼容。

**备选方案**: 顶层 `auth_enabled` 字段 — 拒绝，因为不符合现有分组风格。

### 2. Zod schema 条件校验

使用 Zod 的 `.refine()` 实现条件校验：当 `enabled` 为 `true`（或未设置）时，`users` 必须至少有 1 个元素；当 `enabled` 为 `false` 时，`users` 可选。

具体做法：将 `users` 改为 `z.array(authUserSchema).default([])`，然后在 `authSchema` 上加 `.refine()` 检查。

### 3. Auth hook 中的条件跳过

在 `index.ts` 的 `onRequest` 钩子中，读取 `config.auth.enabled`，如果为 `false` 则直接跳过 Basic Auth 调用，无需修改 `basic_auth.ts` 本身。

## Risks / Trade-offs

- **安全风险**: 误设 `enabled: false` 会暴露所有 API — 这是用户明确选择的行为，服务器启动时打印警告日志即可缓解。
- **配置漂移**: 生产环境意外使用了开发配置 — 通过启动日志警告提醒。

## 1. Shared Types

- [x] 1.1 Update `AuthConfig` interface in `packages/shared/src/types.ts` — add `enabled?: boolean` field

## 2. Backend Config Schema

- [x] 2.1 Update Zod `authSchema` in `packages/backend/src/config.ts` — add `enabled: z.boolean().default(true)`, change `users` to `z.array(authUserSchema).default([])`, add `.refine()` to require users when enabled

## 3. Auth Hook

- [x] 3.1 Update `onRequest` hook in `packages/backend/src/index.ts` — skip `basicAuth()` call when `config.auth.enabled` is `false`
- [x] 3.2 Add startup warning log when auth is disabled

## 4. Config File

- [x] 4.1 Add `enabled: true` to `auth` section in `config.yml` as documentation of the new field

## 5. Documentation

- [x] 5.1 Update relevant docs in `docs/` to document the `auth.enabled` toggle

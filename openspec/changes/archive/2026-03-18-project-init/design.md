## Context

Paperland is a greenfield paper management website. No code exists yet. The project requires a Bun workspace monorepo with TypeScript across frontend (Vue 3 + Vite) and backend (Fastify + Drizzle ORM). This change establishes the foundational infrastructure that all features depend on.

Detailed architecture is documented in `docs/tech-stack.md` and `docs/frontend-architecture.md`.

## Goals / Non-Goals

**Goals:**
- Bun workspace monorepo with packages/frontend, packages/backend, packages/shared
- Drizzle ORM schema for all 7 tables with SQLite, designed for PostgreSQL migration
- config.yml loading with full type safety
- Fastify server with HTTP Basic Auth and Bearer Token middleware
- Shared TypeScript types for all data models
- Vue 3 + Vite frontend scaffold with router skeleton and Pinia
- SQLite daily backup scheduler

**Non-Goals:**
- Implementing any service logic (arxiv, semantic scholar, QA, etc.)
- Building actual frontend pages beyond scaffolding
- External API endpoints (beyond auth middleware being ready)
- Service runner / dependency graph scheduler
- PDF parsing

## Decisions

### 1. Drizzle ORM with SQLite-first schema

**Decision**: Use `drizzle-orm` with `better-sqlite3` driver. Define schema using Drizzle's SQLite column types.

**Why over Prisma**: Drizzle is lighter, more SQL-like, and gives finer control over queries. Prisma's runtime engine adds overhead unnecessary for this project. Drizzle's migration tooling (`drizzle-kit`) supports both SQLite and PostgreSQL.

**PostgreSQL migration path**: When migrating, swap the driver import from `drizzle-orm/better-sqlite3` to `drizzle-orm/node-postgres`, adjust column types (integer → serial, text → varchar where appropriate), and re-run `drizzle-kit push`.

### 2. config.yml with js-yaml + Zod validation

**Decision**: Load config.yml with `js-yaml`, validate and type with `zod` schema.

**Why Zod**: Provides runtime validation + TypeScript type inference from a single schema definition. Catches config errors at startup rather than at runtime. The zod schema lives in `packages/backend/src/config.ts` and the inferred type is re-exported from `packages/shared`.

### 3. Auth implementation

**Decision**: HTTP Basic Auth via Fastify plugin for website access. Bearer Token via separate Fastify plugin for External API routes.

**Basic Auth**: Uses `@fastify/basic-auth` plugin. Validates against `config.yml` auth.users array. Applied to all routes except `/external-api/*`.

**Bearer Token**: Custom Fastify preHandler hook. Looks up token in `api_tokens` table, checks `revoked_at` is null. Applied only to `/external-api/*` routes.

### 4. Monorepo workspace structure

**Decision**: Bun workspaces with three packages. `shared` package contains only TypeScript types and is imported by both frontend and backend.

**Why not a single package**: Separation enables independent builds, clearer dependency boundaries, and the possibility of deploying frontend as static files separately from the backend.

**Package references**:
- `@paperland/shared` — types only, no runtime dependencies
- `@paperland/backend` — depends on `@paperland/shared`
- `@paperland/frontend` — depends on `@paperland/shared`

### 5. SQLite backup via better-sqlite3 backup API

**Decision**: Use `better-sqlite3`'s `database.backup()` method which calls SQLite's online backup API. Schedule with `setInterval` checked daily on server startup.

**Why not cron/OS-level backup**: Keeps the backup logic self-contained within the application. The backup API is safe to call while the database is in use (it handles locking internally).

## Risks / Trade-offs

- **[Risk] SQLite concurrent write limitations** → For a personal-use project, SQLite WAL mode is sufficient. Enable WAL mode on database initialization. If migrating to PostgreSQL later, this is resolved automatically.

- **[Risk] config.yml passwords in plaintext** → Acceptable for personal project. Document that users should set appropriate file permissions. Future improvement: support environment variable references in config.

- **[Risk] Drizzle SQLite ↔ PostgreSQL schema differences** → Mitigated by keeping schema simple (integer, text, nullable). Avoid SQLite-specific features. JSON fields stored as text in both.

- **[Trade-off] better-sqlite3 is synchronous** → Drizzle wraps it but individual queries block the event loop. Acceptable for this project's scale. If needed later, can switch to `@libsql/client` for async SQLite.
